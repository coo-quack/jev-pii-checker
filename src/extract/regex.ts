/**
 * Extract emails, phones (JP + intl), and digit strings from text.
 * Deduplicates overlapping matches, preferring longer ones.
 */

export interface RegexMatch {
  text: string;
  start: number;
  end: number;
  kind: "email" | "phone" | "number";
}

// Email: local part [A-Za-z0-9._%+-]+, domain [A-Za-z0-9-]+(...)*.[A-Za-z]{2,}
// Avoid URL characters: /, ?, =, <, >
const EMAIL_REGEX =
  /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*/g;

// Phone formats:
// JP: 0\d{1,4}[- ]?\d{1,4}[- ]?\d{3,4}, (0\d{1,4})[- ]?\d{1,4}[- ]?\d{3,4}, 0\d{1,4}(\d{1,4})\d{3,4}, +81[- ]?\d{1,4}[- ]?\d{1,4}[- ]?\d{3,4}
// Intl: \+\d{1,3}[- ]?(\d{1,4})?[- ]?\d{1,4}[- ]?\d{2,4}([- ]?\d{2,4})?
// US: (\d{3})?[- .]\d{3}[- .]\d{4}
const PHONE_REGEX_JP =
  /(?:0\d{1,4}[- ]?\d{1,4}[- ]?\d{3,4}|\(0\d{1,4}\)[- ]?\d{1,4}[- ]?\d{3,4}|0\d{1,4}\(\d{1,4}\)\d{3,4}|\+81[- ]?\d{1,4}[- ]?\d{1,4}[- ]?\d{3,4})/g;

const PHONE_REGEX_US = /(?:\(?\d{3}\)?[- .]\d{3}[- .]\d{4})/g;

const PHONE_REGEX_INTL =
  /\+(?!81)[0-9]{1,3}[- ]?\(?[0-9]{1,4}\)?[- ]?[0-9]{1,4}[- ]?[0-9]{2,4}(?:[- ]?[0-9]{2,4})?/g;

// Digit strings: 10-16 digits with optional spaces/hyphens, but excluding dates and ISBN
const DIGIT_REGEX = /\d{2,}(?:[\s-]?\d{2,})*/g;

function extractMatches(text: string, regex: RegExp, kind: string): RegexMatch[] {
  const matches: RegexMatch[] = [];
  const regexWithG = new RegExp(regex.source, "g");

  let match: RegExpExecArray | null;
  // biome-ignore lint/suspicious/noAssignInExpressions: Standard regex iteration pattern
  while ((match = regexWithG.exec(text)) !== null) {
    matches.push({
      text: match[0],
      start: match.index,
      end: match.index + match[0].length,
      kind: kind as "email" | "phone" | "number",
    });
  }

  return matches;
}

function deduplicateOverlaps(matches: RegexMatch[]): RegexMatch[] {
  if (matches.length === 0) return [];

  const sorted = [...matches].sort((a, b) => {
    if (a.start !== b.start) return a.start - b.start;
    return b.end - b.start - (a.end - a.start);
  });

  const kept: RegexMatch[] = [];
  for (const m of sorted) {
    const overlaps = kept.some((k) => k.start <= m.start && m.start < k.end);
    if (!overlaps) {
      kept.push(m);
    }
  }

  return kept;
}

export function extractEmails(text: string): RegexMatch[] {
  return extractMatches(text, EMAIL_REGEX, "email");
}

export function extractPhones(text: string): RegexMatch[] {
  const jp = extractMatches(text, PHONE_REGEX_JP, "phone");
  const us = extractMatches(text, PHONE_REGEX_US, "phone");
  const intl = extractMatches(text, PHONE_REGEX_INTL, "phone");
  const combined = deduplicateOverlaps([...jp, ...us, ...intl]);

  // Filter out ISO dates, timestamps, ISBN, and numbers with preceding labels
  const filtered: RegexMatch[] = [];
  for (const match of combined) {
    const text_val = match.text;

    // Reject ISO date format YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}/.test(text_val)) {
      continue;
    }

    // Reject ISBN format 97[89]-...
    if (/^97[89]-/.test(text_val)) {
      continue;
    }

    // Check for preceding label: #, No., 注文, Order
    const beforeStart = Math.max(0, match.start - 10);
    const beforeText = text.substring(beforeStart, match.start);
    if (/#|No\.|注文|Order/.test(beforeText)) {
      continue;
    }

    filtered.push(match);
  }

  return filtered;
}

export function extractDigitStrings(text: string): RegexMatch[] {
  const matches = extractMatches(text, DIGIT_REGEX, "number");
  const filtered: RegexMatch[] = [];

  for (const m of matches) {
    const text_val = m.text;
    const clean = text_val.replace(/[\s-]/g, "");

    // Keep 10-16 digits only
    if (clean.length < 10 || clean.length > 16) {
      continue;
    }

    // Reject ISO date format YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}/.test(text_val)) {
      continue;
    }

    // Reject timestamps with colons
    if (/\d{2}:\d{2}/.test(text_val)) {
      continue;
    }

    // Reject ISBN format 97[89]-...
    if (/^97[89]/.test(clean)) {
      continue;
    }

    // Check for preceding label: #, No., 注文, Order
    const beforeStart = Math.max(0, m.start - 10);
    const beforeText = text.substring(beforeStart, m.start);
    if (/#|No\.|注文|Order/.test(beforeText)) {
      continue;
    }

    filtered.push({
      ...m,
      text: clean,
    });
  }

  return deduplicateOverlaps(filtered);
}

function extractLabelledShortIDs(text: string): RegexMatch[] {
  // Match labelled short IDs: keyword within 15 chars before, then anchored ID
  // For Latin keywords, use lazy gap and word boundaries
  const latinLabelRegex = /(?:passport|licen[cs]e|driver)[^\n]{0,15}?\b([A-Z]{0,2}\d{6,12})\b/gi;
  // For Japanese keywords, avoid word boundary and use lazy matching
  const japaneseLabelRegex = /(?:旅券|免許)[^\n]{0,15}?\b([A-Z]{0,2}\d{6,12})\b/gi;

  const matches: RegexMatch[] = [];

  // Latin keywords
  let match: RegExpExecArray | null;
  const latinRegexWithG = new RegExp(latinLabelRegex.source, "gi");
  // biome-ignore lint/suspicious/noAssignInExpressions: Standard regex iteration pattern
  while ((match = latinRegexWithG.exec(text)) !== null) {
    const idStart = match.index + (match[0].length - match[1].length);
    matches.push({
      text: match[1],
      start: idStart,
      end: idStart + match[1].length,
      kind: "number",
    });
  }

  // Japanese keywords
  const japaneseRegexWithG = new RegExp(japaneseLabelRegex.source, "gi");
  // biome-ignore lint/suspicious/noAssignInExpressions: Standard regex iteration pattern
  while ((match = japaneseRegexWithG.exec(text)) !== null) {
    const idStart = match.index + (match[0].length - match[1].length);
    matches.push({
      text: match[1],
      start: idStart,
      end: idStart + match[1].length,
      kind: "number",
    });
  }

  return matches;
}

export function extractAllRegex(text: string): RegexMatch[] {
  const emails = extractEmails(text);
  const phones = extractPhones(text);
  const digits = extractDigitStrings(text);
  const labelledIDs = extractLabelledShortIDs(text);

  return deduplicateOverlaps([...emails, ...phones, ...digits, ...labelledIDs]);
}
