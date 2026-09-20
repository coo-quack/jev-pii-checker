# Limitations

jev-pii-checker is effective for finding PII but cannot handle every scenario. Know what it cannot do.

## Cannot Distinguish Public Figures

jev-pii-checker treats all person names as PII. It cannot distinguish between:

- Natsume Soseki (historical novelist — in most contexts, not PII)
- Albert Einstein (famous scientist)
- A deceased person mentioned in a Wikipedia article or historical text
- The person discussing them in a private document

Historical and public figures can still score low sensitivity instead of none if the text lacks context tying them to the person reading the document.

**Workaround**: Review findings and filter manually. The `--no-spans` flag disables name extraction entirely.

## No Checksum Verification

Digit strings are extracted and classified by Jev, but checksums are not validated:

- Credit card Luhn checksums: not validated
- Passport format: not validated
- Government ID format: not checked

This means **synthetic or invalid numbers may be flagged as PII**. Use the probability score to judge confidence.

## Borderline HR and Disciplinary Records

Confidential performance reviews and disciplinary documents can produce inconsistent sensitivity scores across runs. When the model's probabilities sit near the 0.5 boundary (e.g., 0.47/0.53 low/high split), a document can flip between low and high sensitivity depending on the exact phrasing and context window.

Example: A termination recommendation with personal mitigating factors may hover at the boundary. Run evaluation multiple times or inspect `sensitivity.probabilities` in the JSON to assess confidence.

**Workaround**: For high-stakes decisions, inspect the full JSON output and the `probabilities` field; do not rely on a single run's sensitivity level.

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

## Candidate Rules Are List-Based

Political/military/legal/clerical titles (Governor, Senator, Mayor, Judge, etc.) and capitalized form labels (Name, Email, Phone, Subject, etc.) are never candidates during name extraction. These are hard-coded lists, so unknown or regional titles may not be recognized:

- "Comandante José" may still merge "Comandante" with "José" if the title is not in the list
- Informal or organizational titles (Team Lead, Chapter Director) may be treated as name words

**Workaround**: Use `--show-values` and review the detected names; report false positives if you find a pattern.

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
