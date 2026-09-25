# Changelog

## v0.3.2 (2026-09-26)

- Maintenance release with no functional changes.

## v0.3.1 (2026-09-20)

- New gate category `hr_or_criminal_record`: a disciplinary action, performance evaluation, dismissal or termination decision, harassment or misconduct complaint, or criminal or arrest record about an identifiable person. It joins the policy's special categories, so such a record about a named person is `high` deterministically instead of depending on the model's rubric answer (a termination-recommendation review sat at 0.47/0.53). The question asks for a formal record and excludes casual praise or criticism ("Taro Yamada's report was excellent" scores 0.16, a chat complaint about a proposal 0.04, while a review with a rating, a disciplinary memo, a complaint list and a named arrest report score 0.87–0.98; a plain staff list 0.01).

## v0.3.0 (2026-09-20)

### Features

- **Sensitivity policy**: Two code-side policy rules now apply on top of the model's rubric answer. Escalation to `high` when a named person co-occurs with a special category (health, biometric, government ID, financial account, race or religion) or when a personal government/financial number is found. Floor to `none` when no category reaches threshold and no finding is personal (filters noise like lone toll-free numbers, unlabelled digit strings, code snippets).
- **Argmax sensitivity**: Sensitivity level is now the most probable rubric step (argmax over probabilities), not the rounded expected value. A distribution {none: 0.63, low: 0.12, high: 0.25} with expected value 0.62 (rounds to "low") now correctly returns "none" as the most likely answer.
- **Name candidates improved**: Political/military/legal/clerical titles (Governor, Senator, Mayor, Judge, …) and capitalized form labels (Name, Email, Phone, Subject, …) are never candidates. Initials merge with surname (T. Anderson) and are never candidates alone. Katakana names joined by ＝ or ・ (マリー＝ルイーズ, イヴ・パトリック) are single candidates. Hangul names (김민수) are candidates.
- **Number type `national_id`**: US social security numbers (3-2-4 format) are now typed as `national_id`. A digit string the model types as a phone is reported with the model's choice in `detail.number_type`. Digit runs inside alphanumeric IDs are ignored. North American numbers keep a `1-` prefix; 1-8xx toll-free prefixes are `pii: false` by rule.
- **Evaluation corpus**: New `bun run eval --corpus PATH` flag for held-out corpus evaluation. Results on the 40-entry held-out corpus (written without looking at the code's output; its first run gave person_name F1 85%, phone 88%, number 75%, sensitivity 87.5%, and the fixes in this release were chosen from those failures, so these after-numbers are no longer blind — a fresh corpus is still the honest test): person_name, email, phone, number all P/R 100%; sensitivity 38/40 (95%, two edge cases: a Wikipedia paragraph about a deceased scientist scored low instead of none; a confidential performance review with termination recommendation sits at the model's 0.47/0.53 low/high boundary). Bundled 60-entry corpus: all 100% on findings, sensitivity 60/60. (Held-out numbers measured after fixes were chosen from a first run with 85% name F1, 87.5% sensitivity, so a fresh corpus is the honest test.)
- **Report structure**: JSON now carries `sensitivity.model_level` (the model's answer before policy) and `sensitivity.reasons` (why the policy changed it, if at all). Human output shows the model level and reason in parentheses when the policy changed the level.

### Breaking Changes

- Finding JSON now includes `sensitivity.model_level` and `sensitivity.reasons` in the report structure.

## v0.2.0 (2026-09-20)

### Features

- **Person names**: Candidates are now judged with two independent questions (does it refer to a person; is it a full or part of a name) with thresholds person ≥ 0.8 and name ≥ 0.4. Japanese surnames with titles (田中部長, 千葉部長, 福島さん) are now found correctly; place-name uses (千葉県) are not.
- **Honorifics and titles**: Japanese (さん, 様, 部長, 課長, etc.) and English (Mr., Ms., Dr., Dr, Rabbi, Patient, etc.) titles and honorifics are never part of the value itself. They are reported separately in `detail.honorific` (honorific) or `detail.title` (role or title prefix before a name). Role words alone are never candidates; lowercase Latin words are never candidates.
- **Latin names**: Possessive `'s` is now stripped from the end; hyphenated names like Al-Rashid and Jean-Pierre are kept whole as single candidates; multi-word name merges never include a title word.
- **Names inside contacts**: Names appearing inside email addresses, URLs, or phone numbers are no longer reported separately (they are filtered out during judgment).
- **Contact findings**: All regex-found emails and phones are always reported as findings. `pii` is false by rule for generic mailboxes (noreply, no-reply, info, support, contact, sales, admin, postmaster, mailer-daemon, notifications) and toll-free/navi-dial prefixes (0120, 0800, 0570, 1-800), otherwise true unless the model's personal-contact probability is below 0.2.
- **Phone regex**: Now accepts spaces and parentheses in patterns like `03 3456 7890`, `(03)1234-5678`, `+44 20 7946 0958`. ISO dates/timestamps, ISBNs, and labelled order numbers are excluded from phone candidates.
- **Pure-digit phone disambiguation**: Strings like 10-digit numbers are now typed first (e.g., a 10-digit bank account is correctly classified as a number, not a phone).
- **Labelled short IDs**: Passport, license, and driver ID numbers are now found via keyword-gated pattern matching (e.g., "Passport: AB123456", "License #: 12345678").
- **Candidate cap per chunk**: Raised from 200 to 600. Names late in a 4000-character chunk are no longer silently dropped.
- **Candidate batching**: Names are judged in batches of ≤25 candidates per request (2 questions per candidate = up to 50 questions per batch).
- **Evaluation harness**: New `bun run eval [--json path]` command runs accuracy evaluation over `tests/fixtures/eval_corpus.json` (60 synthetic test entries). Results on the bundled corpus (built alongside these fixes, so in-sample): person_name, email, phone and number all P 100% / R 100%; sensitivity 93% (56/60, the misses are the model's calls on a lone toll-free number, an unlabelled 12-digit number, a code snippet and a religious congregation list).

### Breaking Changes

- Finding JSON now includes `detail.scores { person, name }` for person names (the two judgment scores).
- Finding JSON now includes `detail.number_type` for all numbers (e.g., "credit_card", "phone", "order_or_tracking_number").
- Finding JSON structure for contacts (email/phone) now has `pii: boolean` semantics as described above.

## v0.1.1 (2026-09-20)

### Fixes

- **Probability accuracy**: Person name findings now report the real maximum probability from judged candidates instead of hard-coded 0.8
- **Multi-word Latin names**: Sequences of 2–3 consecutive capitalized Latin words separated by single spaces (e.g., "Emily Carter", "Natsume Soseki") are now merged as single candidates
- **Number value formatting**: Number findings preserve original formatting (spaces and hyphens) instead of normalized digits

## v0.1.0 (2026-09-19)

### Features

- **CLI**: Initial release of `jev-pii-checker` for detecting personally identifiable information in text and files
- **PII Detection**: Three-layer detection using TypeSafe Jev model, regex patterns, and word segmentation
- **Output Formats**: JSON and human-readable reports with masking and filtering options
- **Configuration**: Support for severity thresholds, JSON output mode, and raw value display

### Documentation

- README with architecture, usage examples, exit codes
- SECURITY.md with API disclosure and data handling notes

### Tests

- Comprehensive unit tests for extraction, span assembly, chunking, masking
- Integration test suite with ibm_corpus.json
