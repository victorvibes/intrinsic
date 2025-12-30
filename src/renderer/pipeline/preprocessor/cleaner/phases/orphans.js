const ORPHANS = [
	'non-current assets',
	'non current assets',
	'non-current liabilities',
	'non current liabilities',
	'current assets',
	'current liabilities',
];

export function fixOrphans(text) {
	// Detect "Current assets/liabilities" section headers without totals
	// Try to attach orphan totals appearing within next 5 lines

	// Skip if header already has a number or next line is numeric
	// Otherwise search downwards for numeric orphan attached to detail lines
	// If found -> append number to header + remove orphan line

	// Avoids cases where totals mess with current and non-current values

	const lines = text.split('\n');
	let linesToRemove = new Set();

	for (let i = 0; i < lines.length; i++) {
		const currentLine = lines[i];
		const lowerLine = currentLine.toLowerCase();

		if (ORPHANS.some((phrase) => lowerLine.includes(phrase))) {
			// Case 1: Check if current line already has numbers
			if (hasNumbers(currentLine)) continue;

			// Case 2: Check if next line has only numbers
			if (i + 1 < lines.length && hasOnlyNumbersAndSpecialChars(lines[i + 1]))
				continue;

			// Case 3: Look for orphaned numbers in next 5 lines
			for (let j = 2; j <= 5; j++) {
				// Start from j=2 since we already checked j=1
				if (i + j >= lines.length) break;

				const potentialOrphanLine = lines[i + j];
				const lineAbove = lines[i + j - 1];

				// If this line has only numbers/special chars AND line above has both letters and numbers
				if (
					hasOnlyNumbersAndSpecialChars(potentialOrphanLine) &&
					hasLettersAndNumbers(lineAbove)
				) {
					lines[i] = currentLine + ' ' + potentialOrphanLine.trim();
					linesToRemove.add(i + j);
					break;
				}
			}
		}
	}

	return lines.filter((_, index) => !linesToRemove.has(index)).join('\n');
}

// *
// **
// ***
// ****
// ***** HELPERS
function hasNumbers(line) {
	return /\d/.test(line);
}

function hasOnlyNumbersAndSpecialChars(line) {
	return /^[\s\d(),\-.']*$/.test(line.trim()) && line.trim().length > 0;
}

function hasLettersAndNumbers(line) {
	return /[a-zA-Z]/.test(line) && /\d/.test(line);
}
