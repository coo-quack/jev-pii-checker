/**
 * Generate person-name candidates from text using Intl.Segmenter
 * and word/character heuristics.
 *
 * For Japanese: word segments with kanji/katakana/Latin + merges of 2-3 consecutive.
 * For Latin text: consecutive Capitalized words (1–3).
 * Skip pure hiragana, digits, particles.
 *
 * Title suffixes attached in code-side assembly.
 */

export interface NameCandidate {
  text: string;
  start: number;
  end: number;
}

const PARTICLES = new Set([
  "の",
  "を",
  "に",
  "が",
  "は",
  "で",
  "から",
  "まで",
  "など",
  "や",
  "か",
  "と",
  "も",
]);
const TITLE_SUFFIXES = new Set([
  "さん",
  "様",
  "氏",
  "君",
  "部長",
  "課長",
  "社長",
  "副社長",
  "医師",
  "先生",
  "医者",
]);

function isKanjiKatakanaOrLatin(char: string): boolean {
  const code = char.charCodeAt(0);
  if (code >= 0x4e00 && code <= 0x9fff) return true;
  if (code >= 0x30a0 && code <= 0x30ff) return true;
  if (code >= 0xa000 && code <= 0xa4cf) return true;
  if (/[A-Za-z]/.test(char)) return true;
  return false;
}

function isHiragana(char: string): boolean {
  const code = char.charCodeAt(0);
  return code >= 0x3040 && code <= 0x309f;
}

function isPureHiragana(text: string): boolean {
  return text.length > 0 && text.split("").every((c) => isHiragana(c));
}

function isPureDigits(text: string): boolean {
  return text.length > 0 && /^\d+$/.test(text);
}

