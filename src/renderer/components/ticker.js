import { LitElement, html, css } from 'lit';
import './lit-components/navigation.js';
import { globalStyles } from './styles/global-css.js';
import {
	iconStyles,
	IconSpinner,
	IconEdit,
	IconTrash,
	IconArrow,
	IconX,
	IconCopy,
	IconCheck,
} from './styles/icons.js';
import { normalizeMetrics, prettifyPeriodKey } from '../utils/copy-json.js';

import {
	getDerivedFields,
	addChanges,
	addRatiosChange,
	priceForWhishedPer,
	incomeForWishedPER,
	calculateRatiosWithPrice,
	renderChange,
} from '../utils/calculations.js';
import {
	constraints,
	validateEditedField,
} from '../pipeline/postprocessor/postprocessor.js';
import { getFinancesLabels, labels } from '../utils/labels.js';
import { userDataStore } from '../utils/user-data-store.js';

export class Ticker extends LitElement {
	static properties = {
		ticker: { type: String },
		lang: { type: String },
		allPeriods: { type: Array },
		periods: { type: Array },
		period: { type: String },
		data: { type: Object },
		loading: { type: Boolean },
		price: { type: String },
		wishedPer: { type: String },
		openEdition: { type: Boolean },
		editData: { type: Object },
		invalid: { type: Boolean },
		ttmAggregate: { type: Object },
		ttm: { type: Boolean },
		copied: { type: Boolean },
		showYearlyOnly: { type: Boolean },
	};

	ttmFields = ['cash_flow_from_operations', 'eps', 'net_income'];

	constructor() {
		super();
		this.ticker = null;
		this.data = {};
		this.allPeriods = [];
		this.periods = [];
		this.period = null;
		this.loading = true;
		this.price = null;
		this.wishedPer = null;
		this.openEdition = false;
		this.editData = {};
		this.invalid = false;
		this.ttmAggregate = Object.fromEntries(
			this.ttmFields.map((field) => [field, 0])
		);
		this.lang = 'EN';
		this.ttm = true;
		this.copied = false;
		this.showYearlyOnly = false;
	}

	connectedCallback() {
		super.connectedCallback();
		this.loadData();

		this._udUnsub = userDataStore.subscribe((ud) => {
			if (typeof ud.lang === 'string') this.lang = ud.lang;
			if (typeof ud.ttm === 'boolean') this.ttm = ud.ttm;
		});
	}

	disconnectedCallback() {
		super.disconnectedCallback();
		this._udUnsub?.();
	}

	updated(changedProps) {
		if (this.loading) return;
		if (
			changedProps.has('data') ||
			changedProps.has('period') ||
			changedProps.has('ttm')
		) {
			this.ttmAggregateSum();
		}
	}

