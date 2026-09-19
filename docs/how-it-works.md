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
- **Phone**: JP (+81, 090-xxxx, 0120, with spaces and parentheses) and international (+1 555, etc.); filter ISO dates, ISBNs, labelled order numbers
- **Digit Strings**: 10–16 chars; filter corporate patterns (payment gateways, order numbers, IPs)
- **Labelled Short IDs**: Keyword-gated patterns for passport, license, and driver ID (e.g., "Passport: AB123456")

**Cost**: Zero—purely pattern matching.

**Output**: Candidate spans with no judgment. Not all emails/phones are PII (e.g., support hotlines, toll-free numbers).

## Layer 3: Jev Judgment

### Contacts (Email / Phone)

All regex-found emails and phones are reported as findings.

- **`pii` semantics**: `false` for generic mailboxes (noreply, info, support, contact, sales, admin, postmaster, mailer-daemon, notifications) and toll-free/navi-dial prefixes (0120, 0800, 0570, 1-800); otherwise `true` if personal-contact probability ≥ 0.2, else `false`
- **Cost**: One token per email/phone

### Numbers

Pure-digit strings (10+ digits) are first disambiguated: "Is this a phone, My Number, credit card, bank account, order number, product serial, or date?"

- **Output**: `number_type` and full probability distribution
- **`pii` semantics**: `true` for sensitive types (my_number, credit_card, bank_account, phone, driver_licence_or_passport); `false` for non-sensitive
- **Cost**: One token per number

### Names

Generate candidates via `Intl.Segmenter`, then batch-judge them with **two independent questions**:

1. "Does this refer to a person (vs. place, organization, product, common word)?" — threshold ≥ 0.8
2. "Is this the full name or part of a name?" — threshold ≥ 0.4

Both thresholds must pass. Overlapping candidates are merged and assembled into spans. Honorifics (さん, 様, Mr., Ms., Dr, etc.) and title prefixes (部長, 課長, Rabbi, Patient, etc.) are detected and reported separately in `detail.honorific` / `detail.title`; they are not part of the span value itself.

**Filtering**:

- Names inside emails, URLs, or phone numbers are filtered out
- Role words alone (patient, rabbi, doctor, manager, etc.) are never candidates
- Lowercase Latin words are never candidates
- Japanese particles and title suffixes are stripped during candidate generation

**Candidate cap**: Up to 600 candidates per chunk (raised from 200); late candidates in long chunks are no longer silently dropped.

**Batching**: Candidates are judged in batches of ≤25 per request (2 questions × 25 = up to 50 questions).

**Cost**: Two tokens per person-name candidate.

**Output**: Probability per candidate, plus two-stage scores in `detail.scores { person, name }`. Filter by `--span-threshold` (default 0.8).

## Chunking

Text longer than `--max-chars` (default 4000 bytes) is split at paragraph or sentence boundaries:

1. Split on `\n\n` (paragraph breaks) if chunks fit
2. Otherwise split on `.`, `!`, `?` (sentence ends) if chunks fit
3. Otherwise split on `\n` (line breaks) if chunks fit
4. Fall back to fixed 4000-byte chunks

**Per-document aggregation**: Results are merged (max sensitivity, max per-category probability).

## Name Extraction

Japanese names and English names are both extracted via `Intl.Segmenter('ja')` with the same algorithm:

1. **Candidate generation**: Word segmentation produces overlapping windows (unigrams, bigrams, trigrams); Latin multi-word names (capitalized sequences) are also merged into 1–3-word candidates with hyphenated names kept whole
2. **Two-stage judgment**: Each candidate is asked two questions (person? name?); both must pass thresholds
3. **Span assembly**: Overlapping candidates with high probability are merged into non-overlapping spans
4. **Title attachment**: Trailing honorifics (さん, 様, Dr., Mr., etc.) are detected and reported separately; role prefixes (部長, Rabbi, Patient, etc.) are also stripped and reported

**Improvements in this version**:

- Japanese surnames with titles (田中部長, 千葉さん) are now correctly found as single spans
- Place names (千葉県) are no longer confused with person names
- Title words are never included in the span value itself

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
