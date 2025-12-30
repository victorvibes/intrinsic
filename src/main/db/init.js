import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

export function openDb(opts = {}) {
	const {
		dbDir,
		dbFilename = 'intrinsic.sqlite',
		schemaPath: schemaPathOpt,
	} = opts;
	if (!dbDir)
		throw new Error(
			'openDb requires { dbDir } pointing to a writable directory'
		);

	const sqliteDir = dbDir;
	const dbPath = path.join(sqliteDir, dbFilename);

	const schemaPath =
		schemaPathOpt ?? fileURLToPath(new URL('./schema.sql', import.meta.url));

	if (!fs.existsSync(sqliteDir)) fs.mkdirSync(sqliteDir, { recursive: true });

	const dbExisted = fs.existsSync(dbPath);
	const db = new Database(dbPath, { fileMustExist: false });

	db.pragma('journal_mode = WAL');
	db.pragma('busy_timeout = 5000');
	db.pragma('foreign_keys = ON');
	db.pragma('synchronous = NORMAL');
	db.pragma('temp_store = MEMORY');
	db.pragma('cache_size = 2000');
	db.pragma('wal_autocheckpoint = 1000');

	if (!dbExisted) {
		if (!fs.existsSync(schemaPath)) {
			db.close();
			throw new Error(`Schema file not found: ${schemaPath}`);
		}
		const schemaSQL = fs.readFileSync(schemaPath, 'utf8');
		try {
			db.exec('BEGIN;');
			db.exec(schemaSQL);
			db.exec('COMMIT;');
		} catch (e) {
			try {
				db.exec('ROLLBACK;');
			} catch {}
			db.close();
			throw e;
		}
		db.exec('PRAGMA foreign_keys = ON;');
	}

	return db;
}

export function closeDb(db) {
	db.close();
}