	static styles = [
		globalStyles,
		iconStyles,
		css`
			:host {
				display: flex;
				height: 100%;
				width: 100%;
				flex-direction: column;
				text-align: center;
				gap: 30px;
				justify-content: center;
				font-variant-numeric: tabular-nums;
				font-feature-settings: 'tnum' 1;
			}

			h1 {
				font-size: 16px;
				font-weight: 400;
				letter-spacing: 1.5px;
				text-align: center;
				width: 250px;
				cursor: default;
			}
			p {
				margin: 0;
			}

			.boxes-layout {
				/* prevent columns from overgrowing viewport */
				width: min(100%, 85vw);
				/* sensible cap each column */
				max-width: 1000px;
				margin: 0 auto;

				display: grid;
				grid-template-columns: repeat(
					2,
					minmax(0, 1fr)
				); /* equal, shrinkable */
				gap: 16px;
				box-sizing: border-box;
			}

			.box {
				background: rgba(200, 200, 200, 0.15);
				backdrop-filter: blur(10px);
				-webkit-backdrop-filter: blur(10px);
				border-radius: 15px;
				box-shadow: 0 0 20px rgba(0, 0, 0, 0.1);
				-webkit-app-region: no-drag;
				z-index: 10;
				padding: 15px;
				cursor: default;
				max-width: 100%;
				overflow: hidden;
			}

			/* default row style */
			.row {
				display: flex;
				justify-content: space-between;
				cursor: default;
				align-items: center;
				letter-spacing: 1px;
				height: 19px;
				min-width: 0;
			}

			.row sub {
				display: inline-block;
				line-height: 1;
				vertical-align: sub;
				position: static;
				top: auto;
				margin: 0 0;
			}

			.row p {
				white-space: nowrap;
				overflow: hidden;
				text-overflow: ellipsis;
				max-width: 100%;
				min-width: 0;
				/* font-size: 14px; */
			}

			.row,
			input {
				font-size: 14px;
			}

			.row-left-aligned {
				justify-content: left;
				gap: 12px;
			}

			.row > p:first-child {
				min-width: 0;
				overflow: hidden;
				text-overflow: ellipsis;
				white-space: nowrap;
				/* font-size: 13px; */
			}

			/* right-side cell: [ change ][ value ] */
			.row > p:last-child {
				flex: 0 0 auto;
				display: inline-flex;
				align-items: baseline;
				justify-content: flex-end;
				white-space: nowrap;
				overflow: hidden;
				text-overflow: ellipsis;
			}

			/* change: fixed slot, right-aligned */
			.row p:last-child sub.change {
				flex: 0 0 12ch; /* fixed width to prevent layout shift */
				min-width: 12ch;
				max-width: 12ch;
				text-align: right;
				line-height: 1;
				position: static;
			}

			/* value: owns remaining space and ellipsizes */
			.row p:last-child .value {
				min-width: 0;
				overflow: hidden;
				text-overflow: ellipsis;
				white-space: nowrap;
				padding-left: 2px;
			}

			.row p:last-child sub.label,
			.row p:last-child sub.unit {
				margin-left: 0;
				display: inline;
				position: relative;
				top: 0.1em;
			}

			.row p:last-child sub.unit {
				top: 0.2em;
			}

			/* odd count -> single column */
			.single-col {
				display: flex;
				flex-direction: column;
				justify-content: center;
				gap: 20px;
			}

			/* even count -> grid with 2 columns */
			.two-col {
				display: grid;
				grid-template-columns: 1fr 1fr;
				gap: 20px 30px; /* row-gap col-gap */
			}

			button {
				font-weight: 500;
				letter-spacing: 1.5px;
				height: 100%;
				width: 100%;
			}

			input {
				height: 25px;
				letter-spacing: 1px;
				border-radius: 10px;
				width: 55px;
				background-color: transparent;
				-webkit-appearance: none;
				appearance: none;
				border: none;
				padding: 4px 10px;
			}

			.left,
			.right {
				display: flex;
				flex-direction: column;
				gap: 16px;
				min-width: 0;
			}

			.row-boxes {
				display: grid;
				grid-template-columns: 1fr 1fr;
				gap: 16px;
			}

			.na {
				opacity: 0.3;
			}
			.gray-text {
				opacity: 0.3;
				font-size: 7px;
			}
			.green-text {
				color: rgb(60, 189, 133);
				font-size: 7px;
			}
			.red-text {
				color: rgb(255, 69, 118);
				font-size: 7px;
			}
			.label {
				font-size: 7px;
			}

			.input-box {
				display: flex;
				flex-direction: column;
				gap: 23px;
				padding: 20px;
			}

			button:disabled svg {
				opacity: 1;
			}

			.edit-input::-webkit-outer-spin-button,
			.edit-input::-webkit-inner-spin-button {
				-webkit-appearance: none;
				margin: 0;
			}

			.edit-input {
				text-align: right;
			}

			form {
				display: grid;
				grid-template-columns: 1fr 1fr;
				gap: 10px;
				padding: 10px;
			}

			form button {
				grid-column: 2;
				justify-self: center;
				width: fit-content;
			}

			.field {
				display: flex;
				align-items: center;
				width: 220px;
				gap: 10px;
			}
			form input {
				width: 100%;
			}
			button.inactive span {
				opacity: 0.3;
			}

			button span {
				font-weight: 500;
			}
		`,
	];

