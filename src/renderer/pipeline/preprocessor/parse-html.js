import { runWorker } from '../../workers/run.js';

// don’t need async/await but more explicit -> returns promise
export async function processHTMLText(text, startPage, endPage) {
	if (!text) return '';

	if (isMime(text)) {
		const htmlContent = extractHtml(text);

		// unload parsing to worker. Returns promise
		return await runWorker('processHTMLTextCore', [
			htmlContent,
			startPage,
			endPage,
		]);
	}

	return await runWorker('processHTMLTextCore', [text, startPage, endPage]);
}

function isMime(content) {
	const searchArea = content.substring(0, 8192).toLowerCase();
	return (
		searchArea.includes('mime-version: 1.0') &&
		searchArea.includes('content-type: multipart/')
	);
}

// get HTML from multipart MIME message
function extractHtml(content) {
	const boundaryMatch = content.match(/boundary="([^"]+)"/i);
	if (!boundaryMatch) return '';

	const boundary = boundaryMatch[1];
	const parts = content.split('--' + boundary);

	let result = '';
	for (const part of parts) {
		if (part.toLowerCase().includes('content-type: text/html')) {
			// handle quoted-printable encoding
			if (
				part
					.toLowerCase()
					.includes('content-transfer-encoding: quoted-printable')
			) {
				const bodyStart =
					part.indexOf('\r\n\r\n') !== -1
						? part.indexOf('\r\n\r\n') + 4
						: part.indexOf('\n\n') !== -1
						? part.indexOf('\n\n') + 2
						: 0;

				const body = part.substring(bodyStart);
				result += decodeQuoted(body) + '\n';
			} else {
				// get content after headers
				const bodyStart =
					part.indexOf('\r\n\r\n') !== -1
						? part.indexOf('\r\n\r\n') + 4
						: part.indexOf('\n\n') !== -1
						? part.indexOf('\n\n') + 2
						: 0;

				result += part.substring(bodyStart) + '\n';
			}
		}
	}

	return result;
}

// decode quoted-printable encoding
function decodeQuoted(input) {
	return input
		.replace(/=([0-9A-F]{2})/gi, (match, hex) => {
			return String.fromCharCode(parseInt(hex, 16));
		})
		.replace(/=\r\n/g, '')
		.replace(/=\n/g, '');
}
