# Changelog

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
