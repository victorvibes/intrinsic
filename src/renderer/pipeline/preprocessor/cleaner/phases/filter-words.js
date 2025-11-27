export function filterChunkByWords(text, { filterWords, goodWords }) {
	// Remove lines containing filterWords unless protected by goodWords
	// (goodWords always keeps the line)

	// If filterWord + number -> delete that line
	// If filterWord + no number -> look at next line, delete both if next is numeric-only

	// Return only lines not flagged for removal

	const lines = text.split('\n');
	const linesToRemove = new Set();

	for (let i = 0; i < lines.length; i++) {
		if (linesToRemove.has(i)) continue;

		const line = lines[i];
		const lowerLine = line.toLowerCase();

		if (goodWords.some((word) => lowerLine.includes(word))) continue;

		const hasFilterWord = filterWords.some((word) => lowerLine.includes(word));
		const hasNumber = /\d/.test(line);

		if (hasFilterWord && hasNumber) {
			linesToRemove.add(i);
			continue;
		}

		if (hasFilterWord && !hasNumber) {
			const nextIndex = i + 1;

			if (nextIndex < lines.length) {
				const nextLine = lines[nextIndex];

				const specialCharsRegex = /^[(),\-.'0-9\s]*$/;

				if (specialCharsRegex.test(nextLine)) {
					linesToRemove.add(i);
					linesToRemove.add(nextIndex);
				}
			}
		}
	}

	return lines.filter((_, index) => !linesToRemove.has(index)).join('\n');
}
