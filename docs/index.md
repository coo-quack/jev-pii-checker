---
layout: home

hero:
  name: jev-pii-checker
  text: Find PII in text with Jev
  tagline: Detect personally identifiable information using TypeSafe's Jev model, regex patterns, and word segmentation
  image:
    src: /logo.svg
    alt: jev-pii-checker
  actions:
    - theme: brand
      text: Get Started
      link: /getting-started
    - theme: alt
      text: CLI Reference
      link: /cli
    - theme: alt
      text: GitHub
      link: https://github.com/coo-quack/jev-pii-checker

features:
  - icon: 🚪
    title: Presence Gate
    details: 12 PII categories with categorical accuracy. The gate screens text before detailed extraction.
  - icon: 📊
    title: Sensitivity Levels
    details: IBM taxonomy—none, low, high—captures the harm potential of leaks (contact vs. financial).
  - icon: 📍
    title: Located Spans
    details: Pinpoint exactly where PII lives in the text with character offsets and probabilities.
  - icon: 🔍
    title: Regex + Jev
    details: Pattern matching for emails, phones, digit strings; Jev judgment for numbers (credit cards, IDs, serials).
  - icon: 🌏
    title: Segmentation-Aware Names
    details: Japanese names via Intl.Segmenter; candidates judged and assembled with title suffixes.
  - icon: 🎯
    title: Hook-Friendly Exit Codes
    details: 0 for clean, 1 for error, 2 when severity meets threshold. Easy shell integration.
---

> [!WARNING]
> **The scanned text is sent to TypeSafe's Jev API.** Detection happens on their servers, so this tool is not a local-only guard: everything you scan leaves your machine. Use it only on data you are allowed to hand to a third party, such as text you were going to send to an LLM anyway, and check TypeSafe's data-retention terms first. For a guard that never sends anything, see [sensitive-canary](https://github.com/coo-quack/sensitive-canary). Details on the [Security](/security) page.

## Why jev-pii-checker?

Regex alone misses context and generates noise. Jev alone costs per API call on every character. **jev-pii-checker layered them**: gate screens first, then regex finds candidates, then Jev judges only what matters.

| Approach                                 | Cost      | Accuracy      | Span |
| ---------------------------------------- | --------- | ------------- | ---- |
| Regex only                               | Low       | 🟡 High noise | ✅   |
| Jev on all text                          | 💰💰 High | ✅ High       | ✅   |
| **jev-pii-checker (gate → regex → Jev)** | 💰 Medium | ✅ High       | ✅   |

## Getting Started

Set up your API key and scan text in seconds:

```bash
export TYPESAFE_API_KEY="your-key"
echo "佐藤健一郎 090-1234-5678" | jev-pii-checker --json
```

See [Getting Started](./getting-started) for detailed setup.

## Features

- **Three-layer detection**: Gate presence screening, regex extraction, Jev judgment of candidates
- **JSON and human output**: Machine-readable or compact human-friendly reports
- **Severity filtering**: Exit with code 2 when findings exceed a threshold
- **Masking by default**: Show `ja…n` not `japan@example.com`; disable with `--show-values`
- **Configurable thresholds**: Gate probability, span probability, chunk size, concurrency

## Install

```bash
bun install -g @coo-quack/jev-pii-checker
jev-pii-checker --version
```

No server required. Requires Node.js 20+ or Bun.

See [Install](./install) for source builds and alternatives.
