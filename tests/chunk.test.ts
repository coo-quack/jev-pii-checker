import { describe, expect, test } from "vitest";
import {
  aggregateCategoryProbabilities,
  aggregateSensitivityLevel,
  splitIntoChunks,
} from "../src/chunk";

describe("Text chunking", () => {
  test("splits at paragraph boundaries", () => {
    const text = "First paragraph.\n\nSecond paragraph.\n\nThird.";
    const chunks = splitIntoChunks(text, 20);
    expect(chunks.length).toBeGreaterThan(1);
  });

  test("splits at sentence boundaries (Japanese)", () => {
    const text = "最初の文。次の文。最後の文。";
    const chunks = splitIntoChunks(text, 10);
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.text).toBeTruthy();
    }
  });

  test("respects max chunk size", () => {
    const text = "a".repeat(10000);
    const chunks = splitIntoChunks(text, 1000);
    for (const chunk of chunks) {
      expect(chunk.text.length).toBeLessThanOrEqual(1000);
    }
  });

  test("covers entire text", () => {
    const text = "First. Second. Third. Fourth.";
    const chunks = splitIntoChunks(text, 100);
    const reconstructed = chunks.map((c) => c.text).join("");
    expect(reconstructed).toBe(text);
  });
});

describe("Category aggregation", () => {
  test("takes max probability per category", () => {
    const probs = [
      { person_name: 0.6, email_or_phone: 0.3 },
      { person_name: 0.4, email_or_phone: 0.9 },
    ];
    const agg = aggregateCategoryProbabilities(probs);
    expect(agg.person_name).toBe(0.6);
    expect(agg.email_or_phone).toBe(0.9);
  });

  test("handles empty input", () => {
    const agg = aggregateCategoryProbabilities([]);
    expect(Object.keys(agg).length).toBe(0);
  });
});

describe("Sensitivity level aggregation", () => {
  test("low > none", () => {
    const levels = ["none", "low"];
    expect(aggregateSensitivityLevel(levels)).toBe("low");
  });

  test("high > low > none", () => {
    const levels = ["none", "low", "high"];
    expect(aggregateSensitivityLevel(levels)).toBe("high");
  });

  test("returns none for empty", () => {
    expect(aggregateSensitivityLevel([])).toBe("none");
  });
});
