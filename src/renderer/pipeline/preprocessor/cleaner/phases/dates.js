export function normalizeDates(text, period) {
	// handles cases where dates in January should be reduced to previous year (natural year vs FY)

	const suffix = period.substring(period.length - 2);

	// Only runn when reporting period ends in -Y / S2 / Q4 (year-end style documents)

	// First pass: detect "January" blocks and reduce dates to previous fiscal year
	//   - January 31, 2024 -> 2023
	//   - Handles split lines + date formats

	if (!['-Y', 'S2', 'Q4'].includes(suffix)) return text;

	const lines = text.split('\n');

	// Process lines with january detection
	let modifiedText = '';
	for (let i = 0; i < lines.length; i++) {
		// Combine current line with next line if available
		let combinedLines = lines[i];

		if (i + 1 < lines.length) {
			combinedLines += '\n' + lines[i + 1];
		}

		// Convert to lowercase for case-insensitive check
		const lowerLine = combinedLines.toLowerCase();

		// Check if contains january
		const containsJanuary = lowerLine.includes('january');

		if (containsJanuary) {
			// Process January section
			modifiedText += processJanuarySection(lines, i);

			// Skip processed lines (up to 2)
			i += Math.min(2, lines.length - i - 1);
		} else {
			// Process dates normally
			modifiedText += processDates(lines[i]) + '\n';
		}
	}

	let januaryRemoved = '';
	let currPos = 0;

	// Second pass: remove "January" text while preserving spacing + currency markers

	while (currPos < modifiedText.length) {
		const [foundJanuary, skipLen] = hasJanuary(modifiedText.substring(currPos));

		const span = modifiedText.substring(currPos, currPos + skipLen);

		// Does the skipped span contain €m / $m / £m (with or without parentheses)?
		const currencyMatch = span.match(/[€$£]\s*[mM]|\([€$£]\s*[mM]\)/);

		if (foundJanuary) {
			// First, replace with spaces (preserve alignment)
			januaryRemoved += ' '.repeat(skipLen);

			// If we detected a currency marker, overlay it back
			if (currencyMatch) {
				// Remove trailing spaces we just added
				januaryRemoved = januaryRemoved.slice(0, -skipLen);

				// Rebuild: spaces for everything, except put back the exact marker
				const before = span
					.substring(0, currencyMatch.index)
					.replace(/./g, ' ');
				const marker = currencyMatch[0];
				const after = span
					.substring(currencyMatch.index + marker.length)
					.replace(/./g, ' ');

				januaryRemoved += before + marker + after;
			}

			currPos += skipLen;
		} else {
			januaryRemoved += modifiedText[currPos];
			currPos++;
		}
	}

	return januaryRemoved;
}

// *
// **
// ***
// ****
// ***** HELPERS

// - processDates() decreases year on Jan dates
// - processJanuarySection() handles up to 3-line January blocks
// - hasJanuary() detects "January" even split across lines

function processDates(line, isJanuary) {
	if (!line || line.length < 6) {
		return line;
	}

	let result = line;

	// Process full dates
	const datePattern = /\b(\d{1,2})\/(\d{1,2})\/(\d{2,4})\b/g;
	const dateMatches = Array.from(line.matchAll(datePattern)).reverse();

	for (const match of dateMatches) {
		const [fullMatch, first, second, yearStr] = match;
		const position = match.index;

		const firstNum = parseInt(first);
		const secondNum = parseInt(second);
		let year = parseInt(yearStr);

		// Validate year
		if (year < 0 || year > 9999) {
			continue;
		}

		// Handle two-digit years
		if (yearStr.length === 2) {
			year = year < 50 ? year + 2000 : year + 1900;
		}

		if (firstNum < 1 || firstNum > 31 || secondNum < 1 || secondNum > 31) {
			continue;
		}
		if (
			(firstNum === 1 && secondNum > 12) ||
			(firstNum > 12 && secondNum === 1)
		) {
			result =
				result.substring(0, position) +
				(year - 1) +
				result.substring(position + fullMatch.length);
		}
	}

	// Process standalone years for January
	if (isJanuary) {
		const yearPattern = /\b(\d{4})\b/g;
		const yearMatches = Array.from(result.matchAll(yearPattern)).reverse();

		for (const match of yearMatches) {
			const year = parseInt(match[1]);
			const position = match.index;
			result =
				result.substring(0, position) +
				(year - 1) +
				result.substring(position + match[0].length);
		}
	}

	return result;
}

function processJanuarySection(lines, currentIndex) {
	while (currentIndex < lines.length && !lines[currentIndex].trim()) {
		currentIndex++;
	}

	if (currentIndex >= lines.length) {
		return '';
	}

	let combinedText = '';
	for (
		let offset = 0;
		offset < 3 && currentIndex + offset < lines.length;
		++offset
	) {
		combinedText += lines[currentIndex + offset] + '\n';
	}

	return processDates(combinedText, true);
}

function hasJanuary(text) {
	if (!text || text.length === 0) {
		return [false, 0];
	}

	const patterns = [
		'january 31,',
		'january 31',
		'january 31.',
		'January 31,',
		'January 31',
		'January 31.',
		'JANUARY 31,',
		'JANUARY 31',
		'JANUARY 31.',
		'january',
		'January',
		'JANUARY',
	];

	// Check for complete patterns
	for (const pattern of patterns) {
		if (text.length >= pattern.length) {
			// Case-insensitive substring check at the start of text
			if (
				text.substring(0, pattern.length).toLowerCase() ===
				pattern.toLowerCase()
			) {
				return [true, pattern.length];
			}
		}
	}

	// Check for split pattern (month on one line, day on another)
	const month = 'january';

	const searchLength = Math.min(text.length, month.length + 5);
	const startText = text.substring(0, searchLength).toLowerCase();

	if (startText.includes(month)) {
		// look for newlines and then "31" after each newline
		let pos = 0;

		while (true) {
			// Find next newline
			const newlinePos = text.indexOf('\n', pos);
			if (newlinePos === -1) break; // No more newlines

			// Check if we've gone too far from the start
			if (newlinePos > 500) break;

			// Start checking after the newline
			let checkPos = newlinePos + 1;

			// Skip whitespace
			while (checkPos < text.length && /\s/.test(text[checkPos])) {
				checkPos++;
			}

			// Check for "31" pattern
			if (
				checkPos + 1 < text.length &&
				text[checkPos] === '3' &&
				text[checkPos + 1] === '1' &&
				(checkPos + 2 === text.length ||
					/\s/.test(text[checkPos + 2]) ||
					/[.,;:?!]/.test(text[checkPos + 2]))
			) {
				return [true, checkPos + 2];
			}

			// Move to position after this newline
			pos = newlinePos + 1;
		}
	}

	return [false, 0];
}
