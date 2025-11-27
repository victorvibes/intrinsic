export function stripCurrenciesAndIntegers(text) {
	// Replace currency symbols + scale indicators with plain text:
	// €m/$m/£m -> "in millions", €k/$k/£k -> "in thousands", Uds. -> "units"

	// Remove tiny integers (1–2 digits) + small parentheses numbers like (1) if not time-span
	// Remove certain 4-digit numbers (often years/metadata) when followed by numeric data

	let lines = text.split('\n');
	let resultText = '';

	for (const line of lines) {
		let processedLine = '';
		let curr = 0;

		while (curr < line.length) {
			// Check for currency symbols
			const currencyResult = checkCurrencyMillionsOrUds(line, curr);
			if (currencyResult.found) {
				const beforeNeedsSpace =
					curr > 0 &&
					!/\s/.test(line[curr - 1]) &&
					processedLine.slice(-1) !== ' ';
				const afterNeedsSpace =
					curr + currencyResult.length < line.length &&
					!/\s/.test(line[curr + currencyResult.length]);

				if (beforeNeedsSpace) processedLine += ' ';

				if (currencyResult.type === 'units') {
					processedLine += 'units';
				} else if (currencyResult.type === 'millions') {
					processedLine += 'in millions';
				} else if (currencyResult.type === 'thousands') {
					processedLine += 'in thousands';
				}

				if (afterNeedsSpace) processedLine += ' ';

				curr += currencyResult.length;
				continue;
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

		resultText += processedLine + '\n';
	}

	// Second cleanup pass per line:
	// - remove commas, currency symbols, plus-parentheses (x+y)
	// - convert "(€m)" to "(in millions)" etc.
	// - drop excessively long lines

	const hasMillionsFirst =
		/\bin\s+millions?\b|\bmillions?\s+of\s+(?:dollars|pounds|euros)\b/gi.test(
			resultText
		);
	const hasThousandsFirst =
		/\bin\s+thousands?\b|\bthousands?\s+of\s+(?:dollars|pounds|euros)\b/gi.test(
			resultText
		);

	const linesOut = [];
	for (const line of resultText.split('\n')) {
		let processedLine = removePlusParenExpressions(line);
		processedLine = processedLine.replace(/,/g, '');
		processedLine = processedLine.replace(
			/\( ?[€$£]\s*[mM]\s*\)/gi,
			'(in millions)'
		);
		processedLine = processedLine.replace(
			/\( ?[€$£]\s*[kK]\s*\)/gi,
			'(in thousands)'
		);
		processedLine = processedLine.replace(/[€$£]/g, '');

		if (processedLine.length < 180) linesOut.push(processedLine);
	}

	return {
		text: linesOut.join('\n'),
		hasMillionsFirst,
		hasThousandsFirst,
	};
}

// *
// **
// ***
// ****
// ***** HELPERS

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

function removePlusParenExpressions(line) {
	let processedLine = '';
	let curr = 0;

	while (curr < line.length) {
		// Look for opening parenthesis
		if (line[curr] === '(') {
			let closeParenPos = -1;
			let hasPlus = false;

			// Find matching closing parenthesis with nesting support
			let depth = 1;
			let i = curr + 1;

			while (i < line.length && depth > 0) {
				const ch = line[i];

				if (ch === '(') {
					depth++;
				} else if (ch === ')') {
					depth--;
					if (depth === 0) {
						closeParenPos = i;
					}
				} else if (ch === '+') {
					hasPlus = true;
				}

				i++;
			}

			// If we found a matching ')' and the content had a '+'
			if (closeParenPos !== -1 && hasPlus) {
				// Replace the entire parenthetical expression with a single space
				processedLine += ' ';
				curr = closeParenPos + 1;
				continue;
			}
		}

		// Default: copy current character
		processedLine += line[curr];
		curr++;
	}

	return processedLine;
}
