/**
 * CLI entry point for jev-pii-checker.
 * Reads files or stdin, runs PII detection, outputs JSON or human-readable format.
 */

import { existsSync, readFileSync } from "node:fs";
import { parseArgs } from "node:util";
import {
  aggregateCategoryProbabilities,
  aggregateSensitivityLevel,
  splitIntoChunks,
} from "./chunk.js";
import { runGate } from "./gate.js";
import { createJevJudge } from "./judge.js";
import { locatePII } from "./locate.js";
import { maskValue } from "./mask.js";
import { formatHuman, formatJSON, type Report } from "./report.js";

const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf-8"));

async function readStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = "";
    process.stdin.setEncoding("utf-8");
    process.stdin.on("data", (chunk) => {
      data += chunk;
    });
    process.stdin.on("end", () => {
      resolve(data);
    });
    process.stdin.on("error", reject);
  });
}

async function main() {
  const { values, positionals } = parseArgs({
    options: {
      json: { type: "boolean", default: false },
      threshold: { type: "string", default: "0.5" },
      "span-threshold": { type: "string", default: "0.8" },
      "no-spans": { type: "boolean", default: false },
      "fail-on": { type: "string", default: "none" },
      "show-values": { type: "boolean", default: false },
      model: { type: "string" },
      "max-chars": { type: "string", default: "4000" },
      concurrency: { type: "string", default: "4" },
      help: { type: "boolean" },
      version: { type: "boolean" },
    },
    allowPositionals: true,
  }) as { values: Record<string, string | boolean>; positionals: string[] };

  if (values.help) {
    console.log(`
jev-pii-checker - PII detection via TypeSafe Jev

Usage:
  jev-pii-checker [files...]

Flags:
  --json                  Output JSON
  --threshold <0-1>       Gate probability threshold (default: 0.5)
  --span-threshold <0-1>  Name candidate threshold (default: 0.8)
  --no-spans              Skip name extraction
  --fail-on none|low|high Exit with code 2 if severity >= level (default: none)
  --show-values           Show unmasked PII values
  --model <id>            TypeSafe model (optional)
  --max-chars <n>         Chunk size in bytes (default: 4000)
  --concurrency <n>       Parallel requests (default: 4, not yet used)
  --help                  Show this help
  --version               Show version

Environment:
  TYPESAFE_API_KEY        TypeSafe API key (required)

Examples:
  echo "佐藤健一郎 090-1234-5678" | jev-pii-checker --json
  jev-pii-checker file1.txt file2.txt
`);
    process.exit(0);
  }

  if (values.version) {
    console.log(`jev-pii-checker ${pkg.version}`);
    process.exit(0);
  }

  const threshold = parseFloat(values.threshold as string);
  const spanThreshold = parseFloat(values["span-threshold"] as string);
  const maxChars = parseInt(values["max-chars"] as string, 10);
  const failOnLevel = values["fail-on"] as string;
  const skipSpans = values["no-spans"] as boolean;
  const showValues = values["show-values"] as boolean;
  const outputJson = values.json as boolean;

  if (!process.env.TYPESAFE_API_KEY) {
    console.error("Error: TYPESAFE_API_KEY environment variable is required");
    process.exit(1);
  }

  const judge = createJevJudge();
  const reports: Report[] = [];
  let maxSeverity: "none" | "low" | "high" = "none";

  const files = positionals.length > 0 ? positionals : ["-"];

  for (const file of files) {
    let text = "";
    const source = file === "-" ? "stdin" : file;

    try {
      if (file === "-") {
        text = await readStdin();
      } else {
        if (!existsSync(file)) {
          console.error(`Error: File not found: ${file}`);
          process.exit(1);
        }
        text = readFileSync(file, "utf-8");
      }
    } catch (err) {
      console.error(`Error reading ${source}:`, err);
      process.exit(1);
    }

    const chunks = splitIntoChunks(text, maxChars);
    const chunkResults = [];
    let totalTokens = 0;
    let totalRequests = 0;

    for (const chunk of chunks) {
      const gateResult = await runGate(judge, chunk.text);
      totalTokens += gateResult.inputTokens;
      totalRequests += 1;

      const locateResult = await locatePII(
        judge,
        chunk.text,
        gateResult.categories.person_name,
        threshold,
        spanThreshold,
        skipSpans,
      );
      totalTokens += locateResult.inputTokens;
      totalRequests += 1;

      chunkResults.push({
        gate: gateResult,
        findings: locateResult.findings,
      });
    }

    const aggCats = aggregateCategoryProbabilities(chunkResults.map((c) => c.gate.categories));
    const aggLevels = chunkResults.map((c) => c.gate.sensitivity.level);
    const aggLevel = aggregateSensitivityLevel(aggLevels);
    const aggProbs = chunkResults[0]?.gate.sensitivity.probabilities ?? {};

    const allFindings = [];
    for (const chunk of chunkResults) {
      for (const f of chunk.findings) {
        allFindings.push({
          type: f.type,
          value: showValues ? f.value : maskValue(f.value),
          start: f.start,
          end: f.end,
          probability: f.probability,
          detail: f.detail,
          pii: f.pii,
        });
      }
    }

    const report: Report = {
      source,
      sensitivity: {
        level: aggLevel,
        score: Math.max(...chunkResults.map((c) => c.gate.sensitivity.score)),
        probabilities: aggProbs,
      },
      categories: aggCats,
      findings: allFindings,
      chunks: chunks.length,
      usage: {
        input_tokens: totalTokens,
        requests: totalRequests,
      },
    };

    reports.push(report);

    const levelRank: Record<string, number> = { none: 0, low: 1, high: 2 };
    const reportRank = levelRank[aggLevel] ?? 0;
    const maxRank = levelRank[maxSeverity] ?? 0;
    if (reportRank > maxRank) {
      maxSeverity = aggLevel as "none" | "low" | "high";
    }
  }

  if (outputJson) {
    console.log(formatJSON(reports));
  } else {
    console.log(formatHuman(reports));
  }

  const failRank: Record<string, number> = { none: 0, low: 1, high: 2 };
  const failThreshold = failRank[failOnLevel] ?? 0;
  const actualRank = failRank[maxSeverity] ?? 0;

  if (actualRank >= failThreshold && failThreshold > 0) {
    process.exit(2);
  }

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