	async loadData() {
		try {
			const rows = await window.api.getTicker(this.ticker);
			if (!rows || rows.length === 0) {
				this.data = {};
				this.allPeriods = [];
				this.periods = [];
				this.period = null;
				return;
			}

			this.data = this.buildObj(rows);

			this.allPeriods = Object.keys(this.data);
			this.period = this.allPeriods[this.allPeriods.length - 1];

			// produce this.periods
			this.applyPeriodFilter();
		} catch (err) {
			console.error('Failed to load ticker:', err);
			this.data = {};
			this.allPeriods = [];
			this.periods = [];
			this.period = null;
		} finally {
			this.loading = false;
		}
	}

	buildObj(rows) {
		const out = {};
		for (const row of rows) {
			const key = `${row.year}-${row.period_type}`;

			const { id, ticker, year, period_type, ...rest } = row;

			out[key] = getDerivedFields(rest);
		}

		return addChanges(out);
	}

	get financesLabels() {
		const lang = this.lang || 'EN';
		if (this._labelsCache.lang !== lang) {
			const all = getFinancesLabels(lang);
			this._labelsCache = {
				lang,
				all,
				sections: [
					all.slice(0, 6),
					all.slice(6, 18),
					all.slice(18, 24),
					all.slice(24, 27),
					all.slice(27, 30),
				],
			};
		}
		return this._labelsCache.all;
	}

	applyPeriodFilter() {
		const next = this.showYearlyOnly
			? this.allPeriods.filter((p) => /^\d{4}-Y$/.test(p)) // yearly only
			: [...this.allPeriods];

		// ensure there is always something
		this.periods = next;

		// current period no longer exists -> pick best fallback
		if (!this.periods.includes(this.period)) {
			const prev = this.period;
			const prevYear = prev ? prev.slice(0, 4) : null;
			const sameYearAnnual = prevYear ? `${prevYear}-Y` : null;

			if (sameYearAnnual && this.periods.includes(sameYearAnnual)) {
				this.period = sameYearAnnual;
			} else {
				// default to the latest available in whatever order we keep
				this.period = this.periods[this.periods.length - 1] ?? null;
			}
		}
	}

	filterYearly = () => {
		this.showYearlyOnly = !this.showYearlyOnly;
		this.applyPeriodFilter();
	};

	periodsForTTM() {
		if (!this.period) return [];
		const year = parseInt(this.period.slice(0, 4), 10);
		const kind = this.period.slice(5, 6);
		const num = parseInt(this.period.slice(6), 10);

		let prior = [];

		if (kind === 'Q') {
			// need the 3 prior quarters
			switch (num) {
				case 1:
					prior = [`${year - 1}-Q4`, `${year - 1}-Q3`, `${year - 1}-Q2`];
					break;
				case 2:
					prior = [`${year}-Q1`, `${year - 1}-Q4`, `${year - 1}-Q3`];
					break;
				case 3:
					prior = [`${year}-Q2`, `${year}-Q1`, `${year - 1}-Q4`];
					break;
				case 4:
					prior = [`${year}-Q3`, `${year}-Q2`, `${year}-Q1`];
					break;
				default:
					prior = [];
			}
		} else if (kind === 'S') {
			// need the 1 prior semester
			if (num === 1) prior = [`${year - 1}-S2`];
			else if (num === 2) prior = [`${year}-S1`];
		}

		// add current period at the beginning
		if (prior.length > 0) {
			prior.unshift(this.period);
		}

		return prior;
	}

