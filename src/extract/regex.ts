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

const EMAIL_REGEX =
  /[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*/g;

const PHONE_REGEX_JP =
  /(?:0\d{1,4}-?\d{1,4}-?\d{4}|0120-?\d{3}-?\d{4}|090-?\d{4}-?\d{4}|080-?\d{4}-?\d{4}|070-?\d{4}-?\d{4}|\+81-?\d{1,4}-?\d{1,4}-?\d{4})/g;

const PHONE_REGEX_INTL = /\+[0-9]{1,3}(?:\s?-?[0-9]){6,14}/g;

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
  const intl = extractMatches(text, PHONE_REGEX_INTL, "phone");
  const combined = deduplicateOverlaps([...jp, ...intl]);
  return combined;
}

export function extractDigitStrings(text: string): RegexMatch[] {
  const matches = extractMatches(text, DIGIT_REGEX, "number");
  const filtered: RegexMatch[] = [];

  for (const m of matches) {
    const clean = m.text.replace(/[\s-]/g, "");
    if (clean.length >= 10 && clean.length <= 16) {
      filtered.push({
        ...m,
        text: clean,
      });
    }
  }

  return deduplicateOverlaps(filtered);
}

export function extractAllRegex(text: string): RegexMatch[] {
  const emails = extractEmails(text);
  const phones = extractPhones(text);
  const digits = extractDigitStrings(text);

  return deduplicateOverlaps([...emails, ...phones, ...digits]);
}
