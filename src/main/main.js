import { app, BrowserWindow, dialog, ipcMain, Menu } from 'electron';
import { openDb, closeDb } from './db/init.js';
import {
	initUserData,
	loadUserData,
	getUserData,
	mergeUserData,
	getUserDataPath,
} from './utils/user-data.js';
import { fileWriter } from './utils/file-writer.js';
import {
	getTickersCount,
	getTickers,
	getTicker,
	addFinances,
	deletePeriod,
	deleteTicker,
} from './db/queries.js';
import { resetAI, runAI } from './ai/inference.js';
import path from 'path';
import fsp from 'fs/promises';
import { fileURLToPath } from 'url';
import { hasSecret, setSecret } from './utils/secrets.js';
import { nuke } from './utils/nuke.js';
import { getVersion } from './utils/version.js';
import { updateVersion } from './utils/update.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.setName('Intrinsic');

// single-instance lock
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
	app.quit();
	process.exit(0);
}

let mainWindow = null;
let db = null;
const allowDevTools =
	process.env.NODE_ENV === 'development' ||
	process.env.ELECTRON_DEVTOOLS === '1';

// ---- Window ----
function createWindow() {
	mainWindow = new BrowserWindow({
		width: 900,
		height: 650,
		frame: false,
		resizable: false,
		backgroundColor: '#e6e6e6',
		show: false,
		webPreferences: {
			preload: path.join(__dirname, 'preload.js'),
			contextIsolation: true,
			nodeIntegration: false,
			sandbox: false,
			devTools: allowDevTools,
		},
	});

	if (process.env.NODE_ENV === 'development') {
		mainWindow.loadURL('http://localhost:5173');
	} else {
		mainWindow.loadFile(path.join(__dirname, '../../dist/renderer/index.html'));
	}

	mainWindow.once('ready-to-show', () => {
		mainWindow.show();
	});

	if (!allowDevTools) {
		if (process.platform !== 'darwin') {
			mainWindow.setAutoHideMenuBar(true);
			mainWindow.setMenuBarVisibility(false);
		}

		const template = [
			{
				label: 'Intrinsic',
				submenu: [{ role: 'about' }, { type: 'separator' }, { role: 'quit' }],
			},
			{
				label: 'Edit',
				submenu: [
					{ role: 'undo' },
					{ role: 'redo' },
					{ type: 'separator' },
					{ role: 'cut' },
					{ role: 'copy' },
					{ role: 'paste' },
					{ type: 'separator' },
					{ role: 'selectAll' },
				],
			},
		];
		Menu.setApplicationMenu(Menu.buildFromTemplate(template));
	}
}

app.on('second-instance', () => {
	if (mainWindow) {
		if (mainWindow.isMinimized()) mainWindow.restore();
		mainWindow.focus();
	}
});

