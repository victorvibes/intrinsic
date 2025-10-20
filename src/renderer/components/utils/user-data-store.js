const subscribers = new Set();

// in-memory global reactive store for userData

// renderer defaults
let state = {
	lang: 'EN',
	ttm: true,
	accent: 'rgba(65, 102, 245, 0.3)',
	sortBy: 'Sub',
	sortOrder: 'Desc',
};
let ready = false;
let queue = Promise.resolve();

function notify() {
	for (const cb of subscribers) {
		try {
			cb(state);
		} catch {}
	}
}

function shallowEqualKeys(objA, objB, keys) {
	for (const k of keys) if (objA[k] !== objB[k]) return false;
	return true;
}

async function init() {
	if (ready) return state;
	try {
		const saved = await window.api.userData.get();
		if (saved && typeof saved === 'object') {
			state = { ...state, ...saved };
		}
	} catch (err) {
		console.error('userDataStore.init failed:', err);
	} finally {
		ready = true;
	}
	notify();
	return state;
}

function get() {
	return state;
}

function subscribe(cb) {
	subscribers.add(cb);
	// immediate sync
	try {
		cb(state);
	} catch {}
	// auto-hydrate if not ready yet (fire-and-forget)
	if (!ready) init();
	return () => subscribers.delete(cb);
}

async function update(patch) {
	// validate patch
	if (!patch || typeof patch !== 'object' || Array.isArray(patch)) return true;

	const keys = Object.keys(patch);
	if (keys.length === 0) return true;

	const next = { ...state, ...patch };
	if (shallowEqualKeys(next, state, keys)) return true;

	// optimistic merge + notify
	state = next;
	notify();

	// serialize persistence; return *this call's* task
	const task = queue.then(async () => {
		try {
			await window.api.userData.update(patch);
			return true;
		} catch (err) {
			console.error('userDataStore.update failed:', err);
			// recovery: re-hydrate from source of truth
			try {
				const fresh = await window.api.userData.get();
				if (fresh && typeof fresh === 'object') {
					state = { ...state, ...fresh };
					notify();
				}
			} catch (rehydrateErr) {
				console.error('userDataStore.rehydrate failed:', rehydrateErr);
			}
			return false;
		}
	});

	// advance the queue but don't couple callers to future tasks
	queue = task.then(
		() => {},
		() => {}
	);
	return task;
}

export const userDataStore = { init, get, subscribe, update };
