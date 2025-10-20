export function runWorker(fn, args) {
	return new Promise((resolve, reject) => {
		const worker = new Worker(new URL('./worker.js', import.meta.url), {
			type: 'module',
		});

		worker.onmessage = (e) => {
			if (e.data.error) reject(new Error(e.data.error));
			else resolve(e.data.result);
			worker.terminate();
		};

		worker.onerror = (err) => {
			reject(err);
			worker.terminate();
		};

		worker.postMessage({ fn, args });
	});
}
