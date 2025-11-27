// Suggested NER-friendly cleaner
// Keeps: structural fixes, basic numeric/currency normalization, whitespace cleanup
// Avoids: date shifting, word-based filtering, orphan reattachment, small-integer stripping

export function cleanChunkForNER(target, chunk, period) {
	// 1) Structural normalization (split glued rows)
	let text = normalizeChunk(chunk);

	// 2) Remove big text-only chunks (keep lines with numbers or reasonably short lines)
	text = dropLargeTextOnlyLines(text);

	// 3) Normalize numbers & currencies, detect units (but don't delete wording)
	const { text: normalized, units } = normalizeNumbersAndCurrenciesForNER(text);

	// 4) Accounting parentheses -> minus sign
	let out = normalized.replace(/\(\s*(\d+(?:\.\d+)?)\s*\)/g, '-$1');

	// 5) Whitespace + newline normalization
	out = out
		.replace(/\r\n/g, '\n') // normalize Windows line endings
		.replace(/[ \t]+/g, ' ') // collapse spaces/tabs
		.replace(/[ \t]*\n[ \t]*/g, '\n') // trim around newlines
		.replace(/\n{2,}/g, '\n') // collapse multiple blank lines
		.trim();

	return { text: out, units };
}

// *
// **
// ***
// ****
// ***** HELPERS

// Drop long narrative paragraphs with no digits, keep table-ish / short lines.
function dropLargeTextOnlyLines(text) {
	const CHARS_LIMIT = 200;

	const lines = text.split('\n');
	const kept = [];

	for (const line of lines) {
		const hasNumber = /\d/.test(line);
		const isShort = line.trim().length <= CHARS_LIMIT;

		if (hasNumber || isShort) {
			kept.push(line);
		}
	}

	return kept.join('\n');
}

// Pure formatting + unit detection:
// - remove thousand separators (commas between digits)
// - keep currency symbols and canonicalize
// - detect "in millions / thousands" but DO NOT remove
function normalizeNumbersAndCurrenciesForNER(text) {
	let lines = text.split('\n');
	const outLines = [];

	for (let line of lines) {
		// Remove "thousand separator" commas (only when between digits)
		line = line.replace(/(\d),(?=\d{3}\b)/g, '$1');

		// Canonicalize currency symbols -> turn € / $ / £ into tokens model can learn
		line = line.replace(/€/g, ' EUR ');
		line = line.replace(/\$/g, ' USD ');
		line = line.replace(/£/g, ' GBP ');

		outLines.push(line);
	}

	const joined = outLines.join('\n');

	// Unit detection
	const hasMillions =
		/\bin\s+millions?\b|\bmillions?\s+of\s+(?:dollars|pounds|euros)\b/gi.test(
			joined
		);
	const hasThousands =
		/\bin\s+thousands?\b|\bthousands?\s+of\s+(?:dollars|pounds|euros)\b/gi.test(
			joined
		);

	let units = 0;
	if (hasMillions) units = 1_000_000;
	else if (hasThousands) units = 1_000;

	return { text: joined, units };
}