	ttmAggregateSum() {
		const zeroAgg = Object.fromEntries(this.ttmFields.map((f) => [f, 0]));

		// ttm disabled
		if (!this.ttm) {
			this.ttmAggregate = zeroAgg;
			return;
		}

		const periods = this.periodsForTTM();

		// if not a TTM case
		if (periods.length === 0) {
			this.ttmAggregate = zeroAgg;
			return;
		}

		// validate all periods and all fields
		const allDataPresent = periods.every((p) => {
			const row = this.data[p];
			return (
				row &&
				this.ttmFields.every((f) => {
					const val = Number(row[f]);
					return Number.isFinite(val) && val !== 0; // treat 0 as falsy
				})
			);
		});

		if (!allDataPresent) {
			this.ttmAggregate = zeroAgg;
			return;
		}

		// compute the aggregate
		const aggregate = { ...zeroAgg };
		for (const p of periods) {
			const row = this.data[p];
			for (const f of this.ttmFields) {
				aggregate[f] += Number(row[f]);
			}
		}

		// update reactive property (Lit will re-render)
		this.ttmAggregate = aggregate;
	}

	async handleDelete() {
		try {
			if (this.periods.length === 1) {
				await window.api.deleteTicker(this.ticker);
				this.dispatchEvent(
					new CustomEvent('close', {
						bubbles: true,
						composed: true,
						detail: { deleted: true },
					})
				);
			} else {
				await window.api.deletePeriod(this.ticker, this.period);
				await this.loadData();
			}
		} catch (err) {
			console.error('handleDelete failed:', err);
			return false;
		}
	}

	handleDialog() {
		this.openEdition = !this.openEdition;

		if (!this.openEdition) {
			this.editData = {};
		} else {
			this.editData = Object.fromEntries(
				Object.entries(this.data[this.period]).filter(
					([key]) => key in constraints
				)
			);
		}
	}

	async handleEdit(e) {
		e?.preventDefault(); // prevent form submission reload

		try {
			const allValid = Object.entries(this.editData).every(([key, value]) =>
				validateEditedField(key, value)
			);

			if (!allValid) {
				throw new Error('Invalid data to edit');
			}

			const ok = await window.api.addFinances(
				this.ticker,
				this.period,
				this.editData
			);
			if (!ok) {
				throw new Error('Failed to save edited fields');
			}

			const currentPeriod = this.period;
			this.handleDialog();
			await this.loadData();
			this.period = currentPeriod;
		} catch (err) {
			console.error('handleEdit failed:', err);
			this.invalid = true;
			setTimeout(() => {
				this.invalid = false;
			}, 2000);
		}
	}

	copyJSON() {
		try {
			if (this.copied) return;

			const dataToCopy = {};
			const periodsDesc =
				this.periods?.toReversed?.() ?? [...this.periods].reverse(); // no mutation

			for (const period of periodsDesc) {
				const baseData = Object.fromEntries(
					Object.entries(this.data[period]).filter(
						([k]) => !k.endsWith('_change')
					)
				);

				let derivedRatios = calculateRatiosWithPrice(
					this.price,
					{ ...this.data[period] },
					this.ttmAggregate
				);

				derivedRatios = Object.fromEntries(
					Object.entries(derivedRatios).filter(([k]) => !k.endsWith('_change'))
				);

				const merged = { ...baseData, ...derivedRatios };
				const normalized = normalizeMetrics(merged);

				const prettyPeriod = prettifyPeriodKey(period);
				dataToCopy[prettyPeriod] = normalized; // inserted in reversed order (recent first)
			}

			const jsonString = JSON.stringify(dataToCopy, null, 2);
			if (window.api?.copyToClipboard) window.api.copyToClipboard(jsonString);
			else navigator.clipboard.writeText(jsonString);

			this.copied = true;
			setTimeout(() => (this.copied = false), 300);
		} catch (err) {
			console.error('Failed to copy data:', err);
		}
	}

