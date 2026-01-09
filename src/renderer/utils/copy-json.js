export const NORMALIZE_MAP = [
	['revenue'],
	['net_income'],
	['eps'],
	['net_margin'],
	['roa'],
	['roe'],

	['cash_flow_from_operations'],
	['cash_flow_from_investing'],
	['cash_flow_from_financing'],

	['cash_and_equivalents'],
	['current_assets'],
	['non_current_assets'],
	['total_assets'],
	['current_liabilities'],
	['non_current_liabilities'],
	['total_liabilities'],
	['equity'],

	['working_capital'],
	['wc_ncl', 'working_capital_to_non_current_liabilities'], // rename
	['liquidity', 'current_ratio'], // rename
	['leverage', 'liabilities_to_equity'], // rename
	['solvency', 'assets_to_liabilities'], // rename

	['shares'],
	['book_value'],
	['p_bv', 'price_to_book'], // rename
	['per'],

	['cap', 'market_cap'], // rename
	['ev', 'enterprise_value'], // rename
	['ev_cap', 'enterprise_value_to_market_cap'], // rename
	['ev_cfo', 'enterprise_value_to_cash_flow_from_operations'], // rename
	['ev_net_income', 'enterprise_value_to_net_income'], // rename

	['score', null], // explicitly remove
];

// normalize with ordering + renames + drop nulls/score
export function normalizeMetrics(obj) {
	const out = {};
	const handled = new Set();

	// apply ordered map
	for (const [src, dst] of NORMALIZE_MAP) {
		if (!(src in obj)) continue;
		handled.add(src);

		const v = obj[src];
		if (v == null) continue; // drop nulls
		if (dst === null) continue; // explicit drop

		const key = dst ?? src; // rename or keep same
		out[key] = v; // insertion order preserved
	}

	// append remaining keys not mentioned in map
	for (const [k, v] of Object.entries(obj)) {
		if (handled.has(k)) continue;
		if (v == null) continue;
		out[k] = v; // keep original name
	}

	return out;
}

export function prettifyPeriodKey(periodKey) {
	const match = /^(\d{4})-(Y|S[12]|Q[1-4])$/i.exec(periodKey);
	if (!match) return periodKey;

	const [, year, tagRaw] = match;
	const tag = tagRaw.toUpperCase();

	const map = {
		Y: 'Full Year',
		S1: 'First Half',
		S2: 'Second Half',
		Q1: 'First Quarter',
		Q2: 'Second Quarter',
		Q3: 'Third Quarter',
		Q4: 'Fourth Quarter',
	};

	const label = map[tag] || tag;
	return `${year} ${label}`;
}
