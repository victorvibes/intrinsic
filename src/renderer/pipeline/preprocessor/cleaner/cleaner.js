import { runWorker } from '../../../workers/run.js';

import { getFilterWords, goodWords } from './cleaner-consts.js';

import { normalizeChunk } from './phases/normalize.js';
import { filterChunkByWords } from './phases/filter-words.js';
import { fixOrphans } from './phases/orphans.js';
import { normalizeDates } from './phases/dates.js';
import { stripCurrenciesAndIntegers } from './phases/currencies-integers.js';
import { normalizeUnits } from './phases/units.js';

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

	let text = chunk;

	text = normalizeChunk(text);
	text = filterChunkByWords(text, { filterWords, goodWords });
	text = fixOrphans(text);
	text = normalizeDates(text, period);

	const {
		text: afterCurrency,
		hasMillionsFirst,
		hasThousandsFirst,
	} = stripCurrenciesAndIntegers(text);

	const { text: textWithoutUnits, units } = normalizeUnits(
		afterCurrency,
		hasMillionsFirst,
		hasThousandsFirst
	);

	// accounting notation to minus sign
	text = textWithoutUnits.replace(/\(\s*(\d+(?:\.\d+)?)\s*\)/g, '-$1');

	// collapse whitespace & blank lines
	text = text
		.replace(/\r\n/g, '\n') // normalize Windows line endings
		.replace(/[ \t]+/g, ' ') // collapse runs of spaces/tabs
		.replace(/[ \t]*\n[ \t]*/g, '\n') // trim spaces around newlines
		.replace(/\n{2,}/g, '\n') // collapse multiple blank lines
		.trim(); // trim start/end

	return { text, units };
}
