export function normalizeChunk(chunk) {
	let lines = chunk.split('\n');
	const normalizedLines = [];

	// Pattern to detect: two numbers followed by a word
	// This matches:
	// - A number (with optional decimal points, commas, parentheses, minus signs)
	// - Whitespace (any amount)
	// - Another number (with same potential formatting)
	// - Whitespace (any amount)
	// - A word starting with a letter (this signals a new row/table)
	const pattern =
		/(-?\(?\d[\d,.]*\)?)(\s+)(-?\(?\d[\d,.]*\)?)(\s+)([a-zA-Z][\w\s]*)/;

	for (const line of lines) {
		if (!line.trim()) {
			normalizedLines.push(line);
			continue;
		}

		const match = pattern.exec(line);
		if (match) {
			// Calculate where to split - after the second number
			const splitPosition =
				match.index + match[1].length + match[2].length + match[3].length;

			// Split the line into two parts
			const firstPart = line.substring(0, splitPosition);
			const secondPart = line.substring(splitPosition);

			// Add both parts as separate lines
			normalizedLines.push(firstPart);
			normalizedLines.push(secondPart);
		} else {
			// Else keep line as is
			normalizedLines.push(line);
		}
	}

	return normalizedLines.map((line) => line + '\n').join('');
}
