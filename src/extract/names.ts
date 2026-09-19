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

export interface NameCandidatesResult {
  candidates: NameCandidate[];
  titleMap: Map<string, string>; // maps candidate text -> title word that was stripped
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
  // This handles hyphenated names like Al-Rashid, Jean-Pierre as single words
  const rest = text.slice(1);
  return /^[a-zA-Z'-]*$/.test(rest);
}

function stripPossessive(text: string): { text: string; end: number } {
  // Strip trailing 's or 's (curly quote) from text
  if (text.endsWith("'s")) {
    return { text: text.slice(0, -2), end: -2 };
  }
  if (text.endsWith("'s")) {
    return { text: text.slice(0, -2), end: -2 };
  }
  return { text, end: 0 };
}

// English title/role words to exclude from the start of candidates
const ENGLISH_TITLES = new Set([
  "patient",
  "rabbi",
  "imam",
  "priest",
  "pastor",
  "dr",
  "mr",
  "ms",
  "mrs",
  "miss",
  "prof",
  "professor",
  "doctor",
  "manager",
  "director",
  "president",
  "ceo",
  "cto",
  "sir",
  "madam",
  "lord",
  "lady",
  "captain",
  "officer",
  "agent",
  "user",
  "customer",
  "client",
  "member",
  "members",
]);

export function generateNameCandidates(text: string, maxCandidates = 600): NameCandidate[] {
  const result = generateNameCandidatesWithTitles(text, maxCandidates);
  return result.candidates;
}

export function generateNameCandidatesWithTitles(
  text: string,
  maxCandidates = 600,
): NameCandidatesResult {
  const segmenter = new Intl.Segmenter("ja", { granularity: "word" });
  const segments = Array.from(segmenter.segment(text));

  const candidates = new Map<string, NameCandidate>();
  const titleMap = new Map<string, string>();

  for (const seg of segments) {
    const segment = seg.segment;
    if (!segment) continue;

    const hasKanjiKatakanaOrLatin = segment.split("").some((c) => isKanjiKatakanaOrLatin(c));
    // A Latin-script word is a name candidate only when capitalized: "name",
    // "report" and the like otherwise reach the judge, which reads them
    // literally ("My name is" → 「name」 refers to a person, 0.97).
    const isLowercaseLatin = /^[a-z]/.test(segment);
    const isPureHira = isPureHiragana(segment);
    const isPureDig = isPureDigits(segment);
    const isParticle = PARTICLES.has(segment);

    // Skip possessive-suffixed words
    const hasPossessiveSuffix = segment.endsWith("'s") || segment.endsWith("'s");

    // Skip Japanese titles
    const isJapaneseTitle = TITLE_SUFFIXES.has(segment);

    // Skip English titles (case-insensitive)
    const isEnglishTitle = ENGLISH_TITLES.has(segment.toLowerCase());

    if (
      !hasKanjiKatakanaOrLatin ||
      isLowercaseLatin ||
      isPureHira ||
      isPureDig ||
      isParticle ||
      hasPossessiveSuffix ||
      isJapaneseTitle ||
      isEnglishTitle
    ) {
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

  // Latin multi-word names. Work on tokens rather than raw segments so that a
  // hyphenated name (Al-Rashid, Jean-Pierre) is one word: the segmenter splits
  // it into "Al", "-", "Rashid".
  type Token = { text: string; start: number; end: number; space: boolean };
  const tokens: Token[] = [];
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const t = seg.segment;
    if (!t) continue;
    if (t === " ") {
      tokens.push({ text: t, start: seg.index, end: seg.index + 1, space: true });
      continue;
    }
    if (!isCapitalizedLatin(t)) {
      tokens.push({ text: t, start: seg.index, end: seg.index + t.length, space: false });
      continue;
    }
    // Join Word-Word chains with no spaces around the hyphen.
    let joined = t;
    let joinedEnd = seg.index + t.length;
    while (
      i + 2 < segments.length &&
      segments[i + 1].segment === "-" &&
      segments[i + 1].index === joinedEnd &&
      isCapitalizedLatin(segments[i + 2].segment) &&
      segments[i + 2].index === joinedEnd + 1
    ) {
      joined += `-${segments[i + 2].segment}`;
      joinedEnd = segments[i + 2].index + segments[i + 2].segment.length;
      i += 2;
    }
    tokens.push({ text: joined, start: seg.index, end: joinedEnd, space: false });
  }

  const isNameWord = (tok: Token | undefined): tok is Token =>
    !!tok &&
    !tok.space &&
    isCapitalizedLatin(tok.text) &&
    !ENGLISH_TITLES.has(tok.text.toLowerCase());

  const addLatin = (first: Token, last: Token, words: Token[], titleBefore?: Token) => {
    let textOut = words.map((w) => w.text).join(" ");
    let endPos = last.end;
    const stripped = stripPossessive(textOut);
    textOut = stripped.text;
    endPos += stripped.end;
    if (textOut.length === 0) return;
    const key = `${first.start}-${endPos}`;
    candidates.set(key, { text: textOut, start: first.start, end: endPos });
    if (titleBefore) titleMap.set(textOut, titleBefore.text);
  };

  for (let i = 0; i < tokens.length; i++) {
    const w1 = tokens[i];
    if (!isNameWord(w1)) continue;
    // A title immediately before the name (Rabbi David Goldman) is recorded, never merged.
    const prevWord = i >= 2 && tokens[i - 1].space ? tokens[i - 2] : undefined;
    const titleBefore =
      prevWord && !prevWord.space && ENGLISH_TITLES.has(prevWord.text.toLowerCase())
        ? prevWord
        : undefined;
    // Hyphenated single words are candidates in their own right (Al-Rashid).
    if (w1.text.includes("-")) addLatin(w1, w1, [w1], titleBefore);
    const w2 = tokens[i + 2];
    if (tokens[i + 1]?.space && isNameWord(w2)) {
      addLatin(w1, w2, [w1, w2], titleBefore);
      const w3 = tokens[i + 4];
      if (tokens[i + 3]?.space && isNameWord(w3)) {
        addLatin(w1, w3, [w1, w2, w3], titleBefore);
      }
    }
  }

  const result = Array.from(candidates.values());

  // Sort by start position first
  result.sort((a, b) => a.start - b.start);

  // If we need to truncate, keep longer candidates first at each position
  if (result.length > maxCandidates) {
    // Group by start position, then sort each group by length (longest first)
    const byStart = new Map<number, typeof result>();
    for (const cand of result) {
      if (!byStart.has(cand.start)) {
        byStart.set(cand.start, []);
      }
      byStart.get(cand.start)!.push(cand);
    }

    const truncated: typeof result = [];
    for (const [, group] of byStart) {
      group.sort((a, b) => b.end - b.start - (a.end - a.start));
      truncated.push(...group);
      if (truncated.length >= maxCandidates) {
        break;
      }
    }

    return { candidates: truncated.slice(0, maxCandidates), titleMap };
  }

  return { candidates: result, titleMap };
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
