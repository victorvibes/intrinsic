import { getFilterWords, goodWords } from './cleaner-consts.js';
import { runWorker } from '../../workers/run.js';

export async function chunksCleaner(chunkerResults, period) {
	const [balance, income, cashFlow] = await Promise.all([
		runWorker('cleanChunk', ['balance', chunkerResults.balance.chunk, period]),
		runWorker('cleanChunk', ['income', chunkerResults.income.chunk, period]),
		runWorker('cleanChunk', [
			'cashFlow',
			chunkerResults.cashFlow.chunk,
			period,
		]),
	]);

	return { balance, income, cashFlow };
}

export function cleanChunk(target, chunk, period) {
	const filterWords = getFilterWords(target);

	// *
	// **
	// ***
	// ****
	// ***** NORMALIZE
	let lines = chunk.split('\n');
	const normalizedLines = [];

	for (const line of lines) {
		if (!line.trim()) {
			normalizedLines.push(line);
			continue;
		}

		// Pattern to detect: two numbers followed by a word
		// This matches:
		// - A number (with optional decimal points, commas, parentheses, minus signs)
		// - Whitespace (any amount)
		// - Another number (with same potential formatting)
		// - Whitespace (any amount)
		// - A word starting with a letter (this signals a new row/table)
		const pattern =
			/(-?\(?\d[\d,.]*\)?)(\s+)(-?\(?\d[\d,.]*\)?)(\s+)([a-zA-Z][\w\s]*)/;

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

	let processedText = normalizedLines.map((line) => line + '\n').join('');

	// *
	// **
	// ***
	// ****
	// *****  FILTER WORDS
	processedText = (() => {
		const lines = processedText.split('\n');
		const linesToRemove = new Set();

		for (let i = 0; i < lines.length; i++) {
			if (linesToRemove.has(i)) {
				continue;
			}

			const line = lines[i];
			const lowerLine = line.toLowerCase();

			if (goodWords.some((word) => lowerLine.includes(word))) {
				continue;
			}

			const hasFilterWord = filterWords.some((word) =>
				lowerLine.includes(word)
			);
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

		const result = lines.filter((_, index) => !linesToRemove.has(index));
		return result.join('\n');
	})();

	// *
	// **
	// ***
	// ****
	// ***** ORPHANS
	processedText = (() => {
		const lines = processedText.split('\n');
		let linesToRemove = new Set();
		const orphans = [
			'non-current assets',
			'non current assets',
			'non-current liabilities',
			'non current liabilities',
			'current assets',
			'current liabilities',
		];

		function hasNumbers(line) {
			return /\d/.test(line);
		}
		function hasOnlyNumbersAndSpecialChars(line) {
			return /^[\s\d(),\-.']*$/.test(line.trim()) && line.trim().length > 0;
		}
		function hasLettersAndNumbers(line) {
			return /[a-zA-Z]/.test(line) && /\d/.test(line);
		}

		for (let i = 0; i < lines.length; i++) {
			const currentLine = lines[i];
			const lowerLine = currentLine.toLowerCase();

			if (orphans.some((phrase) => lowerLine.includes(phrase))) {
				// Case 1: Check if current line already has numbers
				if (hasNumbers(currentLine)) {
					continue;
				}

				// Case 2: Check if next line has only numbers
				if (
					i + 1 < lines.length &&
					hasOnlyNumbersAndSpecialChars(lines[i + 1])
				) {
					continue;
				}

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
	})();

	// *
	// **
	// ***
	// ****
	// ***** DATES
	if (
		period.substring(period.length - 2) === '-Y' ||
		period.substring(period.length - 2) === 'S2' ||
		period.substring(period.length - 2) === 'Q4'
	) {
		const lines = processedText.split('\n');

		// Process lines with January/Enero detection
		let modifiedText = '';
		for (let i = 0; i < lines.length; i++) {
			// Combine current line with next line if available
			let combinedLines = lines[i];

			if (i + 1 < lines.length) {
				combinedLines += '\n' + lines[i + 1];
			}

			// Convert to lowercase for case-insensitive check
			const lowerLine = combinedLines.toLowerCase();

			// Check if contains January/Enero
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

		while (currPos < modifiedText.length) {
			const [foundJanuary, skipLen] = hasJanuary(
				modifiedText.substring(currPos)
			);

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

		processedText = januaryRemoved;
	}

	if (target == 'balance') {
		console.log('2: ', processedText);
	}

	// *
	// **
	// ***
	// ****
	// ***** CURRENCIES & INTEGERS
	lines = processedText.split('\n');
	processedText = '';

	for (const line of lines) {
		let processedLine = '';
		let curr = 0;

		while (curr < line.length) {
			// Check for currency symbols
			const result = checkCurrencyMillionsOrUds(line, curr);
			if (result.found) {
				// Check if we're dealing with "Uds."
				if (result.type === 'units') {
					processedLine += 'units';
				} else if (result.type === 'millions') {
					processedLine += 'in millions';
				} else if (result.type === 'thousands') {
					processedLine += 'in thousands';
				}
				curr += result.length;
			} else {
				// Check for integers surrounded by parentheses
				if (line[curr] === '(' && curr + 1 < line.length) {
					let numStart = curr + 1;
					let numEnd = numStart;

					while (numEnd < line.length && /\d/.test(line[numEnd])) {
						numEnd++;
					}

					if (numEnd < line.length && line[numEnd] === ')') {
						const numLength = numEnd - numStart;
						if (numLength <= 2) {
							const nextFiveChars = line.substring(numEnd + 1, numEnd + 6);
							if (nextFiveChars !== ' week' && nextFiveChars !== ' mont') {
								processedLine += ' '.repeat(numLength + 2);
								curr = numEnd + 1;
								continue;
							}
						}
					}
				}

				// Check for integers surrounded by spaces
				if (
					/\d/.test(line[curr]) &&
					(curr === 0 || /\s/.test(line[curr - 1]))
				) {
					let numStart = curr;
					let numEnd = numStart;
					let hasDelimiters = false;

					while (numEnd < line.length) {
						if (/\d/.test(line[numEnd])) {
							numEnd++;
						} else if (/[.,]/.test(line[numEnd])) {
							hasDelimiters = true;
							numEnd++;
						} else {
							break;
						}
					}

					if (numEnd < line.length && /\s/.test(line[numEnd])) {
						const numLength = numEnd - numStart;

						if (numLength <= 2 && !/cash/i.test(line)) {
							const nextFiveChars = line.substring(numEnd, numEnd + 5);
							if (nextFiveChars !== ' week' && nextFiveChars !== ' mont') {
								processedLine += ' '.repeat(numLength);
								curr = numEnd;
								continue;
							}
						} else if (numLength === 4 && !hasDelimiters) {
							const restOfLine = line.substring(numEnd);

							if (
								/^\s+\d+[.,]\d+/.test(restOfLine) ||
								/^\s+\(-?\d+[.,]\d+\)/.test(restOfLine)
							) {
								processedLine += ' '.repeat(numLength);
								curr = numEnd;
								continue;
							}

							let la = numEnd;
							while (la < line.length && /\s/.test(line[la])) la++;

							if (la < line.length) {
								if (line[la] === '(') {
									let bracketContent = '';
									let bracketIndex = la + 1;

									while (
										bracketIndex < line.length &&
										line[bracketIndex] !== ')'
									) {
										bracketContent += line[bracketIndex];
										bracketIndex++;
									}

									if (
										bracketIndex < line.length &&
										line[bracketIndex] === ')' &&
										/\d/.test(bracketContent)
									) {
										processedLine += ' '.repeat(numLength);
										curr = numEnd;
										continue;
									}
								} else if (/\d/.test(line[la])) {
									let laEnd = la;
									let nextHasDelim = false;

									while (laEnd < line.length) {
										if (/\d/.test(line[laEnd])) {
											laEnd++;
										} else if (/[.,]/.test(line[laEnd])) {
											nextHasDelim = true;
											laEnd++;
										} else {
											break;
										}
									}

									if (nextHasDelim) {
										processedLine += ' '.repeat(numLength);
										curr = numEnd;
										continue;
									}
								}
							}
						}
					}
				}

				processedLine += line[curr];
				curr++;
			}
		}

		processedText += processedLine + '\n';
	}

	// *
	// **
	// ***
	// ****
	// ***** UNITS
	let hasMillionsFirst = false;
	let hasThousandsFirst = false;

	hasMillionsFirst =
		/\bin\s+millions?\b|\bmillions?\s+of\s+(?:dollars|pounds|euros)\b/gi.test(
			processedText
		);
	hasThousandsFirst =
		/\bin\s+thousands?\b|\bthousands?\s+of\s+(?:dollars|pounds|euros)\b/gi.test(
			processedText
		);

	// *
	// **
	// ***
	// ****
	// ***** (+), THOUSANDS SEP, €$£, TEXT-ONLY CHUNKS...
	lines = processedText.split('\n');
	processedText = '';
	const linesToKeep = [];

	const specialKeywords = ['miles', 'millones', 'thousands', 'millions'];
	const containsSpecialKeywords = (line) => {
		const lowerLine = line.toLowerCase();
		return specialKeywords.some((keyword) => lowerLine.includes(keyword));
	};

	for (const line of lines) {
		let processedLine = '';
		let curr = 0;

		while (curr < line.length) {
			// Check for opening parenthesis
			if (line[curr] === '(') {
				let closeParenPos = -1;
				let hasPlus = false;

				// Find matching closing parenthesis
				let depth = 1;
				let i = curr + 1;

				while (i < line.length && depth > 0) {
					if (line[i] === '(') {
						depth++;
					} else if (line[i] === ')') {
						depth--;
						if (depth === 0) {
							closeParenPos = i;
						}
					} else if (line[i] === '+') {
						hasPlus = true;
					}
					i++;
				}

				// If we found a matching closing parenthesis and the content contains a '+'
				if (closeParenPos !== -1 && hasPlus) {
					// Replace the entire parenthetical expression with a single space
					processedLine += ' ';
					curr = closeParenPos + 1;
					continue;
				}
			}

			processedLine += line[curr];
			curr++;
		}

		// Remove all thousands separators
		processedLine = processedLine.replace(/,/g, '');

		// Replace unit markers like "(€m)" or "(€k)" before stripping symbols
		processedLine = processedLine.replace(
			/\( ?[€$£]\s*[mM]\s*\)/gi,
			'(in millions)'
		);
		processedLine = processedLine.replace(
			/\( ?[€$£]\s*[kK]\s*\)/gi,
			'(in thousands)'
		);

		// Remove remaining currency symbols
		processedLine = processedLine.replace(/[€$£]/g, '');

		// Only add lines that have fewer than 180 characters
		if (processedLine.length < 180) {
			linesToKeep.push(processedLine);
		}
	}

	for (let i = 0; i < linesToKeep.length; i++) {
		if (/table:|end of table/i.test(linesToKeep[i])) {
			continue;
		}

		const currentLineHasNumber = /\d/.test(linesToKeep[i]);
		const lineHasSpecialKeywords = containsSpecialKeywords(linesToKeep[i]);

		// Find next non-empty line
		let nextNonEmptyIndex = i + 1;
		while (
			nextNonEmptyIndex < linesToKeep.length &&
			!linesToKeep[nextNonEmptyIndex].trim()
		) {
			nextNonEmptyIndex++;
		}

		const nextLineHasNumber =
			nextNonEmptyIndex < linesToKeep.length &&
			/\d/.test(linesToKeep[nextNonEmptyIndex]);

		// Find next next non-empty line
		let nextNextNonEmptyIndex = nextNonEmptyIndex + 1;
		while (
			nextNextNonEmptyIndex < linesToKeep.length &&
			!linesToKeep[nextNextNonEmptyIndex].trim()
		) {
			nextNextNonEmptyIndex++;
		}

		const nextNextLineHasNumber =
			nextNextNonEmptyIndex < linesToKeep.length &&
			/\d/.test(linesToKeep[nextNextNonEmptyIndex]);

		// Only add this line if it or any of the next two non-empty lines contain numbers
		if (
			currentLineHasNumber ||
			nextLineHasNumber ||
			nextNextLineHasNumber ||
			lineHasSpecialKeywords
		) {
			processedText += linesToKeep[i] + '\n';
		}
	}

	// *
	// **
	// ***
	// ****
	// ***** POSTPROCESS UNITS
	let hasMillionsFinal = false;
	let hasThousandsFinal = false;

	hasMillionsFinal =
		/\bin\s+millions?\b|\bmillions?\s+of\s+(?:dollars|pounds|euros)\b/gi.test(
			processedText
		);
	hasThousandsFinal =
		/\bin\s+thousands?\b|\bthousands?\s+of\s+(?:dollars|pounds|euros)\b/gi.test(
			processedText
		);

	// remove units
	processedText = processedText.replace(
		/\bin\s+millions?\s+of\b|\bin\s+millions?,\b|\bin\s+millions?\b|\bmillions?\s+of\b|\bmillions?\.\b|\bmillions?,\b|\bmillions?\b/gi,
		''
	);
	processedText = processedText.replace(
		/\bin\s+thousands?\s+of\b|\bin\s+thousands?,\b|\bin\s+thousands?\b|\bthousands?\s+of\b|\bthousands?\.\b|\bthousands?,\b|\bthousands?\b/gi,
		''
	);
	processedText = processedText.replace(
		/\bexcept\s+share\s+and\s+per\s+share\b|\bexcept\s+per\s+share\b|\bexcept\s+share\b/gi,
		''
	);

	let units = 0;

	if (hasMillionsFinal) {
		units = 1000000;
	} else if (hasThousandsFinal) {
		units = 1000;
	} else if (hasMillionsFirst) {
		units = 1000000;
	} else if (hasThousandsFirst) {
		units = 1000;
	}

	// accounting notation to minus sign
	processedText = processedText.replace(/\(\s*(\d+(?:\.\d+)?)\s*\)/g, '-$1');

	// collapse whitespace & blank lines
	processedText = processedText
		.replace(/\r\n/g, '\n') // normalize Windows line endings
		.replace(/[ \t]+/g, ' ') // collapse runs of spaces/tabs
		.replace(/[ \t]*\n[ \t]*/g, '\n') // trim spaces around newlines
		.replace(/\n{2,}/g, '\n') // collapse multiple blank lines
		.trim(); // trim start/end

	return {
		text: processedText,
		units: units,
	};
}

// *
// **
// ***
// ****
// ***** DATES HELPERS
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

// *
// **
// ***
// ****
// ***** INTEGERS & CURRENCIES HELPERS
function checkCurrencyMillionsOrUds(text, position) {
	const remaining = text.slice(position);

	// Detect "(€m)", "€m", "$m", "£m" patterns (case-insensitive, optional parentheses/space)
	const millionsMatch = remaining.match(/^\(?\s*[€$£]\s*[mM]\s*\)?/);
	if (millionsMatch) {
		return { found: true, length: millionsMatch[0].length, type: 'millions' };
	}

	// Detect "(€k)", "€k", "$k", "£k" patterns for thousands
	const thousandsMatch = remaining.match(/^\(?\s*[€$£]\s*[kK]\s*\)?/);
	if (thousandsMatch) {
		return { found: true, length: thousandsMatch[0].length, type: 'thousands' };
	}

	const currencySymbols = ['$', '£', '€'];
	const isMillionMarker = (c) => c === 'm' || c === 'M';

	// Check for "Uds." (case insensitive)
	if (remaining.length >= 4) {
		if (
			remaining[0].toLowerCase() === 'u' &&
			remaining[1].toLowerCase() === 'd' &&
			remaining[2].toLowerCase() === 's' &&
			remaining[3] === '.'
		) {
			return { found: true, length: 4, type: 'units' };
		}
	}

	// Check for currency symbols followed by million marker
	for (const symbol of currencySymbols) {
		if (remaining.length < symbol.length + 1) continue;

		if (
			remaining.startsWith(symbol) &&
			isMillionMarker(remaining[symbol.length])
		) {
			return { found: true, length: symbol.length + 1, type: 'millions' };
		}
	}

	// Check for currency symbols followed by whitespace and then million/thousand words
	for (const symbol of currencySymbols) {
		if (!remaining.startsWith(symbol)) continue;

		let pos = symbol.length;

		// Skip whitespace characters
		while (pos < remaining.length && /\s/.test(remaining[pos])) {
			pos++;
		}

		// Now check for million/thousand words
		const millionWords = ['million', 'millions'];
		const thousandWords = ['thousand', 'thousands'];

		// Check for million variants
		for (const word of millionWords) {
			if (remaining.substring(pos, pos + word.length).toLowerCase() === word) {
				return {
					found: true,
					length: pos + word.length,
					type: 'millions',
				};
			}
		}

		// Check for thousand variants
		for (const word of thousandWords) {
			if (remaining.substring(pos, pos + word.length).toLowerCase() === word) {
				return {
					found: true,
					length: pos + word.length,
					type: 'thousands',
				};
			}
		}
	}

	return { found: false, length: 0 };
}
