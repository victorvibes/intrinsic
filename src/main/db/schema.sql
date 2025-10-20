-- ---------------------------------------------------------------------
-- Stores each ticker symbol, and timestamp of last update
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tickers (
    ticker      TEXT    PRIMARY KEY,
    last_update INTEGER NOT NULL
) WITHOUT ROWID;

CREATE INDEX IF NOT EXISTS idx_tickers_order ON tickers(last_update DESC, ticker ASC);

-- ---------------------------------------------------------------------
-- Stores all financial records for each ticker, one entry per period
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS finances (
    ticker                      TEXT    NOT NULL,
    year                        INTEGER NOT NULL,
    period_type                 TEXT    NOT NULL,
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
    PRIMARY KEY (ticker, year, period_type),
    FOREIGN KEY (ticker) REFERENCES tickers(ticker) ON DELETE CASCADE
) WITHOUT ROWID;