function isCapitalizedLatin(text: string): boolean {
  if (text.length === 0) return false;
  const firstChar = text[0];
  if (!/[A-Z]/.test(firstChar)) return false;
  // Rest must be letters, optionally with apostrophe or hyphen
  const rest = text.slice(1);
  return /^[a-zA-Z'-]*$/.test(rest);
}

export function generateNameCandidates(text: string, maxCandidates = 200): NameCandidate[] {
  const segmenter = new Intl.Segmenter("ja", { granularity: "word" });
  const segments = Array.from(segmenter.segment(text));

  const candidates = new Map<string, NameCandidate>();

  for (const seg of segments) {
    const segment = seg.segment;
    if (!segment) continue;

    const hasKanjiKatakanaOrLatin = segment.split("").some((c) => isKanjiKatakanaOrLatin(c));
    const isPureHira = isPureHiragana(segment);
    const isPureDig = isPureDigits(segment);
    const isParticle = PARTICLES.has(segment);

    if (!hasKanjiKatakanaOrLatin || isPureHira || isPureDig || isParticle) {
      continue;
    }

    const key = `${seg.index}-${seg.index + segment.length}`;
    candidates.set(key, {
      text: segment,
      start: seg.index,
      end: seg.index + segment.length,
    });
  }

  for (let i = 0; i < segments.length - 1; i++) {
    const seg1 = segments[i];
    const seg2 = segments[i + 1];

    const t1 = seg1.segment;
    const t2 = seg2.segment;

    if (!t1 || !t2) continue;

    const isGood1 =
      t1.split("").some((c) => isKanjiKatakanaOrLatin(c)) &&
      !isPureHiragana(t1) &&
      !isPureDigits(t1) &&
      !PARTICLES.has(t1);
    const isGood2 =
      t2.split("").some((c) => isKanjiKatakanaOrLatin(c)) &&
      !isPureHiragana(t2) &&
      !isPureDigits(t2) &&
      !PARTICLES.has(t2);

    if (isGood1 && isGood2) {
      const merged = t1 + t2;
      const key = `${seg1.index}-${seg2.index + t2.length}`;
      candidates.set(key, {
        text: merged,
        start: seg1.index,
        end: seg2.index + t2.length,
      });
    }
  }

  for (let i = 0; i < segments.length - 2; i++) {
    const seg1 = segments[i];
    const seg2 = segments[i + 1];
    const seg3 = segments[i + 2];

    const t1 = seg1.segment;
    const t2 = seg2.segment;
    const t3 = seg3.segment;

    if (!t1 || !t2 || !t3) continue;

    const isGood1 =
      t1.split("").some((c) => isKanjiKatakanaOrLatin(c)) &&
      !isPureHiragana(t1) &&
      !isPureDigits(t1) &&
      !PARTICLES.has(t1);
    const isGood2 =
      t2.split("").some((c) => isKanjiKatakanaOrLatin(c)) &&
      !isPureHiragana(t2) &&
      !isPureDigits(t2) &&
      !PARTICLES.has(t2);
    const isGood3 =
      t3.split("").some((c) => isKanjiKatakanaOrLatin(c)) &&
      !isPureHiragana(t3) &&
      !isPureDigits(t3) &&
      !PARTICLES.has(t3);

    if (isGood1 && isGood2 && isGood3) {
      const merged = t1 + t2 + t3;
      const key = `${seg1.index}-${seg3.index + t3.length}`;
      candidates.set(key, {
        text: merged,
        start: seg1.index,
        end: seg3.index + t3.length,
      });
    }
  }

  // Merge Latin multi-word names: capitalized words separated by space segments
  for (let i = 0; i < segments.length; i++) {
    const seg1 = segments[i];
    const t1 = seg1.segment;

    if (!t1 || !isCapitalizedLatin(t1)) continue;

    // Check for 2-word Latin name: Word, Space, Word
    if (i + 2 < segments.length) {
      const seg2 = segments[i + 1];
      const seg3 = segments[i + 2];

      const t2 = seg2.segment;
      const t3 = seg3.segment;

      if (t2 === " " && t3 && isCapitalizedLatin(t3)) {
        const merged = t1 + t2 + t3;
        const key = `${seg1.index}-${seg3.index + t3.length}`;
        candidates.set(key, {
          text: merged,
          start: seg1.index,
          end: seg3.index + t3.length,
        });
      }
    }

    // Check for 3-word Latin name: Word, Space, Word, Space, Word
    if (i + 4 < segments.length) {
      const seg2 = segments[i + 1];
      const seg3 = segments[i + 2];
      const seg4 = segments[i + 3];
      const seg5 = segments[i + 4];

      const t2 = seg2.segment;
      const t3 = seg3.segment;
      const t4 = seg4.segment;
      const t5 = seg5.segment;

      if (
        t2 === " " &&
        t3 &&
        isCapitalizedLatin(t3) &&
        t4 === " " &&
        t5 &&
        isCapitalizedLatin(t5)
      ) {
        const merged = t1 + t2 + t3 + t4 + t5;
        const key = `${seg1.index}-${seg5.index + t5.length}`;
        candidates.set(key, {
          text: merged,
          start: seg1.index,
          end: seg5.index + t5.length,
        });
      }
    }
  }

  const result = Array.from(candidates.values());
  result.sort((a, b) => a.start - b.start);

  return result.slice(0, maxCandidates);
}

export function attachTitleSuffix(baseCandidates: NameCandidate[], text: string): NameCandidate[] {
  const extended: NameCandidate[] = [...baseCandidates];
  const seen = new Set<string>();

  for (const base of baseCandidates) {
    const baseKey = `${base.start}-${base.end}`;
    if (seen.has(baseKey)) continue;
    seen.add(baseKey);

    for (const suffix of TITLE_SUFFIXES) {
      if (base.end + suffix.length <= text.length) {
        const nextChars = text.substring(base.end, base.end + suffix.length);
        if (nextChars === suffix) {
          const merged: NameCandidate = {
            text: base.text + suffix,
            start: base.start,
            end: base.end + suffix.length,
          };
          const mergedKey = `${merged.start}-${merged.end}`;
          if (!seen.has(mergedKey)) {
            extended.push(merged);
            seen.add(mergedKey);
          }
        }
      }
    }
  }

  return extended;
}
