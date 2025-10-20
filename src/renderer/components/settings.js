import { LitElement, html, css } from 'lit';
import { globalStyles } from './styles/global-css.js';
import {
	IconInput,
	IconNuke,
	IconX,
	IconCheck,
	IconSliders,
} from './styles/icons.js';
import './lit-components/dialog.js';
import { userDataStore } from './utils/user-data-store.js';
import { ACCENT_PALETTE } from './styles/theme.js';
import { labels } from '../utils/labels.js';
import { AI_STRUCTURED_MODELS } from './utils/ai.js';

export class SettingsDialog extends LitElement {
	static properties = {
		open: { type: Boolean, reflect: true },
		stateView: { type: String },
		lang: { type: String },
		ttm: { type: Boolean },
		accent: { type: String },
		absPath: { type: String },
		rawPath: { type: String },
		hasKey: { type: Boolean },
		provider: { type: String },
		model: { type: String },
		sortBy: { type: String },
		sortOrder: { type: String },
		localVersion: { type: String },
		remoteVersion: { type: String },
	};

	constructor() {
		super();
		this.open = false;
		this.stateView = 'default';
		this.lang = 'EN';
		this.ttm = true;
		this.accent = 'rgba(65, 102, 245, 0.3)';
		this.provider = 'openai';
		this.model = 'gpt-5-mini';
		this.absPath = '';
		this.rawPath = '';
		this.hasKey = false;
		this._updateKey = false;
		this.sortBy = 'Sub';
		this.sortOrder = 'Desc';
		this.localVersion = '';
		this.remoteVersion = '';
	}

	connectedCallback() {
		super.connectedCallback();
		this._udUnsub = userDataStore.subscribe((ud) => {
			if (typeof ud.lang === 'string') this.lang = ud.lang;
			if (typeof ud.ttm === 'boolean') this.ttm = ud.ttm;
			if (typeof ud.accent === 'string') this.accent = ud.accent;
			if (typeof ud.provider === 'string') this.provider = ud.provider;
			if (typeof ud.model === 'string') this.model = ud.model;
			if (typeof ud.filewriter_abs_path === 'string')
				this.absPath = ud.filewriter_abs_path;
			if (typeof ud.filewriter_raw_abs_path === 'string')
				this.rawPath = ud.filewriter_raw_abs_path;
			if (typeof ud.sortBy === 'string') this.sortBy = ud.sortBy;
			if (typeof ud.sortOrder === 'string') this.sortOrder = ud.sortOrder;
		});
	}

	disconnectedCallback() {
		super.disconnectedCallback();
		this._udUnsub?.();
	}

	async firstUpdated() {
		try {
			const { local, remote } = await window.api.app.getVersion();
			this.localVersion = local;
			this.remoteVersion = remote;
		} catch (err) {
			console.error('Failed to get app version:', err);
		}
	}

	updated(changed) {
		if (changed.has('open') && this.open === false) {
			this.stateView = 'default';
		}
		if (changed.has('stateView') && this.stateView === 'userData') {
			this._updateKey = false;
			this.refreshHasKey();
		}
	}

	async refreshHasKey() {
		const keyName = `STRUCTURED_AI_${String(
			this.provider
		).toUpperCase()}_API_KEY`;
		try {
			this.hasKey = !!(await window.api.secrets.has(keyName));
		} catch {
			this.hasKey = false;
		}
	}

	static styles = [
		globalStyles,
		css`
			.settings-wrapper {
				display: flex;
				align-items: center;
				justify-content: center;
				min-height: 110px;
				min-width: 400px;
				gap: 20px;
			}
			.settings-btn {
				font-weight: 400;
				letter-spacing: 1px;
			}
			.icon-wrap {
				width: 25px;
				height: 25px;
				display: inline-block;
			}

			.dialog-body {
				position: relative;
				padding: 30px;
			}

			.back-btn {
				position: absolute;
				top: 0.5rem;
				left: 0.5rem;
			}

			.icon-wrap > svg {
				width: 100% !important;
				height: 100% !important;
				display: block;
			}

			.horizontal-box {
				display: flex;
				gap: 20px;
				justify-content: center;
			}

			p {
				letter-spacing: 1px;
			}

			.disabled {
				opacity: 0.3;
			}

			.color-picker {
				width: 20px;
				height: 20px;
				border-radius: 5px;
				background: var(--accent);
				border: 1.5px solid black;
			}

			.settings,
			.toggle-settings {
				display: flex;
				flex-direction: column;
				gap: 20px;
				text-align: center;
			}

			.settings-fields {
				display: flex;
				flex-direction: column;
				gap: 15px;
				text-align: left;
			}

			input,
			select {
				width: 220px;
				padding: 8px 10px;
				border: none;
				font-size: 15px;
				border-radius: 6px;
				letter-spacing: 1px;
				box-sizing: border-box;
				font-family: inherit;
			}

			.version-btn {
				width: 80px;
				display: flex;
				justify-content: center;
				align-items: center;
				margin: 0;
			}

			.version-btn .icon-wrap {
				width: auto;
				height: auto;
				display: flex;
				align-items: center;
				justify-content: center;
				line-height: 1;
			}
		`,
	];