	_fmt = {}; // locale -> formatters
	_labelsCache = { lang: null, all: null, sections: null };
	_priceRAF = null;
	_wperRAF = null;

	_getFormatters(locale) {
		let f = this._fmt[locale];
		if (f) return f;
		f = this._fmt[locale] = {
			int0: new Intl.NumberFormat(locale, {
				maximumFractionDigits: 0,
				useGrouping: true,
			}),
			float1: new Intl.NumberFormat(locale, {
				minimumFractionDigits: 1,
				maximumFractionDigits: 1,
				useGrouping: true,
			}),
			float2: new Intl.NumberFormat(locale, {
				minimumFractionDigits: 2,
				maximumFractionDigits: 2,
				useGrouping: true,
			}),
			percent2: new Intl.NumberFormat(locale, {
				minimumFractionDigits: 2,
				maximumFractionDigits: 2,
				useGrouping: true,
			}),
			percent0: new Intl.NumberFormat(locale, {
				maximumFractionDigits: 0,
				useGrouping: true,
			}),
		};
		return f;
	}

	_formatThousands(num, nf) {
		return nf.format(num / 1_000) + 'K';
	}
	_formatMillions(num, nf) {
		return nf.format(num / 1_000_000) + 'M';
	}

	displayValue(field, format, data = this.data, grayChange = false) {
		const locale = this.lang === 'ES' ? 'es-ES' : 'en-US';
		const F = this._getFormatters(locale);

		if (
			!data ||
			data[field] == null ||
			typeof data[field] !== 'number' ||
			isNaN(data[field])
		) {
			return html`<p class="na">NA</p>`;
		}

		const val = data[field];
		const changeKey = field + '_change';
		const change = data[changeKey];
		let changeHTML = html`<sub class="change gray-text">&nbsp;</sub>`;
		if (change) changeHTML = renderChange(change, locale, grayChange);

		// score: fixed 2 decimals
		if (field === 'score') {
			const formatted = F.float2.format(val);
			return html`<p>
				${changeHTML}<span class="value">${formatted}</span>
				<sub class="label gray-text">score</sub>
			</p>`;
		}

		// cap with K/M shorthands
		if (field === 'cap') {
			const abs = Math.abs(val);
			const formatted =
				abs >= 1_000_000_000
					? this._formatMillions(val, F.int0)
					: abs >= 1_000_000
					? this._formatMillions(val, F.float1)
					: abs >= 1_000
					? this._formatThousands(val, F.int0)
					: F.int0.format(val);

			return html`<p>
				${changeHTML}<span class="value">${formatted}</span>&nbsp;
				<sub class="gray-text">cap</sub>
			</p>`;
		}

		// explicit formats
		if (format === 'float') {
			return html`<p>
				${changeHTML}<span class="value">${F.float2.format(val)}</span>
			</p>`;
		} else if (format === 'percent-float') {
			return html`<p>
				${changeHTML}<span class="value">${F.percent2.format(val * 100)}%</span>
			</p>`;
		} else if (format === 'percent-int') {
			return html`<p>
				${changeHTML}<span class="value">${F.percent0.format(val * 100)}%</span>
			</p>`;
		}

		// default number w/ K/M
		const abs = Math.abs(val);
		const formatted =
			abs >= 1_000_000_000
				? this._formatMillions(val, F.int0)
				: abs >= 1_000_000
				? this._formatMillions(val, F.float2)
				: abs >= 1_000
				? this._formatThousands(val, F.int0)
				: F.int0.format(val);

		return html`<p>${changeHTML}<span class="value">${formatted}</span></p>`;
	}

