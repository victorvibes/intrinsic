export function getTickersCount(db) {
	const row = db.prepare('SELECT COUNT(*) AS cnt FROM tickers;').get();
	return row ? row.cnt || 0 : 0;
}

export function getTickers(db, page, page_size) {
	const offset = page * page_size;
	const rows = db
		.prepare(
			`
      SELECT ticker, last_update
      FROM tickers
      ORDER BY last_update DESC, ticker ASC
      LIMIT ? OFFSET ?;
    `
		)
		.all(page_size, offset);

	return rows.map((r) => ({
		ticker: r.ticker,
		last_update:
			typeof r.last_update === 'string'
				? r.last_update
				: new Date(r.last_update).toISOString(),
	}));
}

export function addFinances(db, ticker, period, postprocessed) {
	try {
		const insert = db.transaction(() => {
			const now = Math.floor(Date.now() / 1000);

			db.prepare(
				`
            INSERT INTO tickers (ticker, last_update)
            VALUES (?, ?)
            ON CONFLICT(ticker) DO UPDATE SET last_update = excluded.last_update;
            `
			).run(ticker, now);

			const year = parseInt(period.slice(0, 4), 10);
			const period_type = period.slice(5);

			const columns = [
				'current_assets',
				'non_current_assets',
				'eps',
				'cash_and_equivalents',
				'cash_flow_from_financing',
				'cash_flow_from_investing',
				'cash_flow_from_operations',
				'revenue',
				'current_liabilities',
				'non_current_liabilities',
				'net_income',
			];

			const placeholders = columns.map(() => '?').join(', ');

			db.prepare(
				`
            INSERT INTO finances (
                ticker, year, period_type, ${columns.join(', ')}
            )
            VALUES (?, ?, ?, ${placeholders})
            ON CONFLICT(ticker, year, period_type)
            DO UPDATE SET
                ${columns
									.map((c) => `${c} = excluded.${c}`)
									.join(',\n                ')};
            `
			).run(
				ticker,
				year,
				period_type,
				...columns.map((c) => postprocessed[c] ?? null)
			);
		});

		insert();
		return true;
	} catch (err) {
		console.error('addFinances failed:', err);
		return false;
	}
}

export function getTicker(db, ticker) {
	const rows = db
		.prepare(
			`
      SELECT *
      FROM finances
      WHERE ticker = ?
      ORDER BY year ASC, period_type ASC;
    `
		)
		.all(ticker);

	return rows;
}

export function deleteTicker(db, ticker) {
	try {
		const del = db.transaction(() => {
			db.prepare(
				`
        DELETE FROM finances
        WHERE ticker = ?;
        `
			).run(ticker);

			db.prepare(
				`
        DELETE FROM tickers
        WHERE ticker = ?;
        `
			).run(ticker);
		});

		del();
		return true;
	} catch (err) {
		console.error('deleteTicker failed:', err);
		return false;
	}
}

export function deletePeriod(db, ticker, period) {
	try {
		const year = parseInt(period.slice(0, 4), 10);
		const period_type = period.slice(5);

		const stmt = db.prepare(
			`
      DELETE FROM finances
      WHERE ticker = ?
        AND year = ?
        AND period_type = ?;
      `
		);

		stmt.run(ticker, year, period_type);
		return true;
	} catch (err) {
		console.error('deletePeriod failed:', err);
		return false;
	}
}
