import { LitElement, html, css } from 'lit';
import { pipeline } from '../pipeline/pipeline.js';
import {
	IconX,
	IconArrow,
	IconFile,
	IconSpinner,
	iconStyles,
	IconSettings,
} from './styles/icons.js';
import { globalStyles } from './styles/global-css.js';
import { labels } from '../utils/labels.js';
import './lit-components/dialog.js';
import './settings.js';
import { userDataStore } from './utils/user-data-store.js';

export class Menu extends LitElement {
	static properties = {
		submissionOpen: { type: Boolean, reflect: true },
		settingsOpen: { type: Boolean, reflect: true },
		ticker: { type: String },
		period: { type: String },
		start: { type: String },
		end: { type: String },
		source: { type: String },
		sourcePath: { type: String },
		busy: { type: Boolean },
		fileSpinner: { type: Boolean },
		invalid: { type: Boolean },
		lang: { type: String },
		ttm: { type: Boolean },
		sortBy: { type: String },
		sortOrder: { type: String },
	};

	constructor() {
		super();
		this.submissionOpen = false;
		this.settingsOpen = false;
		this.ticker = '';
		this.period = '';
		this.start = '';
		this.end = '';
		this.source = '';
		this.sourcePath = '';
		this.busy = false;
		this.fileSpinner = false;
		this.invalid = false;
		this.uiBlocked = false;
		this.lang = 'EN';
		this.ttm = true;
		this.sortBy = 'Sub';
		this.sortOrder = 'Desc';
	}

	connectedCallback() {
		super.connectedCallback();
		this._udUnsub = userDataStore.subscribe((ud) => {
			if (typeof ud.lang === 'string') this.lang = ud.lang;
			if (typeof ud.ttm === 'boolean') this.ttm = ud.ttm;
			if (typeof ud.sortBy === 'string') this.sortBy = ud.sortBy;
			if (typeof ud.sortOrder === 'string') this.sortOrder = ud.sortOrder;
		});
	}

	disconnectedCallback() {
		super.disconnectedCallback();
		this._udUnsub?.();
	}

	static styles = [
		globalStyles,
		iconStyles,
		css`
			form {
				pointer-events: auto;
				margin: 0;
				display: flex;
				gap: 20px;
				align-items: center;
				background: transparent;
				padding: 15px 20px;
			}

			input {
				height: 30px;
				letter-spacing: 1px;
				border-radius: 10px;
				background-color: transparent;
				-webkit-appearance: none;
				appearance: none;
				border: none;
				padding: 4px 10px;
			}

			.vertical {
				display: flex;
				flex-direction: column;
				gap: 5px;
			}
			input#ticker,
			input#source {
				width: 150px;
			}
			input#period {
				width: 60px;
			}

			input#start-page,
			input#end-page {
				width: 38px;
			}

			button:disabled svg {
				opacity: 1;
			}

			.ui-blocker {
				position: fixed;
				top: 0;
				left: 0;
				right: 0;
				bottom: 0;
				background: transparent;
				z-index: 9999;
				cursor: default;
				-webkit-app-region: drag;
			}
		`,
	];

	// --- Sanitizers ---
	sanitizeTicker = (s) =>
		s
			.replace(/[^A-Za-z0-9.]/g, '')
			.replace(/\.{2,}/g, '.')
			.toUpperCase()
			.slice(0, 12);

	sanitizePage = (s) => s.replace(/\D/g, '').replace(/^0+/, '').slice(0, 4);

	sanitizeSource = (s) => s.replace(/^\s+/, '').slice(0, 4096);

	sanitizePeriod = (newStr, oldStr = '') => {
		let s = (newStr || '').toUpperCase();
		if (!s) return '';

		if (oldStr && s.length < oldStr.length) {
			if (oldStr.endsWith('-') && s.length === 4) s = s.slice(0, 3);
		}

		let chars = s.split('');

		for (let i = 0; i < chars.length && i < 4; i++) {
			if (!/[0-9]/.test(chars[i])) {
				chars.splice(i, 1);
				i--;
			}
		}
		if (chars.length > 4 && chars[4] !== '-') chars.splice(4);
		if (chars.length > 5 && !/[SQY]/.test(chars[5])) chars.splice(5);

		if (chars.length > 6) {
			if (chars[5] === 'Y') {
				chars.splice(6);
			} else if (chars[5] === 'S') {
				if (!/[1-2]/.test(chars[6])) chars.splice(6);
			} else if (chars[5] === 'Q') {
				if (!/[1-4]/.test(chars[6])) chars.splice(6);
			}
		}

		if (chars.length === 4 && chars.every((c) => /\d/.test(c))) chars.push('-');
		return chars.join('');
	};

