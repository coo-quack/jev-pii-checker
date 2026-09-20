#!/usr/bin/env bun
/**
 * Evaluation script for jev-pii-checker.
 * Runs the detection library against the eval corpus and reports metrics.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { splitIntoChunks, aggregateSensitivityLevel } from "../src/chunk.js";
import { runGate } from "../src/gate.js";
import { applySensitivityPolicy } from "../src/policy.js";
import { aggregateCategoryProbabilities } from "../src/chunk.js";
import { createJevJudge, type Judge } from "../src/judge.js";
import { locatePII, type PIIFinding } from "../src/locate.js";
import type { SensitivityLevel } from "../src/gate.js";

interface EvalExpectedFinding {
  type: "person_name" | "email" | "phone" | "number";
  value: string;
  pii: boolean;
  number_type?: string;
  honorific?: string;
  public_figure?: boolean;
}

interface EvalEntry {
  id: string;
  lang: string;
  format: string;
  text: string;
  expected: {
    sensitivity: SensitivityLevel;
    findings: EvalExpectedFinding[];
  };
}

interface EvalCorpus {
  tests: EvalEntry[];
}

interface EvalResult {
  id: string;
  text: string;
  predictions: PIIFinding[];
  expected: EvalExpectedFinding[];
  sensitivityPrediction: SensitivityLevel;
  sensitivityExpected: SensitivityLevel;
  matches: Array<{
    predicted: PIIFinding | null;
    expected: EvalExpectedFinding | null;
    type: string;
    normalized: { predicted: string; expected: string };
    isCorrect: boolean;
    reason: string;
  }>;
}

function normalizeValue(value: string, type: string): string {
  if (type === "phone") {
    return value.replace(/[\s\-()]/g, "");
  }
  if (type === "email") {
    return value.toLowerCase();
  }
  if (type === "number") {
    return value.replace(/[\s\-()]/g, "");
  }
  if (type === "person_name") {
    // Remove trailing honorifics and normalize spaces
    let result = value.trim();
    const honorifics = [
      "部長",
      "さん",
      "師",
      "医師",
      "先生",
      "Dr.",
      "Mr.",
      "Ms.",
      "Mrs.",
      "Dr",
      "Dr.",
      "Ph.D",
    ];
    for (const honorific of honorifics) {
      if (result.endsWith(honorific)) {
        result = result.slice(0, -honorific.length);
        break;
      }
    }
    return result.trim();
  }
  return value;
}

function matchFindings(
  predicted: PIIFinding[],
  expected: EvalExpectedFinding[],
): Array<{
  predicted: PIIFinding | null;
  expected: EvalExpectedFinding | null;
  type: string;
  normalized: { predicted: string; expected: string };
  isCorrect: boolean;
  reason: string;
}> {
  const matches: Array<{
    predicted: PIIFinding | null;
    expected: EvalExpectedFinding | null;
    type: string;
    normalized: { predicted: string; expected: string };
    isCorrect: boolean;
    reason: string;
  }> = [];

  const usedPredicted = new Set<number>();
  const usedExpected = new Set<number>();

  // Match by type first, then by normalized value
  for (let ei = 0; ei < expected.length; ei++) {
    const exp = expected[ei];
    let found = false;

    for (let pi = 0; pi < predicted.length; pi++) {
      if (usedPredicted.has(pi)) continue;

      const pred = predicted[pi];
      if (pred.type !== exp.type) continue;

      const predNorm = normalizeValue(pred.value, pred.type);
      const expNorm = normalizeValue(exp.value, exp.type);

      if (predNorm === expNorm && pred.pii === exp.pii) {
        matches.push({
          predicted: pred,
          expected: exp,
          type: exp.type,
          normalized: { predicted: predNorm, expected: expNorm },
          isCorrect: true,
          reason: "match",
        });
        usedPredicted.add(pi);
        usedExpected.add(ei);
        found = true;
        break;
      }
    }

    if (!found) {
      matches.push({
        predicted: null,
        expected: exp,
        type: exp.type,
        normalized: { predicted: "", expected: normalizeValue(exp.value, exp.type) },
        isCorrect: false,
        reason: "missing_prediction",
      });
      usedExpected.add(ei);
    }
  }

  // Add false positives
  for (let pi = 0; pi < predicted.length; pi++) {
    if (!usedPredicted.has(pi)) {
      const pred = predicted[pi];
      matches.push({
        predicted: pred,
        expected: null,
        type: pred.type,
        normalized: { predicted: normalizeValue(pred.value, pred.type), expected: "" },
        isCorrect: false,
        reason: "false_positive",
      });
    }
  }

  return matches;
}

async function evaluateEntry(
  judge: Judge,
  entry: EvalEntry,
  threshold = 0.5,
  spanThreshold = 0.8,
  maxChars = 4000,
): Promise<{ result: EvalResult; inputTokens: number; requests: number }> {
  const chunks = splitIntoChunks(entry.text, maxChars);

  let allPredictions: PIIFinding[] = [];
  let totalInputTokens = 0;
  let requestCount = 0;
  const chunkCategories: Array<Record<string, number>> = [];
  const chunkSensitivities: Array<{
    level: SensitivityLevel;
    score: number;
    probabilities: Record<string, number>;
  }> = [];

  for (const chunk of chunks) {
    const gateResult = await runGate(judge, chunk.text);
    totalInputTokens += gateResult.inputTokens;
    requestCount += 1;

    // Collect sensitivity from gate
    chunkSensitivities.push(gateResult.sensitivity);
    chunkCategories.push(gateResult.categories);

    const personNameGateProb = gateResult.categories.person_name;

    try {
      const locateResult = await locatePII(
        judge,
        chunk.text,
        personNameGateProb,
        threshold,
        spanThreshold,
        false,
      );
      totalInputTokens += locateResult.inputTokens;
      requestCount += 1;

      allPredictions.push(...locateResult.findings);
    } catch (err) {
      console.error(`Error in locatePII for ${entry.id}:`, err);
      throw err;
    }
  }

  // Deduplicate predictions by value + type (keep highest probability)
  const predByKey = new Map<string, PIIFinding>();
  for (const pred of allPredictions) {
    const key = `${pred.type}:${pred.value}:${pred.pii}`;
    const existing = predByKey.get(key);
    if (!existing || pred.probability > existing.probability) {
      predByKey.set(key, pred);
    }
  }
  allPredictions = Array.from(predByKey.values());

  const matches = matchFindings(allPredictions, entry.expected.findings);

  // Use model's predicted sensitivity: aggregate across chunks, take the maximum level
  const sensitivityLevels = chunkSensitivities.map((s) => s.level);
  const sensitivityPrediction =
    sensitivityLevels.length > 0
      ? (aggregateSensitivityLevel(sensitivityLevels) as SensitivityLevel)
      : "none";
  // Same policy as the CLI, so the harness measures what users get.
  const policyResult = applySensitivityPolicy({
    level: sensitivityPrediction,
    categories: aggregateCategoryProbabilities(chunkCategories),
    findings: allPredictions,
    threshold,
    spansComputed: true,
  });
  const finalSensitivity = policyResult.level;

  return {
    result: {
      id: entry.id,
      text: entry.text.substring(0, 100),
      predictions: allPredictions,
      expected: entry.expected.findings,
      sensitivityPrediction: finalSensitivity,
      sensitivityExpected: entry.expected.sensitivity,
      matches,
    },
    inputTokens: totalInputTokens,
    requests: requestCount,
  };
}

async function main() {
  const args = process.argv.slice(2);
  let outputPath: string | null = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--json" && args[i + 1]) {
      outputPath = args[i + 1];
      i++;
    }
  }

  if (!process.env.TYPESAFE_API_KEY) {
    console.error("Error: TYPESAFE_API_KEY environment variable is required");
    process.exit(1);
  }

  // --corpus PATH selects another fixture (e.g. tests/fixtures/eval_holdout.json).
  const corpusArgIdx = process.argv.indexOf("--corpus");
  const corpusPath =
    corpusArgIdx >= 0 && process.argv[corpusArgIdx + 1]
      ? new URL(process.argv[corpusArgIdx + 1], `file://${process.cwd()}/`)
      : new URL("../tests/fixtures/eval_corpus.json", import.meta.url);
  const corpusData = JSON.parse(readFileSync(corpusPath, "utf-8")) as EvalCorpus;

  const judge = createJevJudge(process.env.TYPESAFE_API_KEY);

  console.log(`Running evaluation on ${corpusData.tests.length} entries...`);

  const results: EvalResult[] = [];
  let totalTokens = 0;
  let totalRequests = 0;
  const startTime = Date.now();

  for (const entry of corpusData.tests) {
    const { result, inputTokens, requests } = await evaluateEntry(judge, entry);
    results.push(result);
    totalTokens += inputTokens;
    totalRequests += requests;
    process.stdout.write(".");
  }

  const wallTimeMs = Date.now() - startTime;

  console.log("\n\n=== Evaluation Results ===\n");

  // Calculate metrics by type
  const typeMetrics: Record<
    string,
    { tp: number; fp: number; fn: number; precision: number; recall: number; f1: number }
  > = {};
  const types = ["person_name", "email", "phone", "number"];

  for (const type of types) {
    let tp = 0;
    let fp = 0;
    let fn = 0;

    for (const result of results) {
      for (const match of result.matches) {
        if (match.type !== type) continue;

        if (match.predicted && match.expected) {
          if (match.isCorrect) tp++;
        } else if (match.predicted && !match.expected) {
          fp++;
        } else if (!match.predicted && match.expected) {
          fn++;
        }
      }
    }

    const precision = tp + fp === 0 ? 0 : tp / (tp + fp);
    const recall = tp + fn === 0 ? 0 : tp / (tp + fn);
    const f1 = precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);

    typeMetrics[type] = { tp, fp, fn, precision, recall, f1 };
  }

  console.log("Finding Type Metrics (Precision / Recall / F1):");
  console.log("─".repeat(60));

  for (const type of types) {
    const { precision, recall, f1 } = typeMetrics[type];
    console.log(
      `${type.padEnd(15)} P: ${(precision * 100).toFixed(1).padStart(5)}%  R: ${(recall * 100).toFixed(1).padStart(5)}%  F1: ${(f1 * 100).toFixed(1).padStart(5)}%`,
    );
  }

  // Per-language breakdown for person_name
  console.log("\n\nPerson Name Metrics by Language:");
  console.log("─".repeat(60));

  const langMetrics: Record<
    string,
    { tp: number; fp: number; fn: number; precision: number; recall: number; f1: number }
  > = {};

  for (const result of results) {
    const lang = corpusData.tests.find((t) => t.id === result.id)?.lang || "unknown";
    if (!langMetrics[lang]) {
      langMetrics[lang] = { tp: 0, fp: 0, fn: 0, precision: 0, recall: 0, f1: 0 };
    }

    for (const match of result.matches) {
      if (match.type !== "person_name") continue;

      if (match.predicted && match.expected) {
        if (match.isCorrect) langMetrics[lang].tp++;
      } else if (match.predicted && !match.expected) {
        langMetrics[lang].fp++;
      } else if (!match.predicted && match.expected) {
        langMetrics[lang].fn++;
      }
    }
  }

  for (const [lang, metrics] of Object.entries(langMetrics)) {
    const precision = metrics.tp + metrics.fp === 0 ? 0 : metrics.tp / (metrics.tp + metrics.fp);
    const recall = metrics.tp + metrics.fn === 0 ? 0 : metrics.tp / (metrics.tp + metrics.fn);
    const f1 = precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);

    langMetrics[lang].precision = precision;
    langMetrics[lang].recall = recall;
    langMetrics[lang].f1 = f1;

    console.log(
      `${lang.padEnd(10)} P: ${(precision * 100).toFixed(1).padStart(5)}%  R: ${(recall * 100).toFixed(1).padStart(5)}%  F1: ${(f1 * 100).toFixed(1).padStart(5)}%`,
    );
  }

  // Sensitivity metrics
  console.log("\n\nSensitivity Classification:");
  console.log("─".repeat(60));

  const sensitivityMatrix: Record<SensitivityLevel, Record<SensitivityLevel, number>> = {
    none: { none: 0, low: 0, high: 0 },
    low: { none: 0, low: 0, high: 0 },
    high: { none: 0, low: 0, high: 0 },
  };

  let sensitivityCorrect = 0;

  for (const result of results) {
    sensitivityMatrix[result.sensitivityExpected][result.sensitivityPrediction]++;
    if (result.sensitivityExpected === result.sensitivityPrediction) {
      sensitivityCorrect++;
    }
  }

  console.log(
    `Accuracy: ${((sensitivityCorrect / results.length) * 100).toFixed(1)}% (${sensitivityCorrect}/${results.length})`,
  );
  console.log("\nConfusion Matrix (Expected × Predicted):");
  console.log("           Predicted: none   low   high");
  for (const exp of ["none", "low", "high"] as SensitivityLevel[]) {
    const row = sensitivityMatrix[exp];
    console.log(
      `Expected ${exp.padEnd(3)}: ${row.none.toString().padStart(4)}  ${row.low.toString().padStart(4)}  ${row.high.toString().padStart(4)}`,
    );
  }

  // Collect all failures
  console.log("\n\nFalse Positives and False Negatives:");
  console.log("─".repeat(60));

  const failures: Array<{
    id: string;
    type: string;
    value?: string;
    expected?: string;
    reason: string;
    probability?: number;
    detail?: string;
  }> = [];

  for (const result of results) {
    for (const match of result.matches) {
      if (!match.isCorrect) {
        if (match.predicted && !match.expected) {
          // False positive - include probability and detail
          const detail = match.predicted.detail
            ? JSON.stringify(match.predicted.detail)
            : undefined;
          failures.push({
            id: result.id,
            type: `FP[${match.type}]`,
            value: match.predicted.value,
            reason: "unexpected_detection",
            probability: match.predicted.probability,
            detail,
          });
        } else if (!match.predicted && match.expected) {
          // False negative (missed detection) - include expected PII flag
          failures.push({
            id: result.id,
            type: `FN[${match.type}]`,
            expected: match.expected.value,
            reason: "missed_detection",
            detail: match.expected.pii ? "expected PII" : "expected non-PII",
          });
        }
      }
    }
  }

  console.log(`Total failures: ${failures.length}\n`);

  const failuresByReason: Record<string, typeof failures> = {};
  for (const failure of failures) {
    const key = failure.reason;
    if (!failuresByReason[key]) failuresByReason[key] = [];
    failuresByReason[key].push(failure);
  }

  for (const [reason, items] of Object.entries(failuresByReason)) {
    console.log(`\n${reason}: ${items.length} occurrences`);
    for (const item of items.slice(0, 5)) {
      const detail = item.value ? `"${item.value}"` : `"${item.expected}"`;
      const extraInfo =
        item.probability !== undefined ? ` (prob: ${(item.probability * 100).toFixed(1)}%)` : "";
      const extraDetail = item.detail ? ` [${item.detail}]` : "";
      console.log(`  - ${item.id}: ${item.type} ${detail}${extraInfo}${extraDetail}`);
    }
    if (items.length > 5) {
      console.log(`  ... and ${items.length - 5} more`);
    }
  }

  // Stats
  console.log("\n\nPerformance Stats:");
  console.log("─".repeat(60));
  console.log(`Input tokens: ${totalTokens}`);
  console.log(`API requests: ${totalRequests}`);
  console.log(`Wall time: ${(wallTimeMs / 1000).toFixed(2)}s`);
  const charsProcessed = corpusData.tests.reduce((sum, t) => sum + t.text.length, 0);
  const tokensPerK = (totalTokens / (charsProcessed / 1000)).toFixed(1);
  console.log(`Tokens per 1k chars: ~${tokensPerK}`);

  // Output JSON if requested
  if (outputPath) {
    const jsonOutput = {
      summary: {
        total_entries: results.length,
        type_metrics: typeMetrics,
        sensitivity_accuracy: sensitivityCorrect / results.length,
        sensitivity_confusion_matrix: sensitivityMatrix,
        total_tokens: totalTokens,
        total_requests: totalRequests,
        wall_time_ms: wallTimeMs,
      },
      failures: failures,
      results: results.map((r) => ({
        id: r.id,
        text: r.text,
        predictions: r.predictions.map((p) => ({
          type: p.type,
          value: p.value,
          pii: p.pii,
          probability: p.probability,
          detail: p.detail,
        })),
        expected: r.expected,
        matches: r.matches,
        sensitivity: { predicted: r.sensitivityPrediction, expected: r.sensitivityExpected },
      })),
    };
    writeFileSync(outputPath, JSON.stringify(jsonOutput, null, 2));
    console.log(`\nJSON output written to: ${outputPath}`);
  }
}

main().catch((err) => {
  console.error("Evaluation error:", err);
  process.exit(1);
});
