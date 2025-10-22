import { app, net } from 'electron';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const OWNER = 'genbraham';
const REPO = 'intrinsic';
const APP_NAME = 'Intrinsic';
const INCLUDE_PRERELEASES = false;

const stripV = (tag) => (typeof tag === 'string' ? tag.replace(/^v/, '') : tag);

function resolveNodeBin() {
	if (process.env.npm_node_execpath) return process.env.npm_node_execpath;
	return process.execPath;
}

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

async function getLatestRef() {
	if (!INCLUDE_PRERELEASES) {
		const { data } = await fetchJson(
			`https://api.github.com/repos/${OWNER}/${REPO}/releases/latest`
		);
		return data?.tag_name || 'main';
	}
	const { data } = await fetchJson(
		`https://api.github.com/repos/${OWNER}/${REPO}/releases`
	);
	const latest = Array.isArray(data)
		? data
				.filter((r) => !r.draft)
				.sort((a, b) => new Date(b.published_at) - new Date(a.published_at))[0]
		: null;
	return latest?.tag_name || 'main';
}

function copyUpdaterToTemp() {
	const __dirname = path.dirname(fileURLToPath(import.meta.url));
	const src = path.join(__dirname, 'updater.js');

	const workRoot = fs.mkdtempSync(path.join(os.tmpdir(), `${REPO}-upd-`));
	const dest = path.join(workRoot, 'updater.mjs');
	fs.copyFileSync(src, dest);
	return { workRoot, updaterPath: dest };
}

export async function updateVersion() {
	const ref = await getLatestRef();
	const { workRoot, updaterPath } = copyUpdaterToTemp();

	const child = spawn(
		resolveNodeBin(),
		[
			updaterPath,
			'--owner',
			OWNER,
			'--repo',
			REPO,
			'--ref',
			ref,
			'--appName',
			APP_NAME,
		],
		{
			env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
			detached: true,
			stdio: 'ignore',
			shell: false,
			windowsHide: true,
		}
	);
	child.unref();

	setTimeout(() => {
		try {
			app.quit();
		} catch {}
	}, 300);

	setTimeout(() => {
		try {
			fs.rmSync(workRoot, { recursive: true, force: true });
		} catch {}
	}, 120_000);

	return { started: true, ref, workRoot };
}