	get derivedRatios() {
		if (!this.period || !this.data || !this.data[this.period]) {
			return {};
		}

		const current = calculateRatiosWithPrice(
			this.price,
			{ ...this.data[this.period] },
			this.ttmAggregate
		);

		const parts = this.period.split('-');
		if (parts.length !== 2) return current;

		const [yearStr, kind] = parts;
		const prevPeriod = `${Number(yearStr) - 1}-${kind}`;

		if (!this.data[prevPeriod]) return current;

		const prev = calculateRatiosWithPrice(
			this.price,
			{ ...this.data[prevPeriod] },
			this.ttmAggregate
		);

		return addRatiosChange(current, prev);
	}

	_onBack = () => {
		this.dispatchEvent(
			new CustomEvent('close', { bubbles: true, composed: true })
		);
	};

	_onToggleYearly = () => {
		this.filterYearly();
	};

	_onPrev = () => {
		const i = this.periods.indexOf(this.period);
		if (i > 0) this.period = this.periods[i - 1];
	};

	_onNext = () => {
		const i = this.periods.indexOf(this.period);
		if (i >= 0 && i < this.periods.length - 1)
			this.period = this.periods[i + 1];
	};

	_onPriceInput = (e) => {
		let v = e.target.value;

		v = v.replace(/[^0-9.]/g, '');
		const parts = v.split('.');
		if (parts.length > 2) v = parts[0] + '.' + parts.slice(1).join('');

		const digitsOnly = v.replace(/\D/g, '');
		if (digitsOnly.length > 5) {
			let count = 0;
			v = v
				.split('')
				.filter((ch) => (/\d/.test(ch) ? count++ < 5 : ch === '.'))
				.join('');
		}

		e.target.value = v;
		cancelAnimationFrame(this._priceRAF);
		this._priceRAF = requestAnimationFrame(() => {
			this.price = v;
		});
	};

	_onWishedPerInput = (e) => {
		let v = e.target.value.replace(/[^0-9]/g, '').slice(0, 3);
		e.target.value = v;
		cancelAnimationFrame(this._wperRAF);
		this._wperRAF = requestAnimationFrame(() => {
			this.wishedPer = v;
		});
	};

	renderEditableFields() {
		return html`
			${this.financesLabels
				.filter((row) => row.field in this.editData)
				.map((row) => {
					const key = row.field;
					const label = row.label;
					const value = this.editData[key];

					const { min, max } = constraints[key];
					const maxLength = String(Math.floor(Math.abs(max))).length;

					const isFloat = key === 'eps';
					const allowNegative = min < 0;

					const handleInput = (e) => {
						let inputVal = e.target.value;

						let regex;
						if (isFloat) {
							regex = allowNegative ? /^-?\d*(\.\d*)?$/ : /^\d*(\.\d*)?$/;
						} else {
							regex = allowNegative ? /^-?\d*$/ : /^\d*$/;
						}

						if (!regex.test(inputVal)) {
							inputVal = this.editData[key]?.toString() ?? '';
						}

						const numPart = inputVal.replace('-', '').split('.')[0];
						if (numPart.length > maxLength) {
							inputVal = this.editData[key]?.toString() ?? '';
						}

						let parsed = null;
						if (
							inputVal !== '' &&
							inputVal !== '-' &&
							inputVal !== '.' &&
							inputVal !== '-.'
						) {
							const n = Number(inputVal);
							if (!Number.isNaN(n)) {
								parsed = n;
							}
						}

						this.editData = {
							...this.editData,
							[key]: parsed,
						};

						e.target.value = inputVal;
					};

					return html`
						<div class="field">
							<label>${label}</label>
							<input
								class="edit-input"
								type="text"
								placeholder=${(typeof label === 'string'
									? label
									: label.strings?.join('') ?? key
								).replace(/<[^>]+>/g, '')}
								.value=${value ?? ''}
								maxlength=${maxLength +
								(allowNegative ? 1 : 0) +
								(isFloat ? 1 : 0)}
								@input=${handleInput}
							/>
						</div>
					`;
				})}
		`;
	}

