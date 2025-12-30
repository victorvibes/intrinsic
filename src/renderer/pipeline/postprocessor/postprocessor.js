export const constraints = {
	units: {
		min: 1,
		max: 1e6,
	},
	current_assets: {
		min: 0,
		max: 1e14,
	},
	non_current_assets: {
		min: 0,
		max: 1e14,
	},
	eps: {
		min: -1e5,
		max: 1e5,
	},
	cash_and_equivalents: {
		min: 0,
		max: 1e14,
	},
	cash_flow_from_financing: {
		min: -1e14,
		max: 1e14,
	},
	cash_flow_from_investing: {
		min: -1e14,
		max: 1e14,
	},
	cash_flow_from_operations: {
		min: -1e14,
		max: 1e14,
	},
	revenue: {
		min: 0,
		max: 1e14,
	},
	current_liabilities: {
		min: 0,
		max: 1e14,
	},
	non_current_liabilities: {
		min: 0,
		max: 1e14,
	},
	net_income: {
		min: -1e14,
		max: 1e14,
	},
};

export function validateEditedField(key, value) {
	if (value == null) return true; // allow emtpy fields
	if (!value && value !== 0) return false;
	if (typeof value !== 'number' || isNaN(value)) return false;
	if (value < constraints[key].min || value > constraints[key].max)
		return false;
	return true;
}

