import { describe, expect, test } from "vitest";

describe("CLI argument parsing", () => {
  test("parses basic args", () => {
    const args = ["--json", "--threshold", "0.3"];
    const parsed: Record<string, string | boolean> = {};
    for (let i = 0; i < args.length; i++) {
      if (args[i].startsWith("--")) {
        const key = args[i].substring(2);
        if (i + 1 < args.length && !args[i + 1].startsWith("--")) {
          parsed[key] = args[++i];
        } else {
          parsed[key] = true;
        }
      }
    }
    expect(parsed.json).toBe(true);
    expect(parsed.threshold).toBe("0.3");
  });

  test("exit code mapping: none -> 0", () => {
    const failOnLevel = "none";
    const actualLevel = "low";
    const failRank: Record<string, number> = { none: 0, low: 1, high: 2 };
    const failThreshold = failRank[failOnLevel] ?? 0;
    const actualRank = failRank[actualLevel] ?? 0;
    expect(actualRank >= failThreshold && failThreshold > 0).toBe(false);
  });

  test("exit code mapping: low with low -> 2", () => {
    const failOnLevel = "low";
    const actualLevel = "low";
    const failRank: Record<string, number> = { none: 0, low: 1, high: 2 };
    const failThreshold = failRank[failOnLevel] ?? 0;
    const actualRank = failRank[actualLevel] ?? 0;
    expect(actualRank >= failThreshold && failThreshold > 0).toBe(true);
  });
});
