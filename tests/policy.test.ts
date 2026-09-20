import { describe, expect, it } from "vitest";
import { applySensitivityPolicy } from "../src/policy.js";

const base = { threshold: 0.5, spansComputed: true, findings: [] as never[] };

describe("applySensitivityPolicy", () => {
  it("escalates a named person plus a special category to high", () => {
    const r = applySensitivityPolicy({
      ...base,
      level: "low",
      categories: { person_name: 0.99, race_or_religion: 0.95 },
    });
    expect(r.level).toBe("high");
    expect(r.modelLevel).toBe("low");
    expect(r.reasons[0]).toContain("race_or_religion");
  });

  it("escalates a personal government or financial number to high", () => {
    const r = applySensitivityPolicy({
      ...base,
      level: "low",
      categories: { person_name: 0.9 },
      findings: [{ type: "number", pii: true, detail: { number_type: "credit_card" } }],
    });
    expect(r.level).toBe("high");
  });

  it("does not escalate a special category without a named person", () => {
    const r = applySensitivityPolicy({
      ...base,
      level: "low",
      categories: { health_info: 0.9 },
    });
    expect(r.level).toBe("low");
  });

  it("floors low to none when nothing supports it", () => {
    const r = applySensitivityPolicy({
      ...base,
      level: "low",
      categories: { email_or_phone: 0.36 },
      findings: [{ type: "phone", pii: false }],
    });
    expect(r.level).toBe("none");
    expect(r.reasons[0]).toContain("floored");
  });

  it("keeps low when a personal finding exists", () => {
    const r = applySensitivityPolicy({
      ...base,
      level: "low",
      categories: { email_or_phone: 0.4 },
      findings: [{ type: "phone", pii: true }],
    });
    expect(r.level).toBe("low");
  });

  it("keeps low on a gate-only category such as date_of_birth", () => {
    const r = applySensitivityPolicy({
      ...base,
      level: "low",
      categories: { date_of_birth: 0.8 },
    });
    expect(r.level).toBe("low");
  });

  it("does not floor on findings when spans were skipped", () => {
    const r = applySensitivityPolicy({
      ...base,
      spansComputed: false,
      level: "low",
      categories: { person_name: 0.7 },
    });
    expect(r.level).toBe("low");
  });

  it("leaves high and none untouched", () => {
    expect(applySensitivityPolicy({ ...base, level: "high", categories: {} }).level).toBe("high");
    expect(applySensitivityPolicy({ ...base, level: "none", categories: {} }).level).toBe("none");
  });
});
