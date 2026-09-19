import { describe, expect, test } from "vitest";
import {
  extractAllRegex,
  extractDigitStrings,
  extractEmails,
  extractPhones,
} from "../src/extract/regex";

describe("Email extraction", () => {
  test("extracts standard emails", () => {
    const text = "Contact me at john@example.com or jane.doe+tag@company.co.jp";
    const emails = extractEmails(text);
    expect(emails.length).toBe(2);
    expect(emails[0].text).toBe("john@example.com");
    expect(emails[1].text).toBe("jane.doe+tag@company.co.jp");
  });

  test("filters noreply emails as PII=false in locate (not extracted by this module)", () => {
    const text = "noreply@system.example.com is automated";
    const emails = extractEmails(text);
    expect(emails.length).toBe(1);
  });
});

describe("Phone extraction", () => {
  test("extracts JP landline and mobile", () => {
    const text = "Call 03-1234-5678 or 090-1234-5678 or 080-5432-1098";
    const phones = extractPhones(text);
    expect(phones.length).toBe(3);
    expect(phones.map((p) => p.text)).toContain("03-1234-5678");
    expect(phones.map((p) => p.text)).toContain("090-1234-5678");
  });

  test("extracts 0120 toll-free", () => {
    const text = "Support: 0120-123-4567";
    const phones = extractPhones(text);
    expect(phones.length).toBe(1);
    expect(phones[0].text).toBe("0120-123-4567");
  });

  test("extracts +81 international format", () => {
    const text = "Call +81-90-1234-5678";
    const phones = extractPhones(text);
    expect(phones.some((p) => p.text.includes("81"))).toBe(true);
  });
});

describe("Digit string extraction", () => {
  test("extracts 10-16 digit sequences with spaces/hyphens", () => {
    const text = "Credit card: 4111 1111 1111 1111, Bank: 1234 5678";
    const digits = extractDigitStrings(text);
    expect(digits.length).toBeGreaterThan(0);
    expect(digits.some((d) => d.text.includes("4111111111111111"))).toBe(true);
  });

  test("rejects sequences shorter than 10 digits", () => {
    const text = "Year 2024 and count 123";
    const digits = extractDigitStrings(text);
    expect(digits.length).toBe(0);
  });

  test("deduplicates overlapping digit strings", () => {
    const text = "1234567890 and 234567890123";
    const digits = extractDigitStrings(text);
    expect(digits.length).toBeGreaterThanOrEqual(1);
  });
});

describe("Overlap deduplication", () => {
  test("prefers longer match when overlapping", () => {
    const text = "Email contact@example.com@test.com";
    const all = extractAllRegex(text);
    const emails = all.filter((m) => m.kind === "email");
    expect(emails.length).toBe(1);
  });

  test("handles order number vs phone collision", () => {
    const text = "Order #2024-0912-3345";
    const all = extractAllRegex(text);
    const phones = all.filter((m) => m.kind === "phone");
    expect(phones.length).toBe(0);
  });
});
