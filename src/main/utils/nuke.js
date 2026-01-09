import { app } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

// safe recursive removal -> paths inside user's home dir, never home or root
function safeRmDir(target) {
	try {
		if (!target || typeof target !== 'string') return;
		const resolved = path.resolve(target);

		const home = path.resolve(app.getPath('home'));
		if (!resolved.startsWith(home + path.sep)) return; // must be under home

		// hard stops
		const forbidden = [home, path.parse(resolved).root];
		if (forbidden.includes(resolved)) return;

		fs.rmSync(resolved, { recursive: true, force: true });
	} catch (err) {
		console.warn(`[nuke] Could not remove ${target}:`, err.message);
	}
}

// nukes all per-user app data, resets in-memory clients -> relaunches.
export function nuke({ db, closeDb, resetAI } = {}) {
	// db
	try {
		if (db && typeof closeDb === 'function') {
			closeDb(db);
		}
	} catch {}

	// AI clients
	try {
		if (typeof resetAI === 'function') resetAI();
	} catch {}

	// remove user-scoped data
	const userData = app.getPath('userData'); // settings, db dir, cookies, localStorage, secrets.json...
	const cacheDir = app.getPath('cache'); // GPU/code cache, etc.

	safeRmDir(userData);
	safeRmDir(cacheDir);

	// relaunch -> factory fresh
	app.relaunch();
	app.exit(0);
}
