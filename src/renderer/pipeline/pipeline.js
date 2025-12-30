import { extractPDFText } from './preprocessor/parsers/parse-pdf.js';
import { processHTMLText } from './preprocessor/parsers/parse-html.js';
import { Chunker } from './preprocessor/chunker/chunker.js';
import { chunksCleaner } from './preprocessor/cleaner/cleaner.js';
import { postprocessor } from './postprocessor/postprocessor.js';

async function fetchWithRetry(url) {
	const RETRIES = 3;
	const BACKOFF = 500;
	const TIMEOUT = 20000;

	let attempt = 0;
	let lastError;

	while (attempt <= RETRIES) {
		const controller = new AbortController();
		const id = setTimeout(() => controller.abort(), TIMEOUT);

		try {
			const response = await fetch(url, {
				signal: controller.signal,
			});

			clearTimeout(id);
			return response; // return on any HTTP status
		} catch (err) {
			clearTimeout(id);
			lastError = err;

			if (attempt === RETRIES) break;

			const delay = BACKOFF * Math.pow(2, attempt);
			await new Promise((res) => setTimeout(res, delay));

			attempt++;
		}
	}

	throw lastError;
}

// RUNS ON RENDERER
const MIN_HITS = 17;

export async function pipeline(params) {
	const { provider } = await window.api.userData.get();
	const keyName = `STRUCTURED_AI_${String(provider).toUpperCase()}_API_KEY`;
	if (!(await window.api.secrets.has(keyName))) return false;

	try {
		let raw;
		let text;
		let isPDF = false;

		// *
		// **
		// ***
		// ****
		// ***** LOAD & DECODE
		// rely on chromium decoders
		if (params.isurl) {
			let url = params.source;

			if (!/^https?:\/\//i.test(url)) {
				url = 'https://' + url;
			}

			try {
				const res = await fetchWithRetry(url);
				const clone = res.clone(); // avoid double-consume

				raw = await res.arrayBuffer();
				const u8 = new Uint8Array(raw);

				isPDF =
					u8[0] === 0x25 && // %
					u8[1] === 0x50 && // P
					u8[2] === 0x44 && // D
					u8[3] === 0x46; // F

				if (!isPDF) {
					text = await clone.text();
				}
			} catch (err) {
				console.error('error fetching file', err);
				return false;
			}
		} else {
			try {
				raw = await window.api.readFileBuffer(params.source);
				const u8 = new Uint8Array(raw);

				isPDF =
					u8[0] === 0x25 && // %
					u8[1] === 0x50 && // P
					u8[2] === 0x44 && // D
					u8[3] === 0x46; // F

				if (!isPDF) {
					const blob = new Blob([raw]);
					text = await blob.text(); // chromium sniffing
				}
			} catch (err) {
				console.error('error reading file', err);
				return false;
			}
		}

		if (isPDF) {
			if (!raw || raw.byteLength < 500) {
				console.error('Raw data too short or empty');
				return false;
			}
		} else {
			if (!text || text.length < 500) {
				console.error('Text data too short or empty');
				return false;
			}
		}

		// *
		// **
		// ***
		// ****
		// ***** PARSE
		let parsed;
		if (isPDF) {
			parsed = await extractPDFText(raw, params.start, params.end);
		} else {
			parsed = await processHTMLText(text, params.start, params.end);
		}

		if (!parsed || parsed.length < 500) {
			console.error('Parsed text too short or empty');
			return false;
		}

		raw = null;
		text = null;

		await window.api.fileWriter(
			params.ticker + '_' + params.period,
			parsed,
			true
		);

		// *
		// **
		// ***
		// ****
		// ***** CHUNK
		const chunker = new Chunker();
		let chunkerResults = await chunker.getChunks(parsed);
		/*
        chunkerResults = {
            balance: {
                chunk: string,
                hits: number,
                indicators: string[]
            },
            income: {
                chunk: string,
                hits: number,
                indicators: string[]
            },
            cashFlow: {
                chunk: string,
                hits: number,
                indicators: string[]
            }
        }
        */

		if (
			!chunkerResults ||
			(chunkerResults.balance.hits < MIN_HITS &&
				chunkerResults.income.hits < MIN_HITS &&
				chunkerResults.cashFlow.hits < MIN_HITS) ||
			(!chunkerResults.balance.chunk &&
				!chunkerResults.income.chunk &&
				!chunkerResults.cashFlow.chunk) ||
			(chunkerResults.balance.chunk.length < 200 &&
				chunkerResults.income.chunk.length < 200 &&
				chunkerResults.cashFlow.chunk.length < 200)
		) {
			console.error('Chunker hits insufficient');
			return false;
		}

		parsed = null;

		const formatChunkWriting = (section) =>
			`Hits: ${section.hits}\n\nIndicators: ${section.indicators.join(
				', '
			)}\n\n${section.chunk}`;

		await window.api.fileWriter(
			'balance_chunk',
			formatChunkWriting(chunkerResults.balance),
			false
		);
		await window.api.fileWriter(
			'income_chunk',
			formatChunkWriting(chunkerResults.income),
			false
		);
		await window.api.fileWriter(
			'cashflow_chunk',
			formatChunkWriting(chunkerResults.cashFlow),
			false
		);

		// *
		// **
		// ***
		// ****
		// ***** CLEAN
		let cleanedChunks = await chunksCleaner(chunkerResults, params.period);
		/*
        cleanedChunks = {
            balance: {
                text: string,
                units: number,
            },
            income: {
                text: string,
                units: number,
            },
            cashFlow: {
                text: string,
                units: number,
            }
        }
        */

		if (
			!cleanedChunks ||
			(!cleanedChunks.balance.text &&
				!cleanedChunks.income.text &&
				!cleanedChunks.cashFlow.text) ||
			(cleanedChunks.balance.text.length < 200 &&
				cleanedChunks.income.text.length < 200 &&
				cleanedChunks.cashFlow.text.length < 200)
		) {
			console.error('Cleaner output insufficient');
			return false;
		}

		const hits = {
			balance: chunkerResults.balance.hits,
			income: chunkerResults.income.hits,
			cashFlow: chunkerResults.cashFlow.hits,
		};

		chunkerResults = null;

		await window.api.fileWriter(
			'balance_cleaned',
			`Units: ${cleanedChunks.balance.units}\n\n${cleanedChunks.balance.text}`,
			false
		);
		await window.api.fileWriter(
			'income_cleaned',
			`Units: ${cleanedChunks.income.units}\n\n${cleanedChunks.income.text}`,
			false
		);
		await window.api.fileWriter(
			'cashflow_cleaned',
			`Units: ${cleanedChunks.cashFlow.units}\n\n${cleanedChunks.cashFlow.text}`,
			false
		);

		// *
		// **
		// ***
		// ****
		// ***** INFERENCE
		const inferenceResults = await window.api.runAI(
			cleanedChunks,
			hits,
			MIN_HITS,
			params.period
		); // returns structured object (flat financial data)
		/*
        inferenceResults = {
            tokens: { input: number, output: number },
            balance: { inputTokens?: number, outputTokens?: number, current_assets:... },
            income: { inputTokens?: number, outputTokens?: number, current_assets:... },
            cashFlow: { inputTokens?: number, outputTokens?: number, current_assets:... }
        }
        */
		if (!inferenceResults) {
			console.error('Inference failed');
			return false;
		}

		await window.api.fileWriter(
			'inference_results',
			JSON.stringify(
				{
					units: {
						balance: cleanedChunks?.balance?.units ?? null,
						income: cleanedChunks?.income?.units ?? null,
						cash_flow: cleanedChunks?.cashFlow?.units ?? null,
					},
					...inferenceResults,
				},
				null,
				2
			),
			false
		);

		cleanedChunks = null;

		// *
		// **
		// ***
		// ****
		// ***** POSTPROCESSOR
		const postprocessed = postprocessor(inferenceResults);
		if (!postprocessed) {
			console.error('Postprocessor failed');
			return false;
		}
		/*
        postprocessed = {
            current_assets              INTEGER,
            non_current_assets          INTEGER,
            eps                         REAL,
            cash_and_equivalents        INTEGER,
            cash_flow_from_financing    INTEGER,
            cash_flow_from_investing    INTEGER,
            cash_flow_from_operations   INTEGER,
            revenue                     INTEGER,
            current_liabilities         INTEGER,
            non_current_liabilities     INTEGER,
            net_income                  INTEGER,
        }
        */

		// *
		// **
		// ***
		// ****
		// ***** DB
		return await window.api.addFinances(
			params.ticker,
			params.period,
			postprocessed
		);
	} catch (err) {
		console.error('Pipeline error:', err);
		return false;
	}
}