	renderBox(slice, derived = this.derivedRatios) {
		const isOdd = slice.length % 2 !== 0;
		return html`
			<div class="box ${isOdd ? 'single-col' : 'two-col'}">
				${slice.map(
					(r) => html`
						<div class="row">
							<p>${r.label}</p>
							${this.displayValue(
								r.field,
								r.format,
								r.source === 'derivedRatios' ? derived : this.data[this.period],
								r.source === 'derivedRatios' ? true : false
							)}
						</div>
					`
				)}
			</div>
		`;
	}

	render() {
		if (this.loading) {
			return html` <div>${IconSpinner}</div>`;
		}

		const t = labels[this.lang || 'EN'];
		const derived = this.derivedRatios;
		this.financesLabels;
		const sections = this._labelsCache.sections;

		return html`
			<div class="ui-container">
				<button aria-label="Back" @click=${this._onBack}>
					<svg width="20" height="20" class="rot-270">${IconArrow}</svg>
				</button>

				<h1>${this.ticker} ${this.period}</h1>

				<button aria-label="Edit" @click=${this.handleDialog}>
					<svg width="20" height="20">${IconEdit}</svg>
				</button>

				<button
					aria-label="Yearly only"
					class=${!this.showYearlyOnly ? 'inactive' : ''}
					@click=${this._onToggleYearly}
				>
					<span>Y</span>
				</button>

				<button aria-label="Copy JSON" @click=${this.copyJSON}>
					${this.copied
						? html`<span class="icon-wrap">${IconCheck}</span>`
						: html`<svg width="20" height="20">${IconCopy}</svg>`}
				</button>

				<button aria-label="Delete" @click=${this.handleDelete}>
					<svg width="20" height="20">${IconTrash}</svg>
				</button>
			</div>

			<div class="boxes-layout">
				<!-- left side -->
				<div class="left">
					${this.renderBox(sections[0], derived)}
					${this.renderBox(sections[1], derived)}
				</div>

				<!-- right side -->
				<div class="right">
					<div class="box input-box">
						<div class="row row-left-aligned">
							<input
								id="price"
								type="text"
								.placeholder=${t.price}
								.value=${this.price ?? ''}
								@input=${this._onPriceInput}
							/>

							${this.displayValue('score', '', derived, false)}
							${this.displayValue('cap', '', derived, false)}
						</div>

						<div class="row row-left-aligned">
							<input
								id="wishedper"
								type="text"
								placeholder="w  P / E"
								.value=${this.wishedPer ?? ''}
								@input=${this._onWishedPerInput}
							/>

							<p>
								${priceForWhishedPer(
									this.wishedPer,
									this.data[this.period].eps,
									this.ttmAggregate.eps
								)}
							</p>

							<p>
								${incomeForWishedPER(
									this.price,
									this.wishedPer,
									this.data[this.period].shares,
									this.data[this.period].net_income,
									this.ttmAggregate.net_income,
									this.lang
								)}
							</p>
						</div>
					</div>

					${this.renderBox(sections[2], derived)}

					<div class="row-boxes">
						${this.renderBox(sections[3], derived)}
						${this.renderBox(sections[4], derived)}
					</div>
				</div>
			</div>

			<dialog-component
				?open=${this.openEdition}
				@dialog-closed=${this.handleDialog}
			>
				<form @submit=${this.handleEdit}>
					${this.renderEditableFields()}
					<button type="submit" ?disabled=${this.invalid}>
						${this.invalid
							? html`<svg width="20" height="20">${IconX}</svg>`
							: html`<svg width="20" height="20" class="rot-90">
									${IconArrow}
							  </svg>`}
					</button>
				</form>
			</dialog-component>

			<navigation-component
				.currentPage=${this.periods.indexOf(this.period)}
				.totalPages=${this.periods.length}
				@prev=${this._onPrev}
				@next=${this._onNext}
			></navigation-component>
		`;
	}
}

customElements.define('ticker-component', Ticker);
