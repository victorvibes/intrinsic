# CHUNKS CLASSIFIER

**Input**: page text or 8–12k-char window.

**Output**: one of {BALANCE_SHEET, INCOME_STATEMENT, CASH_FLOW, OTHER} +
calibrated confidence

**Constraints**: heterogeneous formats (US GAAP...), noise, hallucinations.

**IMPORTANT**: train on same parsing and cleaning strategy as
[data extractor](./ner-roadmap-2.md).

## Minimal build checklist:

- Seed data:
  - 500/class.
  - Company-level split 70/15/15.
- Models:
  - Primary model: DeBERTa-v3-base.
  - Secondary: TF-IDF + LR with isotonic calibration.
  - Ensemble: 0.7 transformer + 0.3 TF-IDF.
- Calibration:
  - Temperature scaling on val.
  - Set per-class thresholds.
- Smoothing: neighbor voting, document order prior, lexicon tie-breakers.
- Hard negatives:
  - Mine false positives -> retrain.
- Export: models to ONNX, INT8 for transformer.
- Integrate:
  - Route pages/windows.
  - Keep top 1–2 per section.
  - Expose confidence + rationale.
- Monitor:
  - macro-F1, per-class F1, ECE, FP on OTHER
  - Weekly active learning.

## 1. Data & splits

_Consider creating LLM labeler script_

_Keep UTF-8, normalize NBSP/dashes, collapse whitespace, keep headings/table
(pipes, alignment)._

- Collect balanced labeled pages/windows per class (> 500/class).
- Company-level split (issuer never in more than one split):
  `70/15/15 train/val/test.`
- Track metadata: company, country, industry, year. Will use for stratified
  sampling and error analysis.
- Test a reliable cleaner.

## 2. Model strategy

### Primary model: microsoft/deberta-v3-base

```
epochs = 3 -> up to 5 with early stopping (patience 1–2 evals)
lr = 2e-5
weight_decay = 0.01
warmup_ratio = 0.10
max_length = 1024 if input length exceeds 512, or 512 if pre-trimmed to 4–6k chars
use class weights or oversampling to balance OTHER
label_smoothing = 0.1 (reduces overconfidence, especially on noise)
```

- Save best F1 checkpoint, load_best_model_at_end=True

### Secondary model: TF-IDF + Logistic Regression

_Classical, interpretable, tiny, explains decisions, serves as fallback
validator when transformer is uncertain._

- TF-IDF + Logistic Regression (n-grams 1–3) with isotonic calibration.
- Export top n-grams per class as data-driven lexicons.

### Late-fusion ensemble

_Robustness_

**At inference:**

- Get p_trf = softmax(transformer) and p_tfidf = calibrated_proba(tfidf).
- Combine: p = 0.7 x p_trf + 0.3 x p_tfidf

_Reduces brittle errors and helps on odd headings._

## 3. Hard-negative mining

_Precision booster. After first train:_

- Score lots of unlabeled pages.
- For each non-target class, collect false positives with high confidence.
- Add to training as hard negatives.
- Retrain.
- Do 1–2 rounds.

## 4. Calibration & thresholds

_No confidently wrong_

- On validation set, fit temperature scaling (or use isotonic from TF-IDF leg).
- Choose class-specific acceptance thresholds, e.g.:

```
If max_prob ≥ 0.80 -> accept.
If 0.60–0.80 -> consult lexicon votes + neighbor smoothing.
If <0.60 -> label OTHER/unsure.
```

## 5. Contextual smoothing

- **Neighbor votes (t−1 / t+1)**: If page t uncertain but pages t−1 and t+1 are
  confidently BALANCE_SHEET, boost t to Balance (within a small delta).
- **Canonical order prior**: Some reports present sections in the canonical
  order (Balance -> Income -> Cash Flow). Use as a weak prior if confidences are
  close.
- **Lexicon tie-breakers**: If ensemble is unsure and Balance lexicon has strong
  hits (consolidated balance, financial position) while others don’t, break ties
  toward Balance.

## 6. Training quality gates

_Acceptance criteria_

```
Macro-F1 (val) ≥ 0.97
Per-class F1 ≥ 0.96 on BALANCE, INCOME, CASH_FLOW
False-positive rate on OTHER < 2%
Calibrated confidence: ECE (expected calibration error) < 3–5%
(Optional: Track by source (SEC...).)
```

## 7. Inference rules

_Deterministic safety layer_

```
- Top-K per section: Keep top 1–2 windows/pages per target class per document.
- Apply minimum page distance between picks to avoid duplicates (e.g., if top two
are adjacent and nearly identical, keep best).
- If no section clears threshold, return “unsure” and fall back to a regex header
search using your lexicons.
```

## 8. Export & deployment

_Ideas_

- Transformer classifier -> ONNX (via optimum / transformers.onnx), INT8 PTQ
  with ONNX Runtime quantization.
- TF-IDF pipeline -> ONNX (skl2onnx).
- Runtime: onnxruntime-node (CPU is fine; MPS/Metal backend optional).
- Tokenization: HF Tokenizers (Node/Rust bindings) or pre-tokenize server-side.

Bundle:

- section_clf_trf.onnx (+ tokenizer files)
- section_clf_tfidf.onnx (+ vocab)
- lexicons.json (learned top n-grams per class)
- thresholds.json (per-class acceptance thresholds)

## 9. Operational loop

_Keep precision over time_

- Logging: store (company, page_id, predicted_label, prob, accepted/rejected,
  top_ngrams) for each decision.
- Review queue: sample low-confidence and mistakes weekly; label only those ->
  retrain.
- Regression set: keep 50–100 pages (diverse) as frozen gold set; require no
  regressions before promotion.