	toggleSortBy = () => {
		const next = this.sortBy === 'Sub' ? 'A-Z' : 'Sub';
		userDataStore.update({ sortBy: next });
	};

	toggleSortOrder = () => {
		const next = this.sortOrder === 'Asc' ? 'Desc' : 'Asc';
		userDataStore.update({ sortOrder: next });
	};

	toggleLang() {
		const next = this.lang === 'EN' ? 'ES' : 'EN';
		userDataStore.update({ lang: next });
	}

	toggleTTM() {
		userDataStore.update({ ttm: !this.ttm });
	}

	toggleColor = () => {
		const idx = Math.max(0, ACCENT_PALETTE.indexOf(this.accent));
		const next = ACCENT_PALETTE[(idx + 1) % ACCENT_PALETTE.length];
		userDataStore.update({ accent: next });
		// main.js store subscription triggers applyAccent globally
	};

	_compareSemver(a = '', b = '') {
		// returns -1 if a<b, 0 if equal, 1 if a>b
		const pa = a.split('.').map((n) => parseInt(n, 10) || 0);
		const pb = b.split('.').map((n) => parseInt(n, 10) || 0);
		const len = Math.max(pa.length, pb.length);
		for (let i = 0; i < len; i++) {
			const x = pa[i] ?? 0;
			const y = pb[i] ?? 0;
			if (x > y) return 1;
			if (x < y) return -1;
		}
		return 0;
	}

	// Convenience getter:
	get _updateAvailable() {
		if (!this.remoteVersion) return false; // no info -> don’t nag
		return this._compareSemver(this.localVersion, this.remoteVersion) < 0;
	}

	async updateUserDataInputFields() {
		const $ = (sel) => this.renderRoot?.querySelector(sel);

		const provider = $('#provider')?.value ?? this.provider;
		const model = $('#model')?.value ?? this.model;
		const absPath = $('#absPath')?.value?.trim() ?? this.absPath;
		const rawPath = $('#rawPath')?.value?.trim() ?? this.rawPath;

		const keyName = `STRUCTURED_AI_${String(provider).toUpperCase()}_API_KEY`;
		const apiEl = $('#apiKey');
		const apiKey = apiEl?.value?.trim() ?? '';

		try {
			// only touch secret if field was interacted with
			if (this._updateKey) {
				// Empty string = user cleared field -> delete key
				await window.api.secrets.set(keyName, apiKey);
			}

			// persist userData via store (backend normalizes paths)
			await userDataStore.update({
				provider,
				model,
				filewriter_abs_path: absPath,
				filewriter_raw_abs_path: rawPath,
			});

			// refresh hasKey & clear password field
			this.hasKey = !!(await window.api.secrets.has(keyName));
			if (apiEl) apiEl.value = '';
			this._updateKey = false;

			// sync local fields
			this.provider = provider;
			this.model = model;
			this.absPath = absPath;
			this.rawPath = rawPath;

			this.stateView = 'default';
		} catch (e) {
			console.error('Failed to update userData settings:', e);
		}
	}

