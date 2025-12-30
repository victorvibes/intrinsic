export const ACCENT_OPACITY = 0.3;

export const ACCENT_PALETTE = [
	`rgba(65, 102, 245, ${ACCENT_OPACITY})`, // blue
	`rgba(244, 114, 182, ${ACCENT_OPACITY})`, // pink
	`rgba(255, 85, 0, ${ACCENT_OPACITY})`, // orange
	`rgba(120, 120, 120, ${ACCENT_OPACITY})`, // gray
	`rgba(0, 0, 0, 0.05)`, // transparent
	`rgba(255, 255, 255, ${ACCENT_OPACITY})`, // white
];

export function applyAccent(accent) {
	if (typeof accent === 'string' && accent) {
		document.documentElement.style.setProperty('--accent', accent);
	}
}
