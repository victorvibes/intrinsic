### Pipeline

1. **Load & Decode**

   - Accepts input from a local file or a remote URL (params.source).
   - Uses Chromium’s built-in decoders to read text/HTML or raw bytes.
   - Detects whether file is a **PDF** (by magic bytes `%PDF`) or **HTML/text**.
   - Rejects files that are too small (< 500 bytes/characters).

2. **Parse**

   - If PDF → uses `extractPDFText` to extract text from selected pages.
   - If HTML/Text → uses `processHTMLText` to clean and normalize text.
   - Ensures parsed text is large enough (> 500 chars) to continue.
   - (If filewriter_raw_abs_path is set) Writes the whole parsed raw text to
     disk for debugging (`ticker_period` file).

3. **Chunk**

   - Uses the `Chunker` class to split the parsed text into meaningful financial
     sections:
     - **Balance Sheet**
     - **Income Statement**
     - **Cash Flow Statement**
   - Scores each section with hits (keyword/indicator matches).
   - Rejects if chunks are too short or contain too few hits.
   - (If filewriter_abs_path is set) Writes each raw chunk to disk
     (`balance_chunk`, `income_chunk`, `cashflow_chunk`).

The Chunker scans the document with a sliding window, looking for keywords
associated with each financial section.

- Normalizes text (lowercase, strips accents) for better matching.
- Slides a window over the content with overlap to avoid missing context.
- Counts indicator hits per window, keeping the best-scoring section.
- Extracts a chunk around the best match with buffer for context.

The result is a set of candidate chunks for Balance, Income, and Cash Flow,
along with hit counts and matched indicators.

4. **Clean**

- Passes raw chunks through `chunksCleaner`.
- Produces cleaned, normalized text for each section + **unit detection** (e.g.,
  thousands/millions).
- Rejects if cleaned text is too small (< 200 chars).
- (If filewriter_abs_path is set) Writes cleaned versions to disk
  (`balance_cleaned`, `income_cleaned`, `cashflow_cleaned`).

The Cleaner transforms raw chunks into normalized, machine-readable financial
text. It removes noise and artifacts while preserving structured data needed for
AI inference. Steps include:

- Normalization: Splits and restructures lines for consistent formatting.
- Filtering: Removes irrelevant rows unless they contain meaningful figures.
- Orphan handling: Reattaches misplaced financial terms (e.g., current assets,
  liabilities) with their numbers.
- Dates: Cleans reporting periods (handles “January 31” and similar).
- Currencies & integers: Strips symbols, harmonizes thousands/millions, converts
  (123) → -123.
- Unit detection: Detects whether values are expressed in units, thousands, or
  millions.
- Postprocessing: Removes overlong lines, table markers, and other clutter.

The output is a cleaned Balance, Income, and Cash Flow section plus a detected
unit multiplier.

5. **Inference**

   - Calls `window.api.runAI` with cleaned chunks and hit counts.
   - AI extracts **structured financial data** (numbers like revenue, net
     income, assets, etc.).
   - Tracks token usage per section.
   - (If filewriter_abs_path is set) Writes results to disk
     (`inference_results.json`) including units + extracted data.

Inference transforms the cleaned chunks into structured JSON objects through a
two-step AI pipeline:

- Cleaner prompt: Refines the text, removing residual formatting noise.
- Submitter prompt: Extracts specific figures (revenue, total assets, cash
  flows, etc.) into a strict JSON schema.
- Additional safeguards:
- Schema enforcement ensures consistent, machine-readable output (numbers only,
  no extra fields).
- Unit handling applies the detected scale (thousands/millions).
- Token tracking measures LLM usage per section.

Output: Standardized Balance, Income, and Cash Flow objects with extracted
values, ready for postprocessing.

6. **Postprocess**

   - Runs extracted AI output through the `postprocessor`.
   - Maps/normalizes values into a consistent schema:
     - `current_assets`, `non_current_assets`, `revenue`, `net_income`, `eps`,
       etc.
   - Produces a single, flat object ready for persistence.

7. **Database Write**
   - Saves postprocessed financial data into the database with:
     - `ticker` (company identifier)
     - `period` (reporting period)
     - Structured financial fields.

Except for the LLM inference and the database operations, everything runs on
Electron's renderer side (including parsers).

Chunker and cleaner try to limit LLM token consumption and preprocess the raw
strings so that the inference is faster, cheaper and has a higher chance of
success.