	renderState() {
		const t = labels[this.lang || 'EN'];

		switch (this.stateView) {
			case 'sort':
				return html`
					<section class="toggle-settings">
						<div class="horizontal-box">
							<button
								aria-label="Sort by"
								class="settings-btn sort-btn"
								@click=${this.toggleSortBy}
							>
								${this.sortBy}
							</button>

							<button
								aria-label="Sort order"
								class="settings-btn sort-btn"
								@click=${this.toggleSortOrder}
							>
								${this.sortOrder}
							</button>
						</div>

						<div class="horizontal-box">
							<button
								aria-label="TTM Mode"
								class="settings-btn"
								@click=${this.toggleTTM}
							>
								${this.ttm
									? html`<p>TTM</p>`
									: html`<p class="disabled">TTM</p>`}
							</button>

							<button
								aria-label="Language"
								class="settings-btn"
								@click=${this.toggleLang}
							>
								${this.lang}
							</button>
						</div>
						<div class="horizontal-box">
							<button @click=${() => (this.stateView = 'default')}>
								<span class="icon-wrap">${IconCheck}</span>
							</button>
						</div>
					</section>
				`;

			case 'userData':
				return html`
					<section class="settings">
						<div class="settings-fields">
							<label>
								<select id="provider" .value=${this.provider}>
									${Object.entries(AI_STRUCTURED_MODELS).map(
										([providerKey, providerData]) => html`
											<option value=${providerKey}>${providerData.key}</option>
										`
									)}
								</select>
							</label>

							<label>
								<select id="model" .value=${this.model}>
									${(AI_STRUCTURED_MODELS[this.provider]?.models ?? []).map(
										(model) => html`<option value=${model}>${model}</option>`
									)}
								</select>
							</label>

							<label>
								<input
									id="apiKey"
									type="password"
									placeholder=${this.hasKey ? '••••••••' : 'API key'}
									autocomplete="off"
									@focus=${(e) => {
										this._updateKey = true;
										if (this.hasKey) {
											e.target.value = '';
											e.target.placeholder = 'API key';
										}
									}}
								/>
							</label>

							<label>
								<input
									id="absPath"
									type="text"
									.value=${this.absPath}
									placeholder="eg: ~/Desktop/intrinsic"
								/>
							</label>

							<label>
								<input
									id="rawPath"
									type="text"
									.value=${this.rawPath}
									placeholder="(raw) eg: ~/Desktop/raw"
								/>
							</label>
						</div>
						<div class="horizontal-box">
							<button @click=${() => (this.stateView = 'default')}>
								${IconX}
							</button>
							<button @click=${this.updateUserDataInputFields}>
								<span class="icon-wrap">${IconCheck}</span>
							</button>
						</div>
					</section>
				`;

			case 'version': {
				const needsUpdate = this._updateAvailable;

				return html`
					<div class="version-view">
						${needsUpdate
							? html`
									<p>
										${t.vNeedsUpdate}
										${this.remoteVersion
											? html`(<b>${this.remoteVersion}</b>)`
											: ''}
									</p>
									<div class="horizontal-box">
										<button
											@click=${() => (this.stateView = 'default')}
											title=${labels.cancel ?? 'Cancel'}
										>
											${IconX}
										</button>

										<button
											@click=${async () => {
												try {
													await window.api.app.updateVersion();
												} finally {
													this.stateView = 'default';
												}
											}}
											title=${labels.updateNow ?? 'Update'}
										>
											<span class="icon-wrap">${IconCheck}</span>
										</button>
									</div>
							  `
							: html`
									<p>${t.vDoesntNeedUpdate} ${this.localVersion}</p>
									<div class="horizontal-box">
										<button
											@click=${() => (this.stateView = 'default')}
											title=${labels.ok ?? 'OK'}
										>
											<span class="icon-wrap">${IconCheck}</span>
										</button>
									</div>
							  `}
					</div>
				`;
			}

			case 'nuke':
				return html`
					<p>${t.nuke1}</p>
					<p>${t.nuke2}</p>
					<div class="horizontal-box">
						<button @click=${() => (this.stateView = 'default')}>
							${IconX}
						</button>
						<button @click=${() => window.api.app.nuke()}>
							<span class="icon-wrap">${IconNuke}</span>
						</button>
					</div>
				`;

			default:
				return html`
					<div class="settings-wrapper">
						<button
							aria-label="Sort"
							class="settings-btn"
							@click=${() => (this.stateView = 'sort')}
						>
							<span class="icon-wrap">${IconSliders}</span>
						</button>

						<button
							aria-label="userData Settings"
							class="settings-btn"
							@click=${() => (this.stateView = 'userData')}
						>
							<span class="icon-wrap">${IconInput}</span>
						</button>

						<button
							aria-label="Color Picker"
							class="settings-btn"
							@click=${this.toggleColor}
						>
							<div class="color-picker"></div>
						</button>

						<button
							aria-label="Version"
							class="settings-btn version-btn"
							@click=${() => (this.stateView = 'version')}
						>
							<span class="icon-wrap">v${this.localVersion}</span>
						</button>

						<button
							aria-label="Nuke"
							class="settings-btn"
							@click=${() => (this.stateView = 'nuke')}
						>
							<span class="icon-wrap">${IconNuke}</span>
						</button>
					</div>
				`;
		}
	}

	render() {
		return html`
			<dialog-component
				?open=${this.open}
				@dialog-closed=${() => this.dispatchEvent(new CustomEvent('close'))}
			>
				<div class="dialog-body">${this.renderState()}</div>
			</dialog-component>
		`;
	}
}

customElements.define('settings-dialog', SettingsDialog);
