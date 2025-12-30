# DATA EXTRACTOR

**IMPORTANT**: keep same cleaning rules in production as in training.

**IMPORTANT**: train on same parsing and cleaning strategy as
[chunk extractor](./ner-roadmap-1.md).

## 1. Collect & organize reports

_Target: > 600._

- Coverage: SEC 10-K/10-Q (~60%), include messy docs (≥10–15%), avoid special
  industries (banks/insurers/energy).
- Diversity rule: ≤3 reports/company (e.g., 1 annual + 1–2 quarterlies). 5–10
  companies per category.
- Storage: /data/raw/{company}/{yyyy}\_{type}.ext
- Track metadata (company, country/GAAP/IFRS, currency, industry, period...).

## 2. Parse

_Keep page boundaries; store steps flag for later debugging._

- Use current Intrinsic parsers (current internal parsers).
- Encoding: force UTF-8; normalize Unicode (NFC/NFKC); remove NBSP (\u00A0), odd
  control chars.

**Output**: /data/text/{doc*id}/page*{n}.txt

## 3. Cleaning & normalization

_Keep headings/labels (“Current Assets”, “Equity”), don’t over-clean tables._
_Keep same regex, whitespace, and minus-sign rules as classifier._

- Refine current Intrinsic cleaner to make broader and less error-prone.
- Numbers: remove thousand separators (keep decimals); standardize minus sign.
- Dates: normalize to ISO YYYY-MM-DD (regex + dateparser).
- Whitespace: collapse multiples but preserve table cues (pipes |, aligned
  spaces).

**Output**: /data/clean/{doc*id}/page*{n}.txt

## 4. Chunker

Use [chunks classifier](./ner-roadmap-1.md).

## 5. Re-chunk for NER

_Encoder models cap at ~512 tokens._

_Re-chunk only the pages/windows selected by the classifier._

- Hugging Face tokenizers (is_split_into_words=True workflow).
- For each selected section page/window, split into overlapping chunks (e.g.,
  448 tokens with 64-token overlap).
- Keep: nearby DATE tokens, line breaks that anchor rows, simple delimiters.

## 6. Label NER dataset

_Token level_

_Label DATE spans (vital for period mapping)_

_Target sizes: MVP 1.5–3k chunks; robust 5–10k chunks._

_Consider creating LLM labeler script_

Entity set (keep small & consistent):

- DATE, ASSET_CURRENT, ASSET_NONCURRENT, LIAB_CURRENT, LIAB_NONCURRENT, REVENUE,
  NET_INCOME, EPS, CASH, CF_OP, CF_FIN, CF_INV.
- Rule: if entity isn’t in a chunk -> don’t label it (avoid teaching guesses).
- Format: JSONL/CoNLL with tokens, labels, company, later add split.
- Acceleration: GPT-assisted pre-labels + human correction (Label
  Studio/Argilla/Prodigy); bootstrap numbers near labels with simple regex, then
  fix.

## 7. Split dataset by company

_Prevent leakage. Layouts repeat across years; we must test on unseen
companies._

- Split: 70/15/15 (train/val/test) by company (issuer).
- Tracking: store company in each example; generate splits once and version
  them.

## 8. Fine-tune

_Pre-tokenize dataset (cache) to speed epochs; keep max_length close to real
median (e.g., 384 if possible)._

- microsoft/deberta-v3-base (encoder-only). If need more: deberta-v3-large
  (slower, +~1–2 F1).
- Hugging Face Transformers + PyTorch (MPS?).
- Epochs: start 3 -> if val F1 rising, go 5 (early stopping).
- Args: load_best_model_at_end=True, metric_for_best_model="f1", warmup, weight
  decay 0.01, LR ≈ 2e-5.
- Metrics: log per-entity F1 (not just overall).

## 9. Post-processing

_NEVER guess: no tagged value -> null._

- Extract spans: collect entities + confidences per chunk.
- Resolve columns/periods:

  - Identify date anchors (top headers or lines below).
  - If two dates at top -> map left->right numbers to those dates.
  - If dates are under numbers -> map bottom-up in the same columns.

- Guard: drop Notes column. Drop first column if it’s monotone small ints (1..n)
  or labeled “Note(s)”.
- Aggregate: across overlapping chunks, pick max-confidence / consistent values;
  prefer the most recent period when duplicates.

**Output**: strict structured JSON with nulls when missing, e.g. {
"assets_current": { "2023-12-31": 10000, "2022-12-31": 9500 }, ... }

- Confidence policy: discard low-confidence entities (e.g., <0.6) to avoid
  random mistakes.

## 10. Export & optimize

_Validate outputs match FP16 within tolerance before switching production to
INT8._

- Quantization: INT8 PTQ (post-training quantization) -> ~2× smaller, tiny F1
  loss (usually <1%).
- Export formats:

  - ONNX (+ ONNX Runtime with MPS/CPU).
  - CoreML (coremltools) for Apple GPU/ANE.

- Artifacts: model (.onnx or .mlmodel), tokenizer files, label map.

## 11. Integrate

Doc -> parser -> cleaner -> chunk classifier -> re-chunk (≤512 tokens) -> NER ->
post-process (dates & Notes) -> JSON

## 12. Monitoring, evaluation and iteration

- Per-entity metrics: track F1 for each field (Equity often lags).
- Active learning loop: collect failures, label 200–500 hard chunks, retrain.
- Regression tests: keep gold set of 20–50 reports; run end-to-end before
  releases.
- Track per-entity failure patterns (e.g., Equity has lower support).
- Versioning: version datasets, splits, model checkpoints, and post-processing
  rules.
- Tools: Weights & Biases or simple CSV logs; unit tests for post-processor.

<details>
<summary><strong>13. Optional upgrades</strong>
- Bigger NER: DeBERTa-v3-large.
- Layout-aware: LayoutLMv3/DocFormer if table alignment is too tricky from text
  alone.
- C/C++ path: ONNX Runtime C API/Core ML C++ for performance; custom tokenizer
with tokenizers (Rust).
</details>
