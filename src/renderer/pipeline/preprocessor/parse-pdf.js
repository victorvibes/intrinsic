import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?worker';

let pdfJsInitialized = false;

// leave on renderer. future pdf display?
const setupPdfJs = () => {
	if (pdfJsInitialized) return;
	pdfjsLib.GlobalWorkerOptions.workerPort = new pdfjsWorker();
	pdfJsInitialized = true;
};

export async function extractPDFText(file, startPage, endPage) {
	setupPdfJs();

	const strToInt = (value) => {
		if (value === undefined || value === null || value === '') return null;

		const str = String(value).trim();
		const trimmed = str.replace(/^0+/, '');

		if (!trimmed || trimmed.length > 4 || !/^\d+$/.test(trimmed)) return null;

		const val = parseInt(trimmed, 10);
		return val > 0 ? val : null;
	};

	const minPageInt = strToInt(startPage);
	const maxPageInt = strToInt(endPage);

	try {
		const u8 = file instanceof Uint8Array ? file : new Uint8Array(file);
		const pdf = await pdfjsLib.getDocument({
			data: u8,
			verbosity: pdfjsLib.VerbosityLevel.ERRORS,
		}).promise;

		const docPages = pdf.numPages;

		let startIdx = 0;
		let endIdx = docPages;

		if (minPageInt && maxPageInt) {
			// both valid
			if (maxPageInt >= minPageInt) {
				startIdx = minPageInt - 1;
				endIdx = Math.min(maxPageInt, docPages);
			} else {
				// invalid ordering -> whole doc
				startIdx = 0;
				endIdx = docPages;
			}
		} else if (minPageInt && !maxPageInt) {
			// only start valid
			startIdx = minPageInt - 1;
			endIdx = docPages;
		} else if (!minPageInt && maxPageInt) {
			// only end valid
			startIdx = 0;
			endIdx = Math.min(maxPageInt, docPages);
		}

		if (startIdx >= docPages) return '';

		let fullText = '';

		for (let i = startIdx; i < endIdx; i++) {
			const page = await pdf.getPage(i + 1);
			const textContent = await page.getTextContent();

			// column + line detection
			const xPositions = textContent.items.map((item) =>
				Math.round(item.transform[4])
			);
			const xFrequency = {};
			xPositions.forEach((x) => {
				xFrequency[x] = (xFrequency[x] || 0) + 1;
			});

			const columnThreshold = 2;
			const columns = Object.keys(xFrequency)
				.filter((x) => xFrequency[x] >= columnThreshold)
				.map(Number)
				.sort((a, b) => a - b);

			const yTolerance = 5;
			const lineGroups = {};

			textContent.items.forEach((item) => {
				const y = Math.round(item.transform[5]);
				let assigned = false;
				for (const existingY in lineGroups) {
					if (Math.abs(y - existingY) <= yTolerance) {
						lineGroups[existingY].push(item);
						assigned = true;
						break;
					}
				}
				if (!assigned) lineGroups[y] = [item];
			});

			const sortedYPositions = Object.keys(lineGroups).sort((a, b) => b - a);

			const lines = sortedYPositions.map((yPosition) => {
				const lineItems = lineGroups[yPosition].sort(
					(a, b) => a.transform[4] - b.transform[4]
				);
				const rowData = {};
				lineItems.forEach((item) => {
					const itemX = Math.round(item.transform[4]);
					let columnIndex = columns.findIndex((x) => Math.abs(x - itemX) < 20);
					if (columnIndex === -1) columnIndex = 0;
					if (!rowData[columnIndex]) rowData[columnIndex] = '';
					rowData[columnIndex] += item.str + ' ';
				});
				return Object.values(rowData)
					.map((text) => text.trim())
					.join('\t');
			});

			fullText += lines.join('\n') + '\n\n';
		}

		return fullText;
	} catch (error) {
		console.error('Error extracting PDF text:', error);
		throw new Error(`Failed to extract text from PDF: ${error.message}`, {
			cause: error,
		});
	}
}