export function postprocessor(inferenceResults) {
	/*
    inferenceResults = {
        tokens: {
            input: number,
            output: number,
        },
        balance: {
            inputTokens?: number,
            outputTokens?: number,
            units: number | null,
            cash_and_equivalents: number | null,
            current_assets: number | null,
            non_current_assets: number | null,
            total_assets: number | null,
            current_liabilities: number | null,
            non_current_liabilities: number | null,
            total_liabilities: number | null,
            equity: number | null,
        },
        income: {
            inputTokens?: number,
            outputTokens?: number,
            units: number | null,
            revenue: number | null,
            net_income: number | null,
            eps: number | null,
        },
        cashFlow: {
            inputTokens?: number,
            outputTokens?: number,
            units: number | null,
            cash_flow_from_operations: number | null,
            cash_flow_from_investing: number | null,
            cash_flow_from_financing: number | null,
        }
    }
    */
	if (!inferenceResults) {
		console.error('Inference results are null or undefined');
		return inferenceResults;
	}

	const postprocessed = {
		current_assets: null,
		non_current_assets: null,
		eps: null,
		cash_and_equivalents: null,
		cash_flow_from_financing: null,
		cash_flow_from_investing: null,
		cash_flow_from_operations: null,
		revenue: null,
		current_liabilities: null,
		non_current_liabilities: null,
		net_income: null,
	};

	const validateField = (value, { min, max }) => {
		if (!value && value !== 0) return null;
		if (typeof value !== 'number' || isNaN(value)) return null;
		if (value < min || value > max) return null;
		return value;
	};

	const applyUnits = (value, units, isEps = false) => {
		if (value === null) return null;
		if (isEps) return parseFloat(value.toFixed(4));
		return Math.round(value * (units || 1));
	};

	const balanceUnits =
		validateField(inferenceResults.balance?.units, constraints.units) || 1;
	const incomeUnits =
		validateField(inferenceResults.income?.units, constraints.units) || 1;
	const cashFlowUnits =
		validateField(inferenceResults.cashFlow?.units, constraints.units) || 1;

	const epsVal = validateField(inferenceResults.income?.eps, constraints.eps);
	if (epsVal !== null && Number.isFinite(epsVal)) {
		postprocessed.eps = applyUnits(epsVal, 1, true);
	}

	postprocessed.net_income = applyUnits(
		validateField(inferenceResults.income?.net_income, constraints.net_income),
		incomeUnits
	);
	postprocessed.revenue = applyUnits(
		validateField(inferenceResults.income?.revenue, constraints.revenue),
		incomeUnits
	);

	postprocessed.cash_flow_from_operations = applyUnits(
		validateField(
			inferenceResults.cashFlow?.cash_flow_from_operations,
			constraints.cash_flow_from_operations
		),
		cashFlowUnits
	);
	postprocessed.cash_flow_from_investing = applyUnits(
		validateField(
			inferenceResults.cashFlow?.cash_flow_from_investing,
			constraints.cash_flow_from_investing
		),
		cashFlowUnits
	);
	postprocessed.cash_flow_from_financing = applyUnits(
		validateField(
			inferenceResults.cashFlow?.cash_flow_from_financing,
			constraints.cash_flow_from_financing
		),
		cashFlowUnits
	);

	postprocessed.cash_and_equivalents = applyUnits(
		validateField(
			inferenceResults.balance?.cash_and_equivalents,
			constraints.cash_and_equivalents
		),
		balanceUnits
	);

	postprocessed.current_assets = applyUnits(
		validateField(
			inferenceResults.balance?.current_assets,
			constraints.current_assets
		),
		balanceUnits
	);

	if (inferenceResults.balance?.total_assets == null) {
		postprocessed.non_current_assets = applyUnits(
			validateField(
				inferenceResults.balance?.non_current_assets,
				constraints.non_current_assets
			),
			balanceUnits
		);
	} else if (inferenceResults.balance?.current_assets != null) {
		const nonCurrent =
			inferenceResults.balance.total_assets -
			inferenceResults.balance.current_assets;
		postprocessed.non_current_assets = applyUnits(
			validateField(nonCurrent, constraints.non_current_assets),
			balanceUnits
		);
	}

	postprocessed.current_liabilities = applyUnits(
		validateField(
			inferenceResults.balance?.current_liabilities,
			constraints.current_liabilities
		),
		balanceUnits
	);

	const totalLiab = inferenceResults.balance?.total_liabilities;
	const currLiab = inferenceResults.balance?.current_liabilities;
	if (
		totalLiab != null &&
		currLiab != null &&
		Math.abs(totalLiab) - Math.abs(currLiab) > 0
	) {
		const nonCurrent = Math.abs(totalLiab) - Math.abs(currLiab);
		postprocessed.non_current_liabilities = applyUnits(
			validateField(nonCurrent, constraints.non_current_liabilities),
			balanceUnits
		);
	} else if (inferenceResults.balance?.non_current_liabilities != null) {
		postprocessed.non_current_liabilities = applyUnits(
			validateField(
				inferenceResults.balance.non_current_liabilities,
				constraints.non_current_liabilities
			),
			balanceUnits
		);
	} else {
		let totalAssets = 0;
		if (inferenceResults.balance?.total_assets != null) {
			totalAssets = inferenceResults.balance.total_assets;
		} else if (
			inferenceResults.balance?.current_assets != null &&
			inferenceResults.balance?.non_current_assets != null
		) {
			totalAssets =
				inferenceResults.balance.current_assets +
				inferenceResults.balance.non_current_assets;
		}
		if (
			inferenceResults.balance?.equity != null &&
			currLiab != null &&
			totalAssets !== 0
		) {
			const nonCurrent =
				totalAssets - inferenceResults.balance.equity - Math.abs(currLiab);
			if (nonCurrent > 0) {
				postprocessed.non_current_liabilities = applyUnits(
					validateField(nonCurrent, constraints.non_current_liabilities),
					balanceUnits
				);
			}
		}
	}

	if (postprocessed.non_current_liabilities == null) {
		postprocessed.non_current_liabilities = applyUnits(
			validateField(
				inferenceResults.balance?.non_current_liabilities,
				constraints.non_current_liabilities
			),
			balanceUnits
		);
	}

	return postprocessed;
}

/*
    postprocessed = {
        current_assets              INTEGER,
        non_current_assets          INTEGER,
        eps                         REAL,
        cash_and_equivalents        INTEGER,
        cash_flow_from_financing    INTEGER,
        cash_flow_from_investing    INTEGER,
        cash_flow_from_operations   INTEGER,
        revenue                     INTEGER,
        current_liabilities         INTEGER,
        non_current_liabilities     INTEGER,
        net_income                  INTEGER,
    }
*/
