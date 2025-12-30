import { app, safeStorage } from 'electron';
import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import os from 'os';

const STRICT_NO_PLAINTEXT = false; // set true to reject stores when encryption unavailable

const filePath = () => path.join(app.getPath('userData'), 'secrets.json');
let writeQ = Promise.resolve(); // serialize writes

function readStore() {
	try {
		return JSON.parse(fs.readFileSync(filePath(), 'utf8'));
	} catch {
		return {};
	}
}

async function writeStore(obj) {
	const p = filePath();
	await fsp.mkdir(path.dirname(p), { recursive: true });
	const tmp = p + '.tmp';
	const data = JSON.stringify(obj, null, 2);

	// 0600 on POSIX; harmless on Windows
	const mode = os.platform() === 'win32' ? undefined : 0o600;

	// serialize + atomic
	writeQ = writeQ
		.then(async () => {
			await fsp.writeFile(tmp, data, { mode });
			await fsp.rename(tmp, p);
		})
		.catch(() => {})
		.finally(() => {});
	return writeQ;
}

function enc(str) {
	const s = String(str);
	if (!safeStorage.isEncryptionAvailable()) {
		if (STRICT_NO_PLAINTEXT)
			throw new Error('Encryption unavailable on this system');
		return { plaintext: s }; // permissive fallback
	}
	const buf = safeStorage.encryptString(s);
	return { ciphertext: Buffer.from(buf).toString('base64') };
}

function dec(rec) {
	if (!rec) return null;
	if (rec.ciphertext) {
		try {
			return safeStorage.decryptString(Buffer.from(rec.ciphertext, 'base64'));
		} catch {
			return null;
		} // corrupted or not decryptable on this machine
	}
	if (typeof rec.plaintext === 'string') return rec.plaintext; // fallback mode
	return null;
}

// public apis
export async function getSecret(name) {
	const store = readStore();
	return dec(store?.[name]);
}

export async function setSecret(name, value) {
	const n = String(name);
	const v = value == null ? '' : String(value);
	const store = readStore();

	if (!v.trim()) {
		delete store[n]; // empty = delete
		await writeStore(store);
		return null;
	}
	store[n] = enc(v.trim());
	await writeStore(store);
	return v.trim();
}

export async function hasSecret(name) {
	const store = readStore();
	return !!store?.[String(name)];
}
