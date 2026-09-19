# CLI Reference

## Command Syntax

```bash
jev-pii-checker [files...] [options]
```

Read from stdin if no files are provided; read from files if paths are given.

## Flags

### Output Options

**`--json`** (boolean, default: false)

Output JSON instead of human-readable text. The JSON array contains one report per file/stdin.

```bash
jev-pii-checker file.txt --json
```

**`--show-values`** (boolean, default: false)

Disable masking of PII values. By default, values are masked as `first2…last1`; this flag shows them in full.

```bash
jev-pii-checker file.txt --show-values
```

### Detection Options

**`--threshold <0-1>`** (string, default: "0.5")

Gate probability threshold. Findings below this probability are discarded.

```bash
jev-pii-checker file.txt --threshold 0.7
```

**`--span-threshold <0-1>`** (string, default: "0.8")

Name candidate threshold. Person-name candidates below this probability are discarded.

```bash
jev-pii-checker file.txt --span-threshold 0.9
```

**`--no-spans`** (boolean, default: false)

Skip name extraction entirely. Use only regex-based patterns (emails, phones, digit strings).

```bash
jev-pii-checker file.txt --no-spans
```

**`--max-chars <n>`** (string, default: "4000")

Chunk size in bytes. Text is split at paragraph or sentence boundaries if it exceeds this size.

```bash
jev-pii-checker largefile.txt --max-chars 8000
```

**`--model <id>`** (string, optional)

TypeSafe model ID. If not provided, uses the SDK default.

```bash
jev-pii-checker file.txt --model "jev-1"
```

### Severity & Control

**`--fail-on none|low|high`** (string, default: "none")

Exit with code 2 if the document sensitivity level reaches or exceeds this level. Exit 0 otherwise (unless an error occurs).

```bash
jev-pii-checker file.txt --fail-on high
echo $?  # 2 if high-sensitivity PII detected
```

**`--concurrency <n>`** (string, default: "4")

Reserved for future use. Currently does not change behavior (all requests are sequential).

### Help & Version

**`--help`** (boolean)

Print help text and exit.

```bash
jev-pii-checker --help
```

**`--version`** (boolean)

Print version and exit.

```bash
jev-pii-checker --version
```

## Environment Variables

**`TYPESAFE_API_KEY`** (required)

Your TypeSafe API key for accessing the Jev model.

```bash
export TYPESAFE_API_KEY="..."
jev-pii-checker file.txt
```

## Exit Codes

- **0**: Scan completed successfully; no findings (or findings below `--fail-on` level)
- **1**: An error occurred (missing API key, invalid file, timeout, etc.)
- **2**: `--fail-on` threshold was reached (sensitivity level >= specified level)

## Output Formats

### Human-Readable (default)

```
=== file.txt ===
Sensitivity: HIGH
Categories: email_or_phone, health_info
Findings: 3
Tokens: 1024

Detected:
  email_or_phone:
    • jo…m (45:67)
  health_info:
    • di…s (120:135)
```

### JSON (`--json`)

```json
[
  {
    "source": "file.txt",
    "sensitivity": {
      "level": "high",
      "score": 2.1,
      "probabilities": {
        "none": 0.05,
        "low": 0.15,
        "high": 0.8
      }
    },
    "categories": {
      "person_name": 0.92,
      "email_or_phone": 0.88,
      "postal_address": 0.15
    },
    "findings": [
      {
        "type": "email_or_phone",
        "value": "jo…m",
        "start": 45,
        "end": 67,
        "probability": 0.88,
        "pii": true
      }
    ],
    "chunks": 1,
    "usage": {
      "input_tokens": 1024,
      "requests": 2
    }
  }
]
```

### Finding Details

Each finding includes:

- **type**: `email`, `phone`, `person_name`, or `number`
- **value**: The detected text (masked by default)
- **start** / **end**: Character offsets in the original text
- **probability**: Jev confidence (0.0–1.0)
- **pii**: Whether it was flagged as PII; semantics depend on type:
  - **email/phone**: `false` if generic mailbox (noreply, info, support, etc.) or toll-free/navi-dial (0120, 0800, 0570, 1-800); otherwise `true` if personal-contact probability ≥ 0.2, else `false`
  - **number**: `true` for sensitive types (my_number, credit_card, bank_account, phone, driver_licence_or_passport); `false` for non-sensitive (order_or_tracking_number, product_serial, date, other)
  - **person_name**: Always `true`
- **detail** (optional): Type-specific metadata:
  - **person_name**: `{ honorific?: string, title?: string, scores?: { person: number, name: number } }`
    - `honorific`: Trailing honorific (e.g., "さん", "Mr.", "Dr")
    - `title`: Role or title prefix that was stripped during candidate generation (e.g., "部長" before a name)
    - `scores`: Two-stage judgment scores (person: does it refer to a person; name: is it a full or part of a name)
  - **number**: `{ number_type: string, probabilities?: Record<string, number> }`
    - `number_type`: Classification (my_number, credit_card, bank_account, phone, driver_licence_or_passport, order_or_tracking_number, product_serial, date, other)
    - `probabilities`: Full probability distribution from the judgment

## Examples

### Scan a file and show sensitivity

```bash
jev-pii-checker report.txt
```

### Scan multiple files as JSON

```bash
jev-pii-checker file1.txt file2.txt file3.txt --json | jq '.[] | .source, .sensitivity.level'
```

### Exit on high-sensitivity PII

```bash
jev-pii-checker sensitive.txt --fail-on high || echo "PII found at high level"
```

### Use stricter name detection

```bash
jev-pii-checker names.txt --span-threshold 0.95
```

### Disable names, use regex only

```bash
jev-pii-checker file.txt --no-spans
```

## Evaluation

### `bun run eval [--json path]`

Run accuracy evaluation over the bundled test corpus (`tests/fixtures/eval_corpus.json`).

**Requirements**:

- `TYPESAFE_API_KEY` environment variable must be set
- Uses the live TypeSafe Jev API (calls may incur costs)

**Output**:

- Human-readable metrics: precision, recall, F1 per finding type and language
- Sensitivity classification accuracy
- Failure report with false positives and false negatives

**Options**:

- `--json path`: Write detailed JSON results to the specified file

**Examples**:

```bash
export TYPESAFE_API_KEY="..."
bun run eval
```

```bash
bun run eval --json results.json
```

**Results on the bundled corpus**:

- **person_name**: P 97.7%, R 100%
- **email**: 100%
- **phone**: 100%
- **number**: 100%
- **Sensitivity**: 88% accuracy
