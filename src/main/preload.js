import { contextBridge, ipcRenderer, clipboard } from 'electron';

contextBridge.exposeInMainWorld('api', {
	// db
	getTickersCount: () => ipcRenderer.invoke('db:getTickersCount'),
	getTickers: (page, pageSize) =>
		ipcRenderer.invoke('db:getTickers', { page, pageSize }),
	getTicker: (ticker) => ipcRenderer.invoke('db:getTicker', { ticker }),
	deleteTicker: (ticker) => ipcRenderer.invoke('db:deleteTicker', { ticker }),
	deletePeriod: (ticker, period) =>
		ipcRenderer.invoke('db:deletePeriod', { ticker, period }),
	addFinances: (ticker, period, postprocessed) =>
		ipcRenderer.invoke('db:addFinances', { ticker, period, postprocessed }),
	getDbPath: () => ipcRenderer.invoke('db:getPath'),

	// app
	app: {
		shutdown: () => ipcRenderer.send('app:shutdown'),
		getVersion: () => ipcRenderer.invoke('app:getVersion'),
		updateVersion: () => ipcRenderer.invoke('app:updateVersion'),
		nuke: () => ipcRenderer.send('app:nuke'),
	},

	// fs
	selectFile: () => ipcRenderer.invoke('dialog:openFile'),
	fileWriter: (filename, content, isRaw) =>
		ipcRenderer.invoke('fileWriter', filename, content, isRaw),
	readFileBuffer: (filePath) => ipcRenderer.invoke('readFileBuffer', filePath),

	// ai
	runAI: (cleanedChunks, hits, minHits, period) =>
		ipcRenderer.invoke('ai:run', cleanedChunks, hits, minHits, period),

	// user data
	userData: {
		get: () => ipcRenderer.invoke('userData:get'),
		update: (partial) => ipcRenderer.invoke('userData:update', partial),
	},

	// secrets
	secrets: {
		has: (name) => ipcRenderer.invoke('secrets:has', name),
		set: (name, value) => ipcRenderer.invoke('secrets:set', { name, value }),
	},

	// various
	copyToClipboard: (text) => {
		clipboard.writeText(text);
		return true;
	},
});
