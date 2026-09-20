/**
 * Report results in JSON or human-readable format.
 */

export interface ReportFinding {
  type: string;
  value: string;
  start: number;
  end: number;
  probability: number;
  detail?: Record<string, unknown>;
}

export interface Report {
  source: string;
  sensitivity: {
    level: string;
    /** The model's own rubric answer before the code-side policy. */
    model_level: string;
    score: number;
    probabilities: Record<string, number>;
    /** Why the policy changed the level; empty when it did not. */
    reasons: string[];
  };
  categories: Record<string, number>;
  findings: ReportFinding[];
  chunks: number;
  usage: {
    input_tokens: number;
    requests: number;
  };
}

export function formatJSON(reports: Report[]): string {
  return JSON.stringify(reports, null, 2);
}

export function formatHuman(reports: Report[]): string {
  let output = "";

  for (const report of reports) {
    output += `\n=== ${report.source} ===\n`;
    const policyNote =
      report.sensitivity.reasons.length > 0
        ? ` (model: ${report.sensitivity.model_level}; ${report.sensitivity.reasons.join("; ")})`
        : "";
    output += `Sensitivity: ${report.sensitivity.level.toUpperCase()}${policyNote}\n`;
    output += `Categories: ${
      Object.entries(report.categories)
        .filter(([, v]) => v > 0.5)
        .map(([k]) => k)
        .join(", ") || "none"
    }\n`;
    output += `Findings: ${report.findings.filter((f) => f.type !== "number" || (f as any).pii).length}\n`;
    output += `Tokens: ${report.usage.input_tokens}\n`;

    if (report.findings.length > 0) {
      output += "\nDetected:\n";
      const grouped = new Map<string, ReportFinding[]>();
      for (const f of report.findings) {
        if (!grouped.has(f.type)) {
          grouped.set(f.type, []);
        }
        grouped.get(f.type)?.push(f);
      }

      for (const [type, items] of grouped.entries()) {
        output += `  ${type}:\n`;
        for (const item of items) {
          output += `    • ${item.value} (${item.start}:${item.end})\n`;
        }
      }
    }
  }

  return output;
}
