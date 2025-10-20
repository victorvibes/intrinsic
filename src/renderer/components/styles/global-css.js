import { css } from 'lit';

export const globalStyles = css`
	.ui-container {
		z-index: 20;
		display: flex;
		flex-direction: row;
		gap: 12px;
		align-items: center;
		justify-content: center;
		background: rgba(200, 200, 200, 0.15);
		backdrop-filter: blur(10px);
		-webkit-backdrop-filter: blur(10px);
		border-radius: 15px;
		width: fit-content;
		padding: 12px;
		box-shadow: 0 0 20px rgba(0, 0, 0, 0.1);
		margin: 0 auto;
		-webkit-app-region: no-drag;
	}

	.ui-container button {
		appearance: none;
		height: 40px;
		width: 40px;
		border-radius: 10px;
		display: flex;
		justify-content: center;
		align-items: center;
		box-sizing: border-box;
		font-weight: 600;
		background-color: transparent;
		border: none;
	}

	button {
		appearance: none;
		height: 40px;
		width: 40px;
		border-radius: 10px;
		display: flex;
		justify-content: center;
		align-items: center;
		box-sizing: border-box;
		font-weight: 600;
		background-color: transparent;
		border: none;
	}

	button,
	input,
	#list li {
		transition: all 0.2s ease;
	}

	button:disabled {
		cursor: default;
		box-shadow: none;
	}

	button:hover:not(:disabled) {
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15),
			inset 0 1px 1px rgba(255, 255, 255, 0.3);
		cursor: pointer;
	}

	button:disabled svg {
		opacity: 0.3;
	}

	.ui-container button:hover:not(:disabled),
	#list li:hover,
	input:focus,
	input:hover {
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15),
			inset 0 1px 1px rgba(255, 255, 255, 0.3);
		cursor: pointer;
	}

	input:focus {
		outline: none;
		cursor: text;
	}

	:focus,
	.small-button:focus {
		outline: none;
	}
`;
