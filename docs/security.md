# Security

## Data Disclosure

This tool sends scanned text to TypeSafe's Jev API for PII judgment. Do not scan data that you may not disclose to a third party.

## No Verification

This tool cannot verify checksums, validate government IDs, or distinguish public figures. Use the sensitivity levels and located findings as recommendations only, not as authoritative declarations.

## Limitations

- Japanese names with titles may be split or merged unexpectedly
- Cannot detect PII in code or structured data (JSON, YAML, SQL)
- Cannot distinguish between personal and corporate uses of contact info without context
