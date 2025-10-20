import { LitElement, html, css } from 'lit';

export class DialogComponent extends LitElement {
	static properties = {
		open: { type: Boolean, reflect: true },
	};

	constructor() {
		super();
		this.open = false;
	}

	static styles = css`
		:host {
			display: none;
			inset: 0;
		}
		:host([open]) {
			display: contents;
		}
		.backdrop {
			position: absolute;
			inset: 0;
			z-index: 101;
			-webkit-app-region: no-drag;
			display: flex;
			justify-content: center;
			align-items: center;
		}

		.dialog {
			position: fixed;
			top: 50%;
			left: 50%;
			transform: translate(-50%, -50%);
			z-index: 200;
			max-width: 90%;
			border-radius: 15px;
			border: 1px solid rgba(255, 255, 255, 0.2);
			background: rgba(200, 200, 200, 0.2);
			backdrop-filter: blur(15px);
			box-shadow: 0 8px 150px 20px rgba(0, 0, 0, 0.3);
			cursor: default;
			pointer-events: auto;
			-webkit-app-region: no-drag;
		}
	`;

	_close() {
		this.open = false;
		this.dispatchEvent(new CustomEvent('dialog-closed'));
	}

	render() {
		return html`
			<div class="backdrop" @click=${this._close}></div>
			<div class="dialog">
				<slot></slot>
			</div>
		`;
	}
}

customElements.define('dialog-component', DialogComponent);
