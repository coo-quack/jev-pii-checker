# Limitations

jev-pii-checker is effective for finding PII but cannot handle every scenario. Know what it cannot do.

## Cannot Distinguish Public Figures

jev-pii-checker treats all person names as PII. It cannot distinguish between:

- Natsume Soseki (historical novelist — in most contexts, not PII)
- Albert Einstein (famous scientist)
- The person discussing them in a private document

**Workaround**: Review findings and filter manually. The `--no-spans` flag disables name extraction entirely.

## No Checksum Verification

Digit strings are extracted and classified by Jev, but checksums are not validated:

- Credit card Luhn checksums: not validated
- Passport format: not validated
- Government ID format: not checked

This means **synthetic or invalid numbers may be flagged as PII**. Use the probability score to judge confidence.

## Japanese Names with Titles May Be Split

The `Intl.Segmenter` may split or merge incorrectly:

- "佐藤 部長" (Satoh, section chief) → may become two spans instead of one
- "山田太郎様" (Yamada Taro, honorific) → may split or merge unpredictably

**Workaround**: Review findings. Use `--span-threshold` to increase strictness. Or use `--no-spans` and rely only on regex and financial IDs.

## Cannot Detect PII in Code

Structured data like JSON, YAML, SQL, regex patterns are treated as plain text:

```json
{
  "user_id": "12345",
  "email": "john@example.com",
  "phone": "555-0123"
}
```

The tool will find the email and phone, but not in the context of a data structure. If someone stores PII as SQL comments or regex, those are unlikely to be detected.

## Cannot Identify Company/Organization Names

Scope: Individual PII only. Company names, brand names, institution names are **not** detected:

- "Acme Corp", "Google", "Harvard University"
- "Amazon S3 bucket"
- "Federal Reserve Bank"

These are out of scope.

## Limited Context for Ambiguous Cases

Some PII is context-dependent:

- "Blood type O" alone has low sensitivity; "John's blood type is O" with a named person has higher sensitivity
- "123 Main Street" alone could be a business address; "John lives at 123 Main Street" is personal

jev-pii-checker relies on Jev's judgment of the full text chunk. Accuracy is good but not perfect.

## Cannot Verify Data Leaks or Aggregation

The tool detects PII **in isolation**. It does not:

- Check if a name + phone combination uniquely identifies someone in a public database
- Detect when a list of multiple attributes (e.g., "all users with depression diagnosis") reveals sensitive facts about a group
- Warn if combining this data with other sources enables re-identification

## No Verification of Employment or Affiliation

"John Smith works at Acme" is flagged as employment info, but:

- No check if John actually works there
- No distinction between official and casual mention
- No verification against a company roster

## Text Sent to TypeSafe API

**Important**: All text is sent to TypeSafe's Jev API for judgment. Do not scan:

- Highly confidential documents
- Trade secrets
- Personal medical records (unless you trust TypeSafe)
- Government classified material

See [security guide](./security) for data handling details.

## Performance Notes

- **Concurrency flag**: Currently reserved; all requests are sequential
- **Token costs**: Scale linearly with file size
- **Chunking**: May fragment PII across chunk boundaries (e.g., name in one chunk, number in another)

## Accuracy Expectations

**Measured Results** (on IBM and internal corpora):

- Gate: 100% categorical accuracy on person_name, email_or_phone, phone presence
- Sensitivity levels: 22/24 correct (seminar/clinic context distinction works well)
- Digit disambiguation: Correctly classifies credit cards, My Numbers, order numbers, product serials

Real-world accuracy will vary with document type and language.

---

## What NOT to Expect

- **Complete PII detection**: This tool finds common patterns. It is not a security audit.
- **GDPR/HIPAA compliance guarantee**: Use professional data loss prevention (DLP) tools for regulatory compliance.
- **Real-time scanning**: Designed for batch jobs, not high-frequency API integration.
- **Public figure filtering**: See first limitation.

---

For edge cases or missing features, open an issue on [GitHub](https://github.com/coo-quack/jev-pii-checker/issues).
