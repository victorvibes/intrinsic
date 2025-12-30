import { LitElement, html, css } from 'lit';
import './lit-components/navigation.js';
import './menu.js';
import './settings.js';
import './ticker.js';
import { globalStyles } from './styles/global-css.js';
import { IconSpinner, iconStyles } from './styles/icons.js';
import { labels } from '../utils/labels.js';
import { applyAccent } from './styles/theme.js';
import { userDataStore } from '../utils/user-data-store.js';

(async function bootstrap() {
	const ud = await userDataStore.init();
	if (typeof ud.accent === 'string') applyAccent(ud.accent);
})();

userDataStore.subscribe((ud) => {
	if (typeof ud.accent === 'string') applyAccent(ud.accent);
});

export class Tickers extends LitElement {
	static properties = {
		tickers: { type: Array },
		currentPage: { type: Number },
		totalPages: { type: Number },
		pageSize: { type: Number },
		loading: { type: Boolean },
		openedTicker: { type: String },
		lang: { type: String },
		sortBy: { type: String },
		sortOrder: { type: String },
	};

	constructor() {
		super();
		this.tickers = [];
		this.currentPage = 0;
		this.totalPages = 1;
		this.pageSize = 20;
		this.loading = true;
		this.openedTicker = null;
		this.lang = 'EN';
		this.sortBy = 'Sub';
		this.sortOrder = 'Desc';
		this._tickerMeta = new Map();
	}

	connectedCallback() {
		super.connectedCallback();

		this._udUnsub = userDataStore.subscribe((ud) => {
			if (typeof ud.lang === 'string') this.lang = ud.lang;

			let needsResort = false;
			if (typeof ud.sortBy === 'string' && ud.sortBy !== this.sortBy) {
				this.sortBy = ud.sortBy;
				needsResort = true;
			}
			if (typeof ud.sortOrder === 'string' && ud.sortOrder !== this.sortOrder) {
				this.sortOrder = ud.sortOrder;
				needsResort = true;
			}
			if (needsResort) this.applySort();
		});

		this.loadComponentData();
	}

	disconnectedCallback() {
		super.disconnectedCallback();
		this._udUnsub?.();
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
			}

			#tickers-container {
				--cols: 4;
				--rows: 5;
				--gap: 10px;
				--pad: 26px;
				--cell: 38px;

				display: grid;
				place-items: center;
				width: 100%;
				max-width: 700px;
				margin: 0 auto;
				padding: var(--pad) 20px;

				height: calc(
					var(--rows) * var(--cell) + (var(--rows) - 1) * var(--gap) + 2 *
						var(--pad)
				);
				background: rgba(200, 200, 200, 0.15);
				backdrop-filter: blur(10px);
				-webkit-backdrop-filter: blur(10px);
				border-radius: 15px;
				box-shadow: 0 0 20px rgba(0, 0, 0, 0.1);
				-webkit-app-region: no-drag;
				z-index: 10;
			}

			#list {
				height: 100%;
				padding: 0;
				display: grid;
				grid-template-columns: repeat(var(--cols), 1fr);
				grid-template-rows: repeat(var(--rows), 1fr);
				gap: var(--gap);
				width: 100%;
			}

			#list li {
				display: flex;
				align-items: center;
				justify-content: center;
				border-radius: 10px;
			}

			button {
				font-weight: 500;
				font-size: 15px;
				letter-spacing: 1.5px;
				height: 100%;
				width: 100%;
			}

			#empty {
				margin: 0 auto;
				text-align: center;
				letter-spacing: 1.5px;
			}
		`,
	];

	async loadComponentData() {
		try {
			const count = await window.api.getTickersCount();
			if (!count) {
				this.tickers = [];
				this.totalPages = 1;
				this.loading = false;
				return;
			}
			this.totalPages = Math.max(1, Math.ceil(count / this.pageSize));
			this.currentPage = 0;
			await this.loadTickers(0, true);
		} catch (err) {
			console.error('Failed to load tickers:', err);
			this.tickers = [];
			this.totalPages = 1;
		} finally {
			this.loading = false;
		}
	}

	async loadTickers(index, firstLoad) {
		if (firstLoad) this.loading = true;
		this.currentPage = index;

		const rows = await window.api.getTickers(index, this.pageSize);

		this._tickerMeta = new Map(
			rows.map((r) => {
				const t = typeof r === 'string' ? r : r.ticker;
				const lu = typeof r === 'string' ? undefined : r.last_update;
				const ts = lu ? Date.parse(lu) || 0 : 0;
				return [t, ts];
			})
		);
		this.tickers = rows.map((r) => (typeof r === 'string' ? r : r.ticker));

		this.applySort();
		this.loading = false;
	}

	applySort() {
		if (!Array.isArray(this.tickers) || this.tickers.length <= 1) return;

		const sortBy = this.sortBy || 'Sub';
		const sortOrder = this.sortOrder || 'Desc';
		const arr = [...this.tickers];

		const cmpTickerASC = (a, b) => {
			const ta = (a ?? '').toString().toUpperCase();
			const tb = (b ?? '').toString().toUpperCase();
			if (ta < tb) return -1;
			if (ta > tb) return 1;
			return 0;
		};

		if (sortBy === 'Sub') {
			arr.sort((a, b) => {
				const la = this._tickerMeta.get(a) ?? 0;
				const lb = this._tickerMeta.get(b) ?? 0;
				if (la !== lb) return sortOrder === 'Asc' ? la - lb : lb - la;
				return cmpTickerASC(a, b);
			});
		} else {
			arr.sort((a, b) => {
				const base = cmpTickerASC(a, b);
				return sortOrder === 'Asc' ? base : -base;
			});
		}

		this.tickers = arr;
	}

	render() {
		const t = labels[this.lang || 'EN'];

		if (this.loading) {
			return html` <div id="tickers-container">${IconSpinner}</div>`;
		} else if (this.openedTicker) {
			// ticker view
			return html`<ticker-component
				.ticker=${this.openedTicker}
				@close=${(e) => {
					this.openedTicker = null;
					if (e.detail?.deleted) {
						this.loadComponentData();
					}
				}}
			></ticker-component>`;
		} else {
			// main page
			return html`
				<menu-component
					@submission-success=${() => this.loadComponentData()}
				></menu-component>

				<div id="tickers-container">
					${this.tickers.length === 0
						? html`<p id="empty">${t.emptyMessage}</p>`
						: html`
								<ul id="list">
									${this.tickers.map(
										(tick) =>
											html`<li>
												<button @click=${() => (this.openedTicker = tick)}>
													${tick}
												</button>
											</li>`
									)}
								</ul>
						  `}
				</div>

				<navigation-component
					.currentPage=${this.currentPage}
					.totalPages=${this.totalPages}
					@prev=${() => this.loadTickers(this.currentPage - 1, false)}
					@next=${() => this.loadTickers(this.currentPage + 1, false)}
				></navigation-component>
			`;
		}
	}
}

customElements.define('tickers-component', Tickers);
