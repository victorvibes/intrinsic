export function getSystemPrompt(target) {
	let sectionName;
	switch (target) {
		case 'balance':
			sectionName = 'Balance Sheet';
			break;
		case 'income':
			sectionName = 'Income Statement';
			break;
		default:
			sectionName = 'Statement of Cash Flow';
	}

	return {
		submitter:
			'You are an expert at structured data extraction. ' +
			'You will be given unstructured text from a financial report and should ' +
			'convert it into the given JSON structure.',
		cleaner:
			'You are a meticulous text organizer. Your job is to extract the ' +
			sectionName +
			' section from provided text that may include messy or disorganized chunks.',
	};
}

export function promptEngineerCleaner(contentToClean, target, units) {
	let sectionName;
	switch (target) {
		case 'balance':
			sectionName = 'Balance Sheet';
			break;
		case 'income':
			sectionName = 'Income Statement';
			break;
		default:
			sectionName = 'Statement of Cash Flow';
	}

	const firstGuideline =
		units === 0
			? `* Include units and time periods for the ${sectionName}.\n`
			: `* Include time periods for the ${sectionName}.\n`;

	const prompt = `Guidelines:
${firstGuideline}* Ensure you capture all paragraphs that belong to the ${sectionName}. Be careful, as the ${sectionName} might be split into multiple paragraphs.
* Keep the headers and footers of the ${sectionName} intact.
* Place the reporting periods of the ${sectionName} at the top.
* Do not format the text.

This is the text:
${contentToClean}`;

	return prompt;
}

export function promptEngineerSubmitter(text, period) {
	const year = period.slice(0, 4);

	const formatPeriod = (p) => {
		if (p.endsWith('Y')) {
			return `the full ${year} year.`;
		} else if (p[5] === 'Q') {
			const quarters = ['first', 'second', 'third', 'fourth'];
			const q = parseInt(p[6], 10) - 1;
			if (q >= 0 && q < 4) {
				return `the ${quarters[q]} quarter of ${year}`;
			}
		} else if (p[5] === 'S') {
			return p[6] === '1'
				? `the first semester of ${year}.`
				: `the second semester of ${year}.`;
		}
		return `${p}.`; // fallback
	};

	let quarterGuideline = '';
	if (period[5] === 'Q') {
		const lowercaseText = text.toLowerCase();
		if (
			lowercaseText.includes('nine months') ||
			lowercaseText.includes('twelve months')
		) {
			quarterGuideline = `, specifically on the three months from ${year}.`;
		} else {
			quarterGuideline = '.';
		}
	}

	const formattedPeriod = formatPeriod(period);

	const prompt = `Extract financial data from ${formattedPeriod}
Guidelines:
* All resulting values should be floats.
* Do not multiply or divide values by units. Use the values as they are.
* Values in each row align with the years/periods as ordered in the document header or footer.
* For missing values that can be calculated, perform basic calculations.
* For values that cannot be found or calculated, use 'null'.
* Focus on the data from ${formattedPeriod}${quarterGuideline}
This is the text:
${text}`;

	return prompt;
}
