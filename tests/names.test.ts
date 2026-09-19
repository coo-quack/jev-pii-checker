import { describe, expect, test } from "vitest";
import { attachTitleSuffix, generateNameCandidates } from "../src/extract/names";

describe("Name candidate generation", () => {
  test("extracts kanji/kana segments", () => {
    const text = "佐藤健一郎さんに営業資料を送った";
    const candidates = generateNameCandidates(text);
    const candTexts = candidates.map((c) => c.text);
    expect(candTexts).toContain("佐藤");
    expect(candTexts).toContain("健一郎");
  });

  test("merges consecutive kanji segments", () => {
    const text = "佐藤健一郎さんに会った";
    const candidates = generateNameCandidates(text);
    const candTexts = candidates.map((c) => c.text);
    expect(candTexts).toContain("佐藤健一郎");
  });

  test("filters pure hiragana", () => {
    const text = "ください。ありがとうございました。";
    const candidates = generateNameCandidates(text);
    const candTexts = candidates.map((c) => c.text);
    expect(candTexts).not.toContain("ください");
    expect(candTexts).not.toContain("ありがとう");
  });

  test("filters particles", () => {
    const text = "山田太郎の報告。";
    const candidates = generateNameCandidates(text);
    const candTexts = candidates.map((c) => c.text);
    expect(candTexts).not.toContain("の");
  });

  test("respects candidate cap", () => {
    const text = "山田太郎、鈴木花子、田中美咲、佐藤健太、伊藤美香、渡辺太郎";
    const candidates = generateNameCandidates(text, 10);
    expect(candidates.length).toBeLessThanOrEqual(10);
  });

  test("extracts capitalized English names", () => {
    const text = "Emily Carter joined the team.";
    const candidates = generateNameCandidates(text);
    const candTexts = candidates.map((c) => c.text);
    expect(candTexts.some((t) => t.includes("Emily") || t.includes("Carter"))).toBe(true);
  });

  test("merges Latin multi-word names separated by space", () => {
    const text = "Payment received from Emily Carter, card 4111.";
    const candidates = generateNameCandidates(text);
    const candTexts = candidates.map((c) => c.text);
    expect(candTexts).toContain("Emily Carter");
  });

  test("merges three-word Latin names", () => {
    const text = "John Paul Smith is here";
    const candidates = generateNameCandidates(text);
    const candTexts = candidates.map((c) => c.text);
    expect(
      candTexts.some((t) => t.includes("John") && t.includes("Paul") && t.includes("Smith")),
    ).toBe(true);
  });

  test("does not merge Latin names across punctuation", () => {
    const text = "Emily, Carter wrote something";
    const candidates = generateNameCandidates(text);
    const candTexts = candidates.map((c) => c.text);
    expect(candTexts).not.toContain("Emily Carter");
  });

  test("does not merge across lowercase word", () => {
    const text = "The emily Carter problem";
    const candidates = generateNameCandidates(text);
    const candTexts = candidates.map((c) => c.text);
    expect(candTexts).not.toContain("emily Carter");
  });

  test("merges Japanese multi-word names unchanged", () => {
    const text = "佐藤太郎と田中花子が会った";
    const candidates = generateNameCandidates(text);
    const candTexts = candidates.map((c) => c.text);
    expect(candTexts).toContain("佐藤太郎");
    expect(candTexts).toContain("田中花子");
  });

  test("Natsume Soseki as single candidate", () => {
    const text = "Natsume Soseki wrote Kokoro";
    const candidates = generateNameCandidates(text);
    const candTexts = candidates.map((c) => c.text);
    expect(candTexts).toContain("Natsume Soseki");
  });
});

describe("Title suffix attachment", () => {
  test("attaches さん suffix", () => {
    const text = "田中さんに連絡した";
    const base = generateNameCandidates(text);
    const extended = attachTitleSuffix(base, text);
    const candTexts = extended.map((c) => c.text);
    expect(candTexts).toContain("田中さん");
  });

  test("attaches 部長 suffix", () => {
    const text = "田中部長に報告した";
    const base = generateNameCandidates(text);
    const extended = attachTitleSuffix(base, text);
    const candTexts = extended.map((c) => c.text);
    expect(candTexts).toContain("田中部長");
  });

  test("merges adjacent candidates with titles", () => {
    const text = "会議の出席者は山田太郎、鈴木花子、李副社長である";
    const base = generateNameCandidates(text);
    const extended = attachTitleSuffix(base, text);
    const candTexts = extended.map((c) => c.text);
    expect(candTexts.some((t) => t.includes("副社長"))).toBe(true);
  });
});
