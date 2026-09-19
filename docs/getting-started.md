# Getting Started

## Setting Up the API Key

jev-pii-checker requires a TypeSafe API key to use the Jev model.

### 1. Obtain Your API Key

Sign up at [TypeSafe](https://typesafe.ai/) and generate an API key from your account dashboard.

### 2. Set the Environment Variable

jev-pii-checker looks for `TYPESAFE_API_KEY` in your environment. Set it before running the CLI:

```bash
export TYPESAFE_API_KEY="your-api-key-here"
jev-pii-checker file.txt
```

### If Your Key File Has No `export`

Some credential files are stored as bare values without `export`. Use `set -a` to source them:

```bash
set -a
source ~/.config/chata/typesafe.env
set +a
jev-pii-checker file.txt
```

The `set -a` flag causes all variable assignments to be exported; `set +a` turns it off.

## Your First Scan

### Scan from stdin

```bash
echo "My name is Alice and my phone is 555-0123." | jev-pii-checker
```

Output (human-readable by default):

```
=== stdin ===
Sensitivity: LOW
Categories: person_name, email_or_phone
Findings: 2
Tokens: 512

Detected:
  person_name:
    • Al…e (11:16)
  phone:
    • 55…3 (37:46)
```

### Scan files

```bash
jev-pii-checker report.txt data.csv --json
```

### Read the Table

The human-readable output shows:

- **Sensitivity**: Overall risk level (none, low, or high)
- **Categories**: Which PII types were detected
- **Findings**: Count of detected items (excluding high-noise patterns like server IPs)
- **Tokens**: How many input tokens were consumed
- **Detected**: List of found items, grouped by type, with character spans (start:end)

Values are masked as `first2…last1` by default. See the [CLI Reference](./cli) for output options.

### View Raw Values

```bash
jev-pii-checker report.txt --show-values
```

Be careful: raw values will appear in the output.

### Output as JSON

```bash
jev-pii-checker report.txt --json
```

The JSON includes:

- **sensitivity**: Overall sensitivity level and scores
- **categories**: Probability for each PII category
- **findings**: Array of detected items with type, value (masked), start/end offsets, and Jev probability
- **chunks**: How many text chunks were processed
- **usage**: Token count and request count

See [CLI Reference](./cli) for the complete JSON schema.

## Exit Codes

jev-pii-checker uses exit codes for shell integration:

- **0**: No findings, or only low-severity findings (depending on `--fail-on`)
- **1**: An error occurred (missing API key, file not found, etc.)
- **2**: Severity reached the `--fail-on` threshold (high-sensitivity PII found)

Example:

```bash
jev-pii-checker sensitive.txt --fail-on high
if [ $? -eq 2 ]; then
  echo "High-sensitivity PII detected!"
fi
```

## Next Steps

- [Install](./install) for npm, bunx, or source builds
- [CLI Reference](./cli) for all flags and options
- [How It Works](./how-it-works) to understand the detection layers
- [Categories & Sensitivity](./categories) for definitions of PII types
