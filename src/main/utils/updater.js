import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

function parseArgs(argv) {
	const out = {};
	for (let i = 2; i < argv.length; i += 2) {
		const k = argv[i],
			v = argv[i + 1];
		if (!k?.startsWith('--')) continue;
		out[k.slice(2)] = v;
	}
	return out;
}

function envWithBetterPath() {
	const extra =
		process.platform === 'darwin'
			? ['/opt/homebrew/bin', '/usr/local/bin', '/usr/bin', '/bin']
			: process.platform === 'linux'
			? ['/usr/local/bin', '/usr/bin', '/bin']
			: [];
	const sep = process.platform === 'win32' ? ';' : ':';
	const cur = process.env.PATH || '';
	const add = extra.filter((p) => !cur.split(sep).includes(p));
	return { ...process.env, PATH: [cur, ...add].filter(Boolean).join(sep) };
}

function run(cmd, args, cwd) {
	if (process.platform !== 'win32') {
		const quoted = [cmd, ...args]
			.map((a) => `'${String(a).replace(/'/g, `'\\''`)}'`)
			.join(' ');
		return new Promise((resolve, reject) => {
			const child = spawn('bash', ['-lc', quoted], {
				cwd,
				stdio: 'inherit',
				env: envWithBetterPath(),
			});
			child.on('error', reject);
			child.on('close', (c) =>
				c === 0 ? resolve() : reject(new Error(`${quoted} exited ${c}`))
			);
		});
	}
	return new Promise((resolve, reject) => {
		const exe = cmd === 'npm' ? 'npm.cmd' : cmd;
		const child = spawn(exe, args, {
			cwd,
			stdio: 'inherit',
			shell: false,
			env: envWithBetterPath(),
		});
		child.on('error', reject);
		child.on('close', (c) =>
			c === 0
				? resolve()
				: reject(new Error(`${exe} ${args.join(' ')} exited ${c}`))
		);
	});
}

function mkTmpRoot(prefix) {
	return fs.mkdtempSync(path.join(os.tmpdir(), `${prefix}-update-`));
}

async function relaunch(appName) {
	if (process.platform === 'darwin') {
		await run('open', ['-a', appName], undefined);
	} else if (process.platform === 'win32') {
		const programsDir = path.join(
			process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'),
			'Programs',
			appName
		);
		const exe = path.join(programsDir, `${appName}.exe`);
		await run('cmd.exe', ['/c', 'start', '""', exe], undefined);
	} else {
		const bin = path.join(os.homedir(), '.local', 'share', appName, appName);
		// detach without blocking this process
		await run('bash', ['-lc', `nohup "${bin}" >/dev/null 2>&1 &`], undefined);
	}
}

async function main() {
	const {
		owner,
		repo,
		ref = 'main',
		appName = 'Intrinsic',
	} = parseArgs(process.argv);
	if (!owner || !repo) {
		console.error('[updater] Missing --owner/--repo args');
		process.exit(2);
	}

	const repoURL = `https://github.com/${owner}/${repo}.git`;
	const workRoot = mkTmpRoot(repo);
	const repoDir = path.join(workRoot, repo);

	console.log('[updater] Clone', repoURL, 'ref:', ref, '→', repoDir);
	try {
		await run(
			'git',
			['clone', '--depth', '1', '--branch', ref, repoURL],
			workRoot
		);

		console.log('[updater] npm install…');
		await run('npm', ['install'], repoDir);

		console.log('[updater] npm run build…');
		await run('npm', ['run', 'build'], repoDir);

		console.log('[updater] Relaunching app:', appName);
		await relaunch(appName);
	} catch (e) {
		console.error('[updater] ERROR:', e?.message || e);
		// open releases page so user can install manually
		try {
			const { spawnSync } = await import('node:child_process');
			if (process.platform === 'darwin')
				spawnSync('open', [`https://github.com/${owner}/${repo}/releases`]);
			else if (process.platform === 'win32')
				spawnSync('cmd.exe', [
					'/c',
					'start',
					'',
					`https://github.com/${owner}/${repo}/releases`,
				]);
			else
				spawnSync('xdg-open', [`https://github.com/${owner}/${repo}/releases`]);
		} catch {}
	} finally {
		// Clean up after a short delay to avoid racing file handles
		setTimeout(() => {
			try {
				fs.rmSync(workRoot, { recursive: true, force: true });
			} catch {}
		}, 60_000);
	}
}

main();
