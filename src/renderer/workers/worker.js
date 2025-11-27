import { cleanChunk } from '../pipeline/preprocessor/cleaner/cleaner.js';
import { Chunker } from '../pipeline/preprocessor/chunker/chunker.js';
import { DOMParser, parseHTML } from 'linkedom';
globalThis.DOMParser = DOMParser;
globalThis.Node = parseHTML('<!doctype html><html></html>').window.Node;
import { processHTMLTextCore } from '../pipeline/preprocessor/parsers/parse-html.core.js';

const chunker = new Chunker();

const registry = {
	cleanChunk,
	findChunk: (...args) => chunker.findChunk(...args),
	processHTMLTextCore: (...args) => processHTMLTextCore(...args),
};

self.onmessage = async (event) => {
	const { fn, args } = event.data;
	const handler = registry[fn];
	if (!handler) {
		self.postMessage({ error: `Unknown function: ${fn}` });
		return;
	}

	try {
		const result = await handler(...args); // awaits even if sync
		self.postMessage({ result });
	} catch (err) {
		self.postMessage({ error: err.message });
	}
};
