import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import os from 'os';
import { app } from 'electron/main';

let FILE_PATH = null;
let STATE = {};
let saving = Promise.resolve(); // serialize writes
const filename = 'userData.json';

function expandAndNormalizeDir(p) {
	if (!p || typeof p !== 'string') return '';

	let out = p.trim();

	// Expand leading ~
	if (out.startsWith('~') && (out.length === 1 || /[\\/]/.test(out[1]))) {
		out = path.join(os.homedir(), out.slice(1));
	}

	out = out
		.replace(/%([^%]+)%/g, (_, n) => process.env[n] || '')
		.replace(/\$([A-Za-z_]\w*)/g, (_, n) => process.env[n] || '');

	// Normalize & absolutize
	out = path.resolve(out);

	// No trailing separator (not needed with path.join)
	if (out.endsWith(path.sep)) out = out.slice(0, -path.sep.length);

	return out;
}

function normalizeFilewriterFields(obj) {
	const out = { ...obj };
	if (typeof out.filewriter_abs_path === 'string') {
		out.filewriter_abs_path = expandAndNormalizeDir(out.filewriter_abs_path);
	}
	if (typeof out.filewriter_raw_abs_path === 'string') {
		out.filewriter_raw_abs_path = expandAndNormalizeDir(
			out.filewriter_raw_abs_path
		);
	}
	return out;
}

function ensureDir(p) {
	fs.mkdirSync(path.dirname(p), { recursive: true });
}

function posixMode() {
	return os.platform() === 'win32' ? undefined : 0o600;
}

export function initUserData() {
	FILE_PATH = path.join(app.getPath('userData'), filename);
	ensureDir(FILE_PATH);
	return FILE_PATH;
}

export function getUserDataPath() {
	if (!FILE_PATH) throw new Error('initUserData() must be called first.');
	return FILE_PATH;
}

export function loadUserData(defaults = {}) {
	if (!FILE_PATH) throw new Error('initUserData() must be called first.');
	try {
		ensureDir(FILE_PATH);
		const raw = fs.readFileSync(FILE_PATH, 'utf8');
		STATE = { ...defaults, ...JSON.parse(raw) };
	} catch {
		// backup and reset corrupted file
		try {
			if (fs.existsSync(FILE_PATH)) {
				const backup =
					FILE_PATH.replace(/\.json$/i, '') + `.corrupt.${Date.now()}.json`;
				fs.copyFileSync(FILE_PATH, backup);
			}
		} catch {}
		STATE = { ...defaults };
		try {
			fs.writeFileSync(FILE_PATH, JSON.stringify(STATE, null, 2), {
				mode: posixMode(),
			});
		} catch {}
	}

	// Normalize once after load
	STATE = normalizeFilewriterFields(STATE);
	return STATE;
}

// Atomic save (tmp -> rename) and serialized
export async function saveUserData() {
	if (!FILE_PATH) throw new Error('initUserData() must be called first.');
	ensureDir(FILE_PATH);
	const tmp = FILE_PATH + '.tmp';

	saving = saving
		.then(async () => {
			const data = JSON.stringify(STATE, null, 2);
			await fsp.writeFile(tmp, data, { mode: posixMode() });
			await fsp.rename(tmp, FILE_PATH);
		})
		.catch(() => {})
		.finally(() => {});
	return saving;
}

export function getUserData() {
	return STATE;
}

export function setUserData(next) {
	const normalized = normalizeFilewriterFields({ ...next });
	STATE = { ...normalized };
	return saveUserData();
}

export function mergeUserData(partial) {
	const normalizedPartial = normalizeFilewriterFields({ ...partial });
	STATE = { ...STATE, ...normalizedPartial };
	return saveUserData();
}
