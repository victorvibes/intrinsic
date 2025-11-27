export function normalizeUnits(text, hasMillionsFirst, hasThousandsFirst) {
	// Remove irrelevant lines with no numbers unless near numeric content or unit keywords
	// -> Keeps only data-bearing text

	// Detect final units after filtering ("in millions", "thousands of dollars", etc.)
	// Remove unit wording from text, but output numeric scale separately

	// Decide multiplier:
	//   1,000,000 if millions detected
	//   1,000 if thousands detected
	//   Else fallback to earlier currency-inference flags

	let workingText = text;

	const specialKeywords = ['thousands', 'millions'];
	const containsSpecialKeywords = (line) => {
		const lower = line.toLowerCase();
		return specialKeywords.some((kw) => lower.includes(kw));
	};

	const lines = workingText.split('\n');
	const linesToKeep = [];

	for (let i = 0; i < lines.length; i++) {
		// Skip table markers entirely (match original behavior)
		if (/table:|end of table/i.test(lines[i])) continue;

		const currentLineHasNumber = /\d/.test(lines[i]);
		const lineHasSpecialKeywords = containsSpecialKeywords(lines[i]);

		// Find next non-empty line
		let nextNonEmptyIndex = i + 1;
		while (nextNonEmptyIndex < lines.length && !lines[nextNonEmptyIndex].trim())
			nextNonEmptyIndex++;

		const nextLineHasNumber =
			nextNonEmptyIndex < lines.length && /\d/.test(lines[nextNonEmptyIndex]);

		// Find next next non-empty line
		let nextNextNonEmptyIndex = nextNonEmptyIndex + 1;
		while (
			nextNextNonEmptyIndex < lines.length &&
			!lines[nextNextNonEmptyIndex].trim()
		)
			nextNextNonEmptyIndex++;

		const nextNextLineHasNumber =
			nextNextNonEmptyIndex < lines.length &&
			/\d/.test(lines[nextNextNonEmptyIndex]);

		// Only add this line if it or any of the next two non-empty lines contain numbers
		if (
			currentLineHasNumber ||
			nextLineHasNumber ||
			nextNextLineHasNumber ||
			lineHasSpecialKeywords
		)
			linesToKeep.push(lines[i]);
	}

	workingText = linesToKeep.join('\n');

	// detect units after this reduction
	const hasMillionsFinal =
		/\bin\s+millions?\b|\bmillions?\s+of\s+(?:dollars|pounds|euros)\b/gi.test(
			workingText
		);
	const hasThousandsFinal =
		/\bin\s+thousands?\b|\bthousands?\s+of\s+(?:dollars|pounds|euros)\b/gi.test(
			workingText
		);

	workingText = workingText.replace(
		/\bin\s+millions?\s+of\b|\bin\s+millions?,\b|\bin\s+millions?\b|\bmillions?\s+of\b|\bmillions?\.\b|\bmillions?,\b|\bmillions?\b/gi,
		''
	);
	workingText = workingText.replace(
		/\bin\s+thousands?\s+of\b|\bin\s+thousands?,\b|\bin\s+thousands?\b|\bthousands?\s+of\b|\bthousands?\.\b|\bthousands?,\b|\bthousands?\b/gi,
		''
	);
	workingText = workingText.replace(
		/\bexcept\s+share\s+and\s+per\s+share\b|\bexcept\s+per\s+share\b|\bexcept\s+share\b/gi,
		''
	);

	let units = 0;
	if (hasMillionsFinal) units = 1_000_000;
	else if (hasThousandsFinal) units = 1_000;
	else if (hasMillionsFirst) units = 1_000_000;
	else if (hasThousandsFirst) units = 1_000;

	return { text: workingText, units };
}
