import { spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import process from 'process';

const OWNER = 'victorvibes';
const REPO = 'intrinsic';
const REF = 'main';

function run(cmd, args, cwd) {
	return new Promise((resolve, reject) => {
		const exe = process.platform === 'win32' && cmd === 'npm' ? 'npm.cmd' : cmd;

		// Patch PATH so npm/git work from packaged apps
		const env = { ...process.env };
		if (process.platform === 'darwin' || process.platform === 'linux') {
			const nodeDir = path.dirname(process.execPath);
			env.PATH = [
				env.PATH,
				nodeDir,
				'/usr/local/bin',
				'/opt/homebrew/bin',
				'/usr/bin',
				'/bin',
			]
				.filter(Boolean)
				.join(':');
		}

		const child = spawn(exe, args, {
			cwd,
			stdio: 'inherit',
			shell: process.platform === 'win32',
			env,
		});

		child.on('error', reject);
		child.on('close', (code) =>
			code === 0
				? resolve()
				: reject(new Error(`${cmd} exited with code ${code}`))
		);
	});
}

async function ensureTool(cmd, args = ['--version']) {
	try {
		await run(cmd, args, undefined);
	} catch {
		throw new Error(`${cmd} not found on PATH`);
	}
}

export async function updateVersion() {
	await ensureTool('git');
	await ensureTool('npm');

	const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), `${REPO}-update-`));
	const repoDir = path.join(tmpDir, REPO);
	const repoURL = `https://github.com/${OWNER}/${REPO}.git`;

	try {
		console.log('[update] Temp dir:', tmpDir);

		console.log('[update] Cloning repo…');
		await run('git', [
			'clone',
			'--depth',
			'1',
			'--branch',
			REF,
			repoURL,
			repoDir,
		]);

		console.log('[update] Installing dependencies…');
		await run('npm', ['install'], repoDir);

		console.log('[update] Building…');
		await run('npm', ['run', 'build'], repoDir);

		console.log('[update] Cleaning up…');
		try {
			fs.rmSync(tmpDir, { recursive: true, force: true });
		} catch (e) {
			console.warn('[update] cleanup skipped:', e?.message || e);
			setTimeout(() => {
				try {
					fs.rmSync(tmpDir, { recursive: true, force: true });
				} catch {}
			}, 60_000);
		}

		console.log('[update] Done.');
	} catch (e) {
		try {
			fs.rmSync(tmpDir, { recursive: true, force: true });
		} catch {}
		throw e;
	}
}
