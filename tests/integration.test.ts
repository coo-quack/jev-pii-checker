/**
 * Integration test: runs real judge over ibm_corpus.json.
 * Skipped unless JEV_PII_INTEGRATION=1.
 *
 * Assertions:
 * - Sensitivity level accuracy >= 0.85 on full corpus
 * - Seminar list → low
 * - Clinic list → high
 */

import { describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";
import { runGate } from "../src/gate";
import { createJevJudge } from "../src/judge";

const skipIntegration = !process.env.JEV_PII_INTEGRATION;

if (skipIntegration) {
  // Placeholder to avoid "No test suite found" error
  describe("Integration tests (skipped)", () => {
    test.skip("Set JEV_PII_INTEGRATION=1 to run", () => {});
  });
} else {
  describe("Integration tests (set JEV_PII_INTEGRATION=1)", () => {
    test("sensitivity levels match expected on ibm_corpus", async () => {
      const corpusPath = new URL("./fixtures/ibm_corpus.json", import.meta.url);
      const corpus = JSON.parse(readFileSync(corpusPath, "utf-8"));

      if (!Array.isArray(corpus)) {
        throw new Error("corpus should be an array");
      }

      const judge = createJevJudge();
      const results: Array<{ id: string; expected: string; actual: string }> = [];

      for (const item of corpus) {
        const gateResult = await runGate(judge, item.text);
        const expected = item.sensitivity ?? "none";
        const actual = gateResult.sensitivity.level;

        results.push({
          id: item.id,
          expected,
          actual,
        });
      }

      const correct = results.filter((r) => r.expected === r.actual).length;
      const accuracy = correct / results.length;

      console.log(`Accuracy: ${(accuracy * 100).toFixed(1)}% (${correct}/${results.length})`);

      for (const r of results) {
        if (r.expected !== r.actual) {
          console.log(`  MISS: ${r.id}: expected ${r.expected}, got ${r.actual}`);
        }
      }

      expect(accuracy).toBeGreaterThanOrEqual(0.85);
    });

    test("context sensitivity: seminar list is low", async () => {
      const corpusPath = new URL("./fixtures/ibm_corpus.json", import.meta.url);
      const corpus = JSON.parse(readFileSync(corpusPath, "utf-8"));

      const seminarItem = corpus.find((item: { id: string }) => item.id === "context_seminar_list");
      expect(seminarItem).toBeTruthy();

      const judge = createJevJudge();
      const gateResult = await runGate(judge, seminarItem.text);

      console.log(`Seminar sensitivity: ${gateResult.sensitivity.level}`);
      expect(gateResult.sensitivity.level).toBe("low");
    });

    test("context sensitivity: clinic list is high", async () => {
      const corpusPath = new URL("./fixtures/ibm_corpus.json", import.meta.url);
      const corpus = JSON.parse(readFileSync(corpusPath, "utf-8"));

      const clinicItem = corpus.find((item: { id: string }) => item.id === "context_clinic_list");
      expect(clinicItem).toBeTruthy();

      const judge = createJevJudge();
      const gateResult = await runGate(judge, clinicItem.text);

      console.log(`Clinic sensitivity: ${gateResult.sensitivity.level}`);
      expect(gateResult.sensitivity.level).toBe("high");
    });
  });
}
