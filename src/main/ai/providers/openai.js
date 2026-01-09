import OpenAI from 'openai';
import { getSecret } from '../../utils/secrets.js';

export async function initOpenAIClient() {
	const key = await getSecret('STRUCTURED_AI_OPENAI_API_KEY');
	if (!key?.trim()) throw new Error('OpenAI API key not set.');

	const c = new OpenAI({ apiKey: key.trim() });

	try {
		// ping to verify
		await c.models.list({ limit: 1 });
		return c;
	} catch (err) {
		if (err?.status === 401) throw new Error('Invalid API key (401).');
		const code = err?.code || err?.cause?.code;
		if (['ENOTFOUND', 'ECONNRESET', 'ETIMEDOUT', 'EAI_AGAIN'].includes(code)) {
			throw new Error('Network error while contacting OpenAI.');
		}
		throw new Error(
			`Failed to initialize OpenAI: ${err.message || String(err)}`
		);
	}
}

export function buildOpenAISchema(template, units) {
	const skipUnits = typeof units === 'number' && units !== 0;

	const properties = {};
	const required = [];
	for (const key of Object.keys(template)) {
		if (key === 'units' && skipUnits) continue;
		properties[key] = { type: ['number', 'null'] };
		required.push(key);
	}

	return {
		type: 'json_schema',
		name: 'financial_data',
		schema: {
			type: 'object',
			properties,
			required,
			additionalProperties: false,
		},
		strict: true,
	};
}
