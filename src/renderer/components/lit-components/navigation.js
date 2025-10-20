import { LitElement, html } from 'lit';
import { IconArrow, iconStyles } from '../styles/icons.js';
import { globalStyles } from '../styles/global-css.js';

export class Navigation extends LitElement {
	static properties = {
		currentPage: { type: Number },
		totalPages: { type: Number },
	};

	static styles = [globalStyles, iconStyles];

	render() {
		return html`
			<div class="ui-container ">
				<button
					?disabled=${this.currentPage <= 0}
					@click=${() => this.dispatchEvent(new CustomEvent('prev'))}
				>
					<svg width="20" height="20" class="rot-270">${IconArrow}</svg>
				</button>

				<button
					?disabled=${this.currentPage >= this.totalPages - 1}
					@click=${() => this.dispatchEvent(new CustomEvent('next'))}
				>
					<svg width="20" height="20" class="rot-90">${IconArrow}</svg>
				</button>
			</div>
		`;
	}
}

customElements.define('navigation-component', Navigation);
