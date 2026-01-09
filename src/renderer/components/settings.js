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
import { userDataStore } from '../utils/user-data-store.js';
import { ACCENT_PALETTE } from './styles/theme.js';
import { labels } from '../utils/labels.js';
import { AI_STRUCTURED_MODELS } from '../utils/ai.js';

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
		updating: { type: Boolean },
		updateErr: { type: Boolean },
		_providerOpen: { type: Boolean },
		_modelOpen: { type: Boolean },
	};

	constructor() {
		super();
		this.open = false;
		this.stateView = 'default';
		this.lang = 'EN';
		this.ttm = true;
		this.accent = 'rgba(255, 255, 255, 0.3)';
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
		this.updating = false;
		this.updateErr = false;
		this._providerOpen = false;
		this._modelOpen = false;
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

		this._onGlobalPointerDown = (event) => {
			if (!this._providerOpen && !this._modelOpen) return;

			const path = event.composedPath();
			const root = this.renderRoot;

			const isInsideDropdown = path.some(
				(node) =>
					node instanceof HTMLElement &&
					root.contains(node) &&
					node.closest('.dropdown')
			);

			const isDropdownItem = path.some(
				(node) =>
					node instanceof HTMLElement &&
					root.contains(node) &&
					node.classList?.contains('dropdown-item')
			);

			// close when:
			// - click is outside dropdown
			// - click is on a dropdown item
			if (!isInsideDropdown || isDropdownItem) {
				this._providerOpen = false;
				this._modelOpen = false;
			}
		};

		window.addEventListener('click', this._onGlobalPointerDown);
	}

	disconnectedCallback() {
		super.disconnectedCallback();
		this._udUnsub?.();
		if (this._onGlobalPointerDown) {
			window.removeEventListener('click', this._onGlobalPointerDown);
			this._onGlobalPointerDown = null;
		}
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
			const persisted = userDataStore.get().model;
			if (typeof persisted === 'string') {
				this.model = persisted;
			}

			this.stateView = 'default';
			this._providerOpen = false;
			this._modelOpen = false;
		}
		if (changed.has('stateView') && this.stateView === 'userData') {
			this._updateKey = false;
			this._providerOpen = false;
			this._modelOpen = false;
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

			.status-text {
				font-weight: 400;
				font-size: 15px;
				letter-spacing: 1px;
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

			.dropdown {
				position: relative;
				width: 220px;
			}

			.dropdown-toggle {
				width: 100%;
				padding: 8px 10px;
				border: none;
				border-radius: 6px;
				font-size: 15px;
				letter-spacing: 1px;
				font-weight: 400;
				box-sizing: border-box;
				font-family: inherit;
				display: flex;
				align-items: center;
				justify-content: space-between;
				cursor: pointer;
			}

			.dropdown-menu {
				position: absolute;
				top: 100%;
				left: 0;
				right: 0;
				padding: 0;
				margin-top: 4px;
				background: #fff;
				border-radius: 6px;
				box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
				max-height: 220px;
				overflow-y: auto;
				z-index: 10;
			}

			.dropdown-item {
				padding: 8px 10px;
				cursor: pointer;
				font-size: 14px;
				list-style: none;
				font-weight: 400;
				letter-spacing: 1px;
			}

			.dropdown-item:hover {
				background: rgba(0, 0, 0, 0.06);
				border-radius: 4px;
			}

			.dropdown-item.selected {
				font-weight: 400;
			}

			.dropdown-chevron {
				margin-left: 8px;
				font-size: 11px;
			}
			.dropdown-toggle.open {
				box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15),
					inset 0 1px 1px rgba(255, 255, 255, 0.3);
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

	// convenience getter:
	get _updateAvailable() {
		if (!this.remoteVersion) return false; // no info -> don’t nag
		return this._compareSemver(this.localVersion, this.remoteVersion) < 0;
	}

	async updateUserDataInputFields() {
		const $ = (sel) => this.renderRoot?.querySelector(sel);

		this._providerOpen = false;
		this._modelOpen = false;

		const provider = this.provider;
		const model = this.model;

		const absPath = $('#absPath')?.value?.trim() ?? this.absPath;
		const rawPath = $('#rawPath')?.value?.trim() ?? this.rawPath;

		const keyName = `STRUCTURED_AI_${String(provider).toUpperCase()}_API_KEY`;
		const apiEl = $('#apiKey');
		const apiKey = apiEl?.value?.trim() ?? '';

		try {
			// only touch secret if field was interacted with
			if (this._updateKey) {
				// empty string = user cleared field -> delete key
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

	async doUpdate() {
		this.updating = true;
		this.updateErr = false;

		const timeoutMs = 60_000;
		const timeout = new Promise((resolve) =>
			setTimeout(
				() => resolve({ ok: false, error: 'Update timed out after 60s' }),
				timeoutMs
			)
		);

		try {
			// race backend call with timeout
			const result = await Promise.race([
				window.api.app.updateVersion(), // returns { ok, error? }
				timeout,
			]);

			if (!result?.ok) throw new Error(result?.error || 'Update failed');

			// ok === true -> backend quits + relaunches, so UI doesn’t matter
		} catch (e) {
			this.updating = false;
			this.updateErr = true;
			await new Promise((resolve) => {
				setTimeout(resolve, 3000);
			});
			this.updateErr = false;
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
				const providerEntries = Object.entries(AI_STRUCTURED_MODELS);
				const modelsForProvider =
					AI_STRUCTURED_MODELS[this.provider]?.models ?? [];
				const currentProvider =
					this.provider && AI_STRUCTURED_MODELS[this.provider]
						? this.provider
						: providerEntries[0]?.[0] ?? '';
				const currentModel =
					this.model && modelsForProvider.includes(this.model)
						? this.model
						: modelsForProvider[0] ?? '';

				return html`
					<section class="settings">
						<div class="settings-fields">
							<label>
								<div class="dropdown">
									<button
										type="button"
										class="dropdown-toggle ${this._providerOpen ? 'open' : ''}"
										@click=${() => {
											this._providerOpen = !this._providerOpen;
											if (this._providerOpen) this._modelOpen = false;
										}}
									>
										<span>
											${AI_STRUCTURED_MODELS[currentProvider]?.key ??
											'Select provider'}
										</span>
										<span class="dropdown-chevron">▾</span>
									</button>

									${this._providerOpen
										? html`
												<ul class="dropdown-menu">
													${providerEntries.map(
														([providerKey, providerData]) => {
															const selected = providerKey === currentProvider;
															return html`
																<li
																	class="dropdown-item ${selected
																		? 'selected'
																		: ''}"
																	@click=${(e) => {
																		e.stopPropagation();
																		this.provider = providerKey;
																		const newModels =
																			AI_STRUCTURED_MODELS[providerKey]
																				?.models ?? [];
																		if (!newModels.includes(this.model)) {
																			this.model = newModels[0] ?? '';
																		}
																		this.refreshHasKey();
																	}}
																>
																	${providerData.key}
																</li>
															`;
														}
													)}
												</ul>
										  `
										: null}
								</div>
							</label>

							<label>
								<div class="dropdown">
									<button
										type="button"
										class="dropdown-toggle ${this._modelOpen ? 'open' : ''}"
										@click=${() => {
											this._modelOpen = !this._modelOpen;
											if (this._modelOpen) this._providerOpen = false;
										}}
									>
										<span> ${currentModel || 'Select model'} </span>
										<span class="dropdown-chevron">▾</span>
									</button>

									${this._modelOpen && modelsForProvider.length
										? html`
												<ul class="dropdown-menu">
													${modelsForProvider.map((model) => {
														const selected = model === currentModel;
														return html`
															<li
																class="dropdown-item ${selected
																	? 'selected'
																	: ''}"
																@click=${(e) => {
																	e.stopPropagation();
																	this.model = model;
																}}
															>
																${model}
															</li>
														`;
													})}
												</ul>
										  `
										: null}
								</div>
							</label>

							<label>
								<input
									id="apiKey"
									type="password"
									placeholder=${this.hasKey ? '••••••••' : 'API key'}
									autocomplete="off"
									@focus=${(e) => {
										this._providerOpen = false;
										this._modelOpen = false;
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
									@focus=${() => {
										this._providerOpen = false;
										this._modelOpen = false;
									}}
								/>
							</label>

							<label>
								<input
									id="rawPath"
									type="text"
									.value=${this.rawPath}
									placeholder="(raw) eg: ~/Desktop/raw"
									@focus=${() => {
										this._providerOpen = false;
										this._modelOpen = false;
									}}
								/>
							</label>
						</div>
						<div class="horizontal-box">
							<button
								@click=${() => {
									this._providerOpen = false;
									this._modelOpen = false;
									this.stateView = 'default';
								}}
							>
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
										${this.updating
											? t.updatingMsg
											: html`
													${t.vNeedsUpdate}
													${this.remoteVersion
														? html`(<span>${this.remoteVersion}</span>)`
														: ''}
											  `}
									</p>

									${this.updating || this.updateErr
										? html`
												<p>
													${this.updateErr
														? html`<svg width="20" height="20">${IconX}</svg>`
														: t.updating}
												</p>
										  `
										: html`
												<div class="horizontal-box">
													<button
														@click=${() => (this.stateView = 'default')}
														title=${labels.cancel ?? 'Cancel'}
													>
														${IconX}
													</button>

													<button
														@click=${() => this.doUpdate()}
														title=${labels.updateNow ?? 'Update'}
													>
														<span class="icon-wrap">${IconCheck}</span>
													</button>
												</div>
										  `}
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

			${this.updating
				? html`<div id="ui-blocker" class="ui-blocker"></div>`
				: null}
		`;
	}
}

customElements.define('settings-dialog', SettingsDialog);
