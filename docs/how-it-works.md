# How It Works

jev-pii-checker detects PII through three layers: a categorical gate, regex pattern extraction, and Jev-powered name judgment. The three-layer approach balances cost, accuracy, and coverage.

## Layer 1: Categorical Gate

The gate runs Jev once per document chunk to answer 12 binary questions: "Does this text contain [category]?"

**12 PII Categories:**

- person_name, email_or_phone, postal_address, date_of_birth
- government_id, financial_account, health_info, biometric
- ip_address_of_a_person, sns_handle, employment_info, race_or_religion

The gate also produces a **sensitivity score** (none / low / high) using the IBM taxonomy:

- **none**: No identifiable information
- **low**: Contact or basic details (name, phone, email, address, birthday, job) but low direct harm risk
- **high**: Government ID, financial account, health, biometric information, or sensitive fact lists

**Purpose**: Screen the text before expensive detailed extraction. If the gate says "no person names," don't bother extracting names.

**Cost**: ~500 tokens per chunk, answered all at once.

## Layer 2: Regex Extraction

Extract surface patterns:

- **Email**: RFC 5322 simplified (reject noreply@, corporate addresses)
- **Phone**: JP (+81, 090-xxxx, 0120) and international (+1 555, etc.)
- **Digit Strings**: 10–16 chars; filter corporate patterns (payment gateways, order numbers, IPs)

**Cost**: Zero—purely pattern matching.

**Output**: Candidate spans with no judgment. Not all emails/phones are PII (e.g., support hotlines).

## Layer 3: Jev Judgment

For each candidate, ask: "Is this the [type] of an identifiable individual (vs. system/corporate)?"

**For emails**: "Is this a personal contact vs. support line / noreply?"

**For phones**: "Is this a personal number vs. business line?"

**For names**: Generate candidates via `Intl.Segmenter`, batch-judge them, then assemble overlapping spans and attach titles.

**Cost**: One token per question. Up to 25 candidates can be asked in a single request.

**Output**: Probability per candidate. Filter by `--span-threshold` (default 0.8).

## Chunking

Text longer than `--max-chars` (default 4000 bytes) is split at paragraph or sentence boundaries:

1. Split on `\n\n` (paragraph breaks) if chunks fit
2. Otherwise split on `.`, `!`, `?` (sentence ends) if chunks fit
3. Otherwise split on `\n` (line breaks) if chunks fit
4. Fall back to fixed 4000-byte chunks

**Per-document aggregation**: Results are merged (max sensitivity, max per-category probability).

## Name Extraction

Japanese names and English names are both extracted via `Intl.Segmenter('ja')` or `Intl.Segmenter('en')`.

1. **Candidate generation**: Segmenter produces overlapping windows (bigrams, trigrams, etc.)
2. **Batch judgment**: Send up to 25 candidates to Jev in one request
3. **Span assembly**: Overlapping candidates with high probability are merged
4. **Title attachment**: Common titles (Mr., Mrs., 様, さん, 部長) are attached if found nearby

**Limitation**: Japanese names with particles (助詞) or titles may be split or merged unexpectedly. E.g., "佐藤 部長" might become two spans instead of one.

## Why This Layering?

| Step         | Cost                  | Why                                |
| ------------ | --------------------- | ---------------------------------- |
| Gate         | ~500 tokens           | Filter out irrelevant chunks early |
| Regex        | $0                    | Find obvious candidates fast       |
| Jev judgment | ~1 token per question | Judge only what patterns found     |

**Total typical cost per chunk**: ~600 tokens per 4000 bytes (one gate + ~100 candidate judgments).

**Contrast**:

- **Regex only**: High false positives (server IPs flagged as personal)
- **Jev on all text**: 2500+ tokens per chunk (cost prohibitive)
- **jev-pii-checker**: 600 tokens per chunk with high accuracy

## API Details

All communication is with TypeSafe's Jev API via the `@typesafe-ai/sdk`. The SDK handles retry, rate limiting, and error recovery.

**Questions are embedded literally**: Jev cannot reference candidate arrays by index. Instead, candidates are spelled out in the question: `'Is the email "user@example.com" personal...'`

This is why answers are returned as a simple object, not indexed — the question text is the context.

**Token billing**: Input tokens only (questions + text). Output tokens are free.

## Performance

Typical scan:

- Small file (< 4 KB): 1 chunk, 1 gate request, ~20 name candidates → ~600 tokens
- Medium file (16–40 KB): 5–10 chunks, 5–10 gate requests, ~100 candidates total → ~3000–6000 tokens
- Large file (100+ KB): Chunks are aggressively split; cost scales linearly

Names are the most expensive layer: 1 token per candidate. Regex extraction costs nothing.

## Next Steps

- [Categories & Sensitivity](./categories) — Full definitions of the 12 categories
- [Limitations](./limitations) — What jev-pii-checker cannot do
- [CLI Reference](./cli) — All flags and configuration
