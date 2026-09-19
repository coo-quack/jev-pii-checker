# Changelog

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