	firstUpdated() {
		const attachSanitizer = (el, sanitize, maxLen, needsOld = false) => {
			if (!el) return;
			if (maxLen) el.setAttribute('maxlength', String(maxLen));
			let lastVal = el.value || '';
			el.addEventListener('input', () => {
				const pos = el.selectionStart ?? el.value.length;
				const before = el.value.slice(0, pos);

				const full = needsOld
					? sanitize(el.value, lastVal)
					: sanitize(el.value);
				const beforeSan = needsOld
					? sanitize(before, lastVal)
					: sanitize(before);

				if (el.value !== full) {
					el.value = full;
					const newPos = Math.min(beforeSan.length, full.length);
					try {
						el.setSelectionRange(newPos, newPos);
					} catch {}
				}
				lastVal = el.value;

				// sync back to property
				if (el.id === 'ticker') this.ticker = el.value;
				if (el.id === 'period') this.period = el.value;
				if (el.id === 'start-page') this.start = el.value;
				if (el.id === 'end-page') this.end = el.value;
				if (el.id === 'source') this.source = el.value;
			});
		};

		attachSanitizer(
			this.renderRoot.querySelector('#ticker'),
			this.sanitizeTicker,
			12
		);
		attachSanitizer(
			this.renderRoot.querySelector('#start-page'),
			this.sanitizePage,
			4
		);
		attachSanitizer(
			this.renderRoot.querySelector('#end-page'),
			this.sanitizePage,
			4
		);
		attachSanitizer(
			this.renderRoot.querySelector('#source'),
			this.sanitizeSource,
			4096
		);
		attachSanitizer(
			this.renderRoot.querySelector('#period'),
			this.sanitizePeriod,
			7,
			true
		);
	}

	// ------------------

	handleDialog(dialog) {
		if (dialog === 'submission') {
			this.submissionOpen = !this.submissionOpen;

			if (!this.submissionOpen) {
				this.ticker = '';
				this.period = '';
				this.start = '';
				this.end = '';
				this.source = '';
				this.sourcePath = '';
				this.busy = false;
				this.fileSpinner = false;
				this.invalid = false;
			}
		} else {
			this.settingsOpen = !this.settingsOpen;
		}
	}

	async pickFile(e) {
		e.preventDefault();
		e.stopPropagation();

		this.fileSpinner = true;
		setTimeout(() => {
			this.fileSpinner = false;
		}, 1000);

		const filePath = await window.api.selectFile();
		if (filePath) {
			this.sourcePath = filePath;
			let fileName = filePath.split(/[/\\]/).pop();
			if (fileName.length > 15) fileName = '...' + fileName.slice(-12);
			this.source = fileName;
		}
	}

	async submit(e) {
		e.preventDefault();
		if (this.busy || this.invalid) return;

		const periodOk = /^\d{4}-(?:Y|Q[1-4]|S[1-2])$/.test(this.period);
		if (!this.ticker || !this.source || !periodOk) {
			this.invalid = true;
			setTimeout(() => {
				this.invalid = false;
			}, 2000);
			return;
		}

		this.busy = true;
		this.uiBlocked = true;

		const params = {
			ticker: this.ticker,
			period: this.period,
			start: this.start,
			end: this.end,
			source: this.sourcePath || this.source,
			isurl: !this.sourcePath,
		};

		const ok = await pipeline(params);

		this.busy = false;
		this.uiBlocked = false;

		if (!ok) {
			this.invalid = true;
			setTimeout(() => {
				this.invalid = false;
			}, 2000);
		} else {
			this.dispatchEvent(
				new CustomEvent('submission-success', {
					bubbles: true, // let it bubble up to parent
					composed: true, // cross shadow DOM boundary
				})
			);
			this.handleDialog('submission');
		}
	}

	render() {
		const t = labels[this.lang || 'EN'];

		return html`
			<div class="ui-container">
				<button aria-label="Shutdown" @click=${() => window.api.app.shutdown()}>
					<svg width="20" height="20">${IconX}</svg>
				</button>

				<button
					aria-label="Settings"
					@click=${() => this.handleDialog('settings')}
				>
					<svg width="20" height="20">${IconSettings}</svg>
				</button>

				<button
					aria-label="Add"
					@click=${() => this.handleDialog('submission')}
				>
					<svg width="20" height="20" class="rot-45">${IconX}</svg>
				</button>
			</div>

			<settings-dialog
				.open=${this.settingsOpen}
				.lang=${this.lang}
				.ttm=${this.ttm}
				.sortBy=${this.sortBy}
				.sortOrder=${this.sortOrder}
				@close=${() => this.handleDialog('settings')}
			></settings-dialog>

			<dialog-component
				?open=${this.submissionOpen}
				@dialog-closed=${() => this.handleDialog('submission')}
			>
				<form @submit=${this.submit}>
					<input
						id="ticker"
						type="text"
						placeholder="Ticker"
						.value=${this.ticker}
					/>
					<input
						id="period"
						type="text"
						.placeholder=${t.period}
						.value=${this.period}
					/>
					<div class="vertical">
						<input
							id="start-page"
							type="text"
							.placeholder=${t.start}
							.value=${this.start}
						/>
						<input
							id="end-page"
							type="text"
							.placeholder=${t.end}
							.value=${this.end}
						/>
					</div>
					<input
						id="source"
						type="text"
						.placeholder=${t.source}
						.value=${this.source}
						@input=${(e) => (this.source = this.sanitizeSource(e.target.value))}
						@focus=${(e) => {
							if (this.sourcePath) {
								this.source = '';
								this.sourcePath = '';
								e.target.value = '';
							}
						}}
					/>
					<button type="button" @click=${this.pickFile}>
						${this.fileSpinner
							? IconSpinner
							: html`<svg width="20" height="20">${IconFile}</svg>`}
					</button>
					<button type="submit" ?disabled=${this.busy || this.invalid}>
						${this.invalid
							? html`<svg width="20" height="20">${IconX}</svg>`
							: this.busy
							? IconSpinner
							: html`<svg width="20" height="20" class="rot-90">
									${IconArrow}
							  </svg>`}
					</button>
				</form>
			</dialog-component>

			${this.uiBlocked
				? html`<div id="ui-blocker" class="ui-blocker"></div>`
				: null}
		`;
	}
}

customElements.define('menu-component', Menu);
