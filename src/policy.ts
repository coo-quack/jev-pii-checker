/**
 * Sensitivity policy applied on top of the model's rubric answer.
 *
 * The model reads the text literally and is calibrated, but two things are
 * decided by code because they are policy, not judgment:
 *
 * - Escalation: a named person together with a special category (health,
 *   biometric, government ID, financial account, race or religion) is "high",
 *   as is a personal government or financial number. Japanese law treats
 *   these as 要配慮個人情報 even where IBM's table lists them as low.
 * - Floor: "low" needs evidence. When no category reaches the threshold and
 *   no finding is personal, the document is "none" (a lone toll-free number,
 *   an unlabelled digit string, a code snippet).
 */

import type { SensitivityLevel } from "./gate.js";

interface PolicyFinding {
  type: string;
  pii: boolean;
  detail?: { number_type?: string } | Record<string, unknown>;
}

export interface PolicyInput {
  level: SensitivityLevel;
  categories: Record<string, number>;
  findings: PolicyFinding[];
  threshold: number;
  /** false when spans were skipped (--no-spans): findings carry no evidence then. */
  spansComputed: boolean;
}

export interface PolicyResult {
  level: SensitivityLevel;
  modelLevel: SensitivityLevel;
  reasons: string[];
}

const SPECIAL_CATEGORIES = [
  "health_info",
  "biometric",
  "government_id",
  "financial_account",
  "race_or_religion",
];

const SPECIAL_NUMBER_TYPES = new Set([
  "my_number",
  "credit_card",
  "bank_account",
  "driver_licence_or_passport",
]);

export function applySensitivityPolicy(input: PolicyInput): PolicyResult {
  const { level: modelLevel, categories, findings, threshold, spansComputed } = input;
  const reasons: string[] = [];
  let level = modelLevel;

  const at = (name: string) => (categories[name] ?? 0) >= threshold;
  const personNamed = at("person_name");
  const specialHit = SPECIAL_CATEGORIES.filter(at);
  const specialNumber = findings.find(
    (f) =>
      f.type === "number" &&
      f.pii &&
      SPECIAL_NUMBER_TYPES.has(
        String((f.detail as { number_type?: string } | undefined)?.number_type),
      ),
  );

  if (level !== "high" && personNamed && specialHit.length > 0) {
    level = "high";
    reasons.push(`escalated: person_name with ${specialHit.join(", ")}`);
  }
  if (level !== "high" && specialNumber) {
    level = "high";
    reasons.push(
      `escalated: personal ${String((specialNumber.detail as { number_type?: string }).number_type)}`,
    );
  }

  if (level === "low") {
    const anyCategory = Object.entries(categories).some(([, p]) => p >= threshold);
    const anyPersonalFinding = spansComputed && findings.some((f) => f.pii);
    if (!anyCategory && !anyPersonalFinding) {
      level = "none";
      reasons.push("floored: no category at threshold and no personal finding");
    }
  }

  return { level, modelLevel, reasons };
}
