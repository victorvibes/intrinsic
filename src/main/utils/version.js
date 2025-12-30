import { app, net } from 'electron';

const OWNER = 'victorvibes';
const REPO = 'intrinsic';
const INCLUDE_PRERELEASES = false;

const stripV = (tag) => (typeof tag === 'string' ? tag.replace(/^v/, '') : tag);

function fetchJson(url) {
	return new Promise((resolve, reject) => {
		const req = net.request({ method: 'GET', url });
		req.setHeader('Accept', 'application/vnd.github+json');
		req.setHeader('User-Agent', `intrinsic/${app.getVersion?.() || 'dev'}`);
		let body = '';
		req.on('response', (res) => {
			res.on('data', (chunk) => (body += chunk));
			res.on('end', () => {
				try {
					resolve({ status: res.statusCode, data: JSON.parse(body || '{}') });
				} catch (err) {
					reject(err);
				}
			});
		});
		req.on('error', reject);
		req.end();
	});
}

export async function getVersion() {
	const local = typeof app?.getVersion === 'function' ? app.getVersion() : '';
	let remote = null;

	try {
		if (!INCLUDE_PRERELEASES) {
			const { data } = await fetchJson(
				`https://api.github.com/repos/${OWNER}/${REPO}/releases/latest`
			);
			if (data?.tag_name) remote = stripV(data.tag_name);
		} else {
			const { data } = await fetchJson(
				`https://api.github.com/repos/${OWNER}/${REPO}/releases`
			);
			if (Array.isArray(data) && data.length) {
				const latest = data
					.filter((r) => !r.draft)
					.sort(
						(a, b) => new Date(b.published_at) - new Date(a.published_at)
					)[0];
				if (latest?.tag_name) remote = stripV(latest.tag_name);
			}
		}
	} catch (e) {
		console.error('[version] Failed to fetch GitHub version:', e?.message || e);
	}

	return { local, remote };
}