// ---- lifecycle ----
app.whenReady().then(async () => {
	// ---- userData ----
	initUserData();
	const prefs = loadUserData({
		// defaults:
		lang: 'EN',
		accent: 'rgba(255, 255, 255, 0.3)',
		ttm: true,
		sortBy: 'Sub',
		sortOrder: 'Desc',
		provider: 'openai',
		model: 'gpt-5-mini',
		filewriter_abs_path: '',
		filewriter_raw_abs_path: '',
	});
	if (process.env.NODE_ENV === 'development') {
		console.log('userData file:', getUserDataPath());
		console.log('userData loaded:', prefs);
	}

	// ---- db ----
	try {
		const dbDir = path.join(app.getPath('userData'), 'sqlite');
		const dbName = 'intrinsic.sqlite';
		db = openDb({ dbDir, dbFilename: dbName });
		if (process.env.NODE_ENV === 'development') {
			console.log('DB path:', path.join(dbDir, dbName));
		}
	} catch (err) {
		console.error('Could not open database:', err);
		dialog.showErrorBox('Database Error', String(err));
		app.quit();
		setTimeout(() => process.exit(1), 3000); // belt & suspenders
		return; // stop startup
	}

	ipcMain.handle('userData:get', async () => getUserData());

	ipcMain.handle('userData:update', async (_e, partial) => {
		await mergeUserData(partial || {});
		return getUserData();
	});

	ipcMain.handle('db:getTickersCount', () => {
		try {
			return getTickersCount(db);
		} catch (err) {
			console.error('db:getTickersCount failed:', err);
			return { error: err.message };
		}
	});

	ipcMain.handle('db:getTickers', (e, { page, pageSize }) => {
		try {
			const p = Number.isInteger(page) ? page : 0;
			const ps = Number.isInteger(pageSize) ? pageSize : 20;
			return getTickers(db, p, ps);
		} catch (err) {
			console.error('db:getTickers failed:', err);
			return { error: err.message };
		}
	});

	ipcMain.handle('db:getTicker', (e, { ticker }) => {
		try {
			if (!ticker) throw new Error('Ticker is required');
			return getTicker(db, ticker);
		} catch (err) {
			console.error('db:getTicker failed:', err);
			return { error: err.message };
		}
	});

	ipcMain.handle('db:deleteTicker', (e, { ticker }) => {
		try {
			return deleteTicker(db, ticker);
		} catch (err) {
			console.error('db:deleteTicker failed:', err);
			return { error: err.message };
		}
	});

	ipcMain.handle('db:deletePeriod', (e, { ticker, period }) => {
		try {
			return deletePeriod(db, ticker, period);
		} catch (err) {
			console.error('db:deletePeriod failed:', err);
			return { error: err.message };
		}
	});

	ipcMain.handle('db:addFinances', (e, { ticker, period, postprocessed }) => {
		try {
			const ok = addFinances(db, ticker, period, postprocessed);
			return ok;
		} catch (err) {
			console.error('db:addFinances failed:', err);
			return false;
		}
	});

	ipcMain.handle('dialog:openFile', async () => {
		const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
			properties: ['openFile'],
			filters: [
				{
					name: 'Supported Files',
					extensions: ['pdf', 'html', 'xhtml', 'xml', 'mht', 'mhtml'],
				},
			],
		});
		if (canceled) return null;
		return filePaths[0];
	});

	ipcMain.handle('fileWriter', async (_event, filename, content, isRaw) => {
		return fileWriter(filename, content, isRaw);
	});

	ipcMain.handle('readFileBuffer', async (_event, filePath) => {
		try {
			const buf = await fsp.readFile(filePath);
			return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
		} catch (err) {
			console.error('Error reading file:', err);
			return null;
		}
	});

	ipcMain.handle(
		'ai:run',
		async (_event, cleanedChunks, hits, minHits, period) => {
			try {
				return await runAI(cleanedChunks, hits, minHits, period);
			} catch (err) {
				console.error('AI request failed:', err);
				return null;
			}
		}
	);

	ipcMain.handle('secrets:has', async (_e, name) => {
		if (!name) return false;
		return hasSecret(String(name));
	});

	ipcMain.handle('secrets:set', async (_e, { name, value }) => {
		const keyName = String(name || '');
		if (!keyName) return { ok: false, error: 'Missing name' };
		try {
			await setSecret(keyName, value);
			if (keyName.startsWith('STRUCTURED_AI_')) resetAI();
			return { ok: true };
		} catch (e) {
			return { ok: false, error: e?.message || String(e) };
		}
	});

	ipcMain.on('app:shutdown', () => {
		if (mainWindow) {
			mainWindow.destroy();
		}
		app.quit();
	});

	ipcMain.handle('app:getVersion', () => getVersion());

	ipcMain.handle('app:updateVersion', async () => {
		try {
			await updateVersion(); // throws on failure

			// give file ops moment to flush, then quit
			setTimeout(() => {
				try {
					app.quit();
				} catch {}
			}, 500);

			return { ok: true };
		} catch (e) {
			const msg = e?.message || String(e);
			console.error('[update] failed:', msg);
			dialog.showErrorBox('Update failed', msg);
			return { ok: false, error: msg };
		}
	});

	ipcMain.on('app:nuke', () => {
		nuke({ db, closeDb, resetAI });
	});

	createWindow();

	app.on('activate', () => {
		if (BrowserWindow.getAllWindows().length === 0) createWindow();
	});
});

app.on('before-quit', () => {
	if (db) {
		try {
			closeDb(db);
		} catch {}
		db = null;
	}
});

app.on('will-quit', () => {
	if (db) {
		try {
			closeDb(db);
		} catch {}
		db = null;
	}
});

app.on('browser-window-created', (_, window) => {
	if (!allowDevTools) {
		window.webContents.on('before-input-event', (event, input) => {
			if (
				(input.control || input.meta) &&
				input.shift &&
				input.key.toLowerCase() === 'i'
			)
				event.preventDefault();
			if (input.key === 'F12') event.preventDefault();
		});
	}
});

app.on('window-all-closed', () => {
	if (process.platform !== 'darwin') app.quit();
});
