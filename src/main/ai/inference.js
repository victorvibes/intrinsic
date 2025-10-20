import {
	getSystemPrompt,
	promptEngineerCleaner,
	promptEngineerSubmitter,
} from './prompts.js';
import { fileWriter } from '../utils/file-writer.js';
import { getUserData } from '../utils/user-data.js';
import { buildOpenAISchema, initOpenAIClient } from './providers/openai.js';

let client = null;
let initPromise = null;

async function ensureClient() {
	if (client) return client; // already ready
	if (initPromise) return initPromise; // another call in progress

	const { provider } = getUserData();

	switch (provider) {
		case 'openai':
			initPromise = (async () => {
				const c = await initOpenAIClient();
				client = c;
				return client;
			})();

			return initPromise;

		default:
			throw new Error(`Unsupported AI provider: ${provider ?? 'unknown'}`);
	}
}

export function resetAI() {
	client = null;
	initPromise = null;
}

const makeBalance = () => ({
	units: null,
	cash_and_equivalents: null,
	current_assets: null,
	non_current_assets: null,
	total_assets: null,
	current_liabilities: null,
	non_current_liabilities: null,
	total_liabilities: null,
	equity: null,
});

const makeIncome = () => ({
	units: null,
	revenue: null,
	net_income: null,
	eps: null,
});

const makeCashFlow = () => ({
	units: null,
	cash_flow_from_operations: null,
	cash_flow_from_investing: null,
	cash_flow_from_financing: null,
});

export const runAI = async (cleanedChunks, hits, minHits, period) => {
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

	const c = await ensureClient();

	let balance = makeBalance();
	let income = makeIncome();
	let cashFlow = makeCashFlow();

	try {
		if (!hits || typeof hits.balance === 'undefined') {
			throw new Error(
				'Invalid hits object passed to runAI: ' + JSON.stringify(hits)
			);
		}

		if (!cleanedChunks || !cleanedChunks.balance) {
			throw new Error(
				'Invalid cleanedChunks object passed to runAI: ' +
					JSON.stringify(cleanedChunks)
			);
		}

		const tasks = {};

		if (hits.balance >= minHits) {
			tasks.balance = runAIPipe(
				c,
				cleanedChunks.balance,
				'balance',
				period,
				balance
			);
		}

		if (hits.income >= minHits) {
			tasks.income = runAIPipe(
				c,
				cleanedChunks.income,
				'income',
				period,
				income
			);
		}

		if (hits.cashFlow >= minHits) {
			tasks.cashFlow = runAIPipe(
				c,
				cleanedChunks.cashFlow,
				'cashFlow',
				period,
				cashFlow
			);
		}

		if (Object.keys(tasks).length === 0) {
			return { tokens: { input: 0, output: 0 }, balance, income, cashFlow };
		}

		const results = await Promise.all(
			Object.entries(tasks).map(([key, promise]) =>
				promise.then((res) => [key, res])
			)
		);
		const updated = Object.fromEntries(results);

		({ balance, income, cashFlow } = {
			...{ balance, income, cashFlow },
			...updated,
		});

		const tokens = {
			input: 0,
			output: 0,
		};

		for (const section of [balance, income, cashFlow]) {
			if (section.inputTokens) tokens.input += section.inputTokens;
			if (section.outputTokens) tokens.output += section.outputTokens;
		}

		return { tokens, balance, income, cashFlow };
	} catch (err) {
		console.error('runAI request failed:', err);
		return false;
	}
};

async function runAIPipe(c, cleanedChunk, target, period, template) {
	const roles = getSystemPrompt(target); // role.cleaner || role.submitter
	const cleanerPrompt = promptEngineerCleaner(
		cleanedChunk.text,
		target,
		cleanedChunk.units
	);

	const model = getUserData().model;

	const cleanerResp = await c.responses.create({
		model: model,
		input: [
			{ role: 'system', content: roles.cleaner },
			{
				role: 'user',
				content: cleanerPrompt,
			},
		],
	});

	const submitterPrompt = promptEngineerSubmitter(
		cleanerResp.output_text,
		period
	);

	fileWriter(target + '_submitter', submitterPrompt, false);

	const schema = buildOpenAISchema(template, cleanedChunk.units);

	const submitterResp = await c.responses.create({
		model: model,
		input: [
			{ role: 'system', content: roles.submitter },
			{
				role: 'user',
				content: submitterPrompt,
			},
		],
		reasoning: {
			effort: 'low',
		},
		text: {
			verbosity: 'low',
			format: schema,
		},
	});

	const inputTokens =
		(cleanerResp?.usage?.input_tokens || 0) +
		(submitterResp?.usage?.input_tokens || 0);
	const outputTokens =
		(cleanerResp?.usage?.output_tokens || 0) +
		(submitterResp?.usage?.output_tokens || 0);

	let parsed = template;
	if (submitterResp?.output_text) {
		try {
			parsed = JSON.parse(submitterResp.output_text);
		} catch (e) {
			console.warn('Failed to parse JSON output_text; using template.', e);
		}
	}

	if (typeof cleanedChunk.units === 'number' && cleanedChunk.units !== 0) {
		parsed.units = cleanedChunk.units;
	}

	return { inputTokens, outputTokens, ...parsed };
}
