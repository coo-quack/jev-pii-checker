# Project Rules

## Overview

CLI for scanning text and files for PII using TypeSafe's Jev model. Three-layer detection: gate nouls for category presence, regex extraction for emails/phones/digit-strings, and word segmentation + Jev judgment for person names with span assembly.

## Tech Stack

- Runtime: Bun
- Language: TypeScript (strict mode)
- Linter/Formatter: Biome (2-space indentation)
- PII Detection: TypeSafe Jev SDK (0.6.0)

## Commands

- `bun test` — Run all tests
- `bun run build` — Build for production (minify + sourcemap + shebang)
- `bun run lint` — Biome check
- `bun run format` — Biome format
- `bun run dev` — Run CLI directly from source
- `bun run ci` — Full CI pipeline

## Project Structure

```
src/
  cli.ts           # CLI entry, argument parsing, file I/O
  judge.ts         # Judge interface and TypeSafeClient wrapper
  gate.ts          # PII category nouls + sensitivity score
  chunk.ts         # Text chunking at paragraph/sentence boundaries
  extract/
    regex.ts       # Email, phone, digit-string extraction
    names.ts       # Person-name candidate generation with segmenter
  locate.ts        # Orchestrates regex + name judgment, span assembly
  mask.ts          # Value masking helper (first 2 + … + last 1)
  report.ts        # JSON and human output formatting

tests/
  fixtures/
    corpus.json    # Name extraction test cases
    ibm_corpus.json # IBM taxonomy test corpus
  *.test.ts        # Unit and integration tests
```

## Testing Strategy

- Unit tests: mock Judge, test extraction and span assembly logic
- Integration tests: run real judge over ibm_corpus.json (skipped by default, set `JEV_PII_INTEGRATION=1`)
- Test runner: Bun's native `bun test`

## Key Constraints

- TypeSafe Jev State: ONLY `{ text }`, never reference candidates in state
- Jev Questions: Up to 250 per request; up to 25 candidates per request for independent questions
- Name Candidates: Cap per chunk (e.g., 200); skip entirely if gate person_name < threshold
- Chunking: Max 4000 chars per chunk; document-level results = per-category max, max sensitivity level
- Masking: Default `first2…last1`; `--show-values` disables
- Exit Codes: 0 = none/no error, 1 = error, 2 = severity >= threshold
