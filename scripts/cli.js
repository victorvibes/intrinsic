#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { join } from 'node:path';
import fs from 'node:fs';
import os from 'node:os';

const APP = 'Intrinsic';

function exists(p) {
	try {
		return fs.existsSync(p);
	} catch {
		return false;
	}
}

// Prefer the installed app per OS
function findInstalledBinary() {
	if (process.platform === 'darwin') {
		const sys = '/Applications/Intrinsic.app/Contents/MacOS/Intrinsic';
		const user = join(
			os.homedir(),
			'Applications',
			'Intrinsic.app',
			'Contents',
			'MacOS',
			'Intrinsic'
		);
		if (exists(sys)) return sys;
		if (exists(user)) return user;
		return null;
	}
	if (process.platform === 'win32') {
		const exe = join(
			process.env.LOCALAPPDATA || join(os.homedir(), 'AppData', 'Local'),
			'Programs',
			APP,
			`${APP}.exe`
		);
		return exists(exe) ? exe : null;
	}
	// linux
	const bin = join(os.homedir(), '.local', 'share', APP, APP);
	return exists(bin) ? bin : null;
}

const bin = findInstalledBinary();

if (!bin) {
	console.error('\n❌ Could not find a packaged Intrinsic binary.');
	console.error('Please run:  npm run build');
	process.exit(1);
}

const child = spawn(bin, process.argv.slice(2), { stdio: 'inherit' });
child.on('exit', (code) => process.exit(code ?? 0));
