import { describe, expect, test } from "vitest";
import { extractEmails, extractPhones, extractDigitStrings } from "../src/extract/regex.js";

describe("Email Extraction", () => {
  test("should extract simple personal emails", () => {
    const text = "Contact john@example.com for help";
    const matches = extractEmails(text);
    expect(matches).toHaveLength(1);
    expect(matches[0].text).toBe("john@example.com");
  });

  test("should extract generic mailboxes", () => {
    // These should still be extracted but marked as non-PII in locate.ts
    const generics = [
      "noreply@example.com",
      "no-reply@example.com",
      "do-not-reply@example.com",
      "info@example.com",
      "support@example.com",
      "contact@example.com",
      "sales@example.com",
      "admin@example.com",
      "postmaster@example.com",
      "mailer-daemon@example.com",
      "notifications@example.com",
    ];
    for (const email of generics) {
      const text = `Email: ${email}`;
      const matches = extractEmails(text);
      expect(matches.length).toBeGreaterThan(0);
      expect(matches[0].text).toBe(email);
    }
  });

  test("should not match email in URL with path/query", () => {
    const text = "Visit https://service.com/invite?email=sarah.lee@domain.org to register";
    const matches = extractEmails(text);
    // Should match sarah.lee@domain.org, not the URL with slashes and equals
    const emailMatches = matches.filter(
      (m) =>
        !m.text.includes("//") &&
        !m.text.includes("?") &&
        !m.text.includes("=") &&
        !m.text.includes(">"),
    );
    expect(emailMatches.some((m) => m.text === "sarah.lee@domain.org")).toBe(true);
  });

  test("should handle email with plus addressing", () => {
    const text = "Send to alice+work@company.io";
    const matches = extractEmails(text);
    expect(matches.some((m) => m.text === "alice+work@company.io")).toBe(true);
  });

  test("should handle uppercase emails", () => {
    const text = "His email is JOHN.SMITH@CORP.CO.UK";
    const matches = extractEmails(text);
    expect(matches.some((m) => m.text === "JOHN.SMITH@CORP.CO.UK")).toBe(true);
  });

  test("should handle emails in angle brackets", () => {
    const text = "Contact support at <support@company.com>";
    const matches = extractEmails(text);
    expect(matches.some((m) => m.text === "support@company.com")).toBe(true);
  });
});

describe("Phone Extraction", () => {
  test("should extract Japanese mobile phones", () => {
    const text = "090-1234-5678に電話ください";
    const matches = extractPhones(text);
    expect(matches.length).toBeGreaterThan(0);
    expect(matches[0].text).toBe("090-1234-5678");
  });

  test("should extract Japanese landline with hyphens", () => {
    const text = "電話: 03-1234-5678";
    const matches = extractPhones(text);
    expect(matches.length).toBeGreaterThan(0);
    expect(matches[0].text).toBe("03-1234-5678");
  });

  test("should extract Japanese landline with spaces", () => {
    const text = "Phone: 03 3456 7890";
    const matches = extractPhones(text);
    expect(matches.length).toBeGreaterThan(0);
    expect(matches[0].text).toBe("03 3456 7890");
  });

  test("should extract Japanese with parentheses", () => {
    const text = "電話番号は(03)1234-5678です";
    const matches = extractPhones(text);
    expect(matches.length).toBeGreaterThan(0);
    expect(matches[0].text).toBe("(03)1234-5678");
  });

  test("should extract Japanese international format", () => {
    const text = "International: +81-90-1234-5678";
    const matches = extractPhones(text);
    expect(matches.length).toBeGreaterThan(0);
    expect(matches[0].text).toBe("+81-90-1234-5678");
  });

  test("should extract 0120 toll-free (pii:false in locate)", () => {
    const text = "フリーダイアル: 0120-123-456";
    const matches = extractPhones(text);
    expect(matches.length).toBeGreaterThan(0);
    expect(matches[0].text).toBe("0120-123-456");
  });

  test("should extract US phone format", () => {
    const text = "Call me at (415) 555-1234";
    const matches = extractPhones(text);
    expect(matches.length).toBeGreaterThan(0);
    expect(matches[0].text).toBe("(415) 555-1234");
  });

  test("should extract UK phone format", () => {
    const text = "UK number: +44 20 7946 0958";
    const matches = extractPhones(text);
    expect(matches.length).toBeGreaterThan(0);
    expect(matches[0].text).toBe("+44 20 7946 0958");
  });

  test("should not match ISO dates as phones", () => {
    const text = "Meeting on 2024-12-15";
    const matches = extractPhones(text);
    expect(matches).toHaveLength(0);
  });

  test("should accept 050 format as IP phone numbers", () => {
    const text = "050から始まる番号は05055556666です";
    const matches = extractPhones(text);
    expect(matches.filter((m) => m.text.startsWith("050"))).toHaveLength(1);
  });
});

describe("Digit String Extraction", () => {
  test("should extract 10-16 digit numbers", () => {
    const text = "Card: 4532123456789012";
    const matches = extractDigitStrings(text);
    expect(matches.length).toBeGreaterThan(0);
    expect(matches[0].text).toBe("4532123456789012");
  });

  test("should handle digits with hyphens", () => {
    const text = "Card: 4532-1234-5678-9012";
    const matches = extractDigitStrings(text);
    expect(matches.length).toBeGreaterThan(0);
  });

  test("should not match ISO dates", () => {
    const text = "Meeting on 2024-12-15";
    const matches = extractDigitStrings(text);
    const dateMatches = matches.filter((m) => /\d{4}-\d{2}-\d{2}/.test(m.text));
    expect(dateMatches).toHaveLength(0);
  });

  test("should not match timestamps", () => {
    const text = "[2026-09-20 14:30] Message";
    const matches = extractDigitStrings(text);
    const timestampMatches = matches.filter(
      (m) => /\d{4}-\d{2}-\d{2}/.test(m.text) || /\d{2}:\d{2}/.test(m.text),
    );
    expect(timestampMatches).toHaveLength(0);
  });

  test("should reject ISBN format", () => {
    const text = "ISBN 978-3-16-148410-0";
    const matches = extractDigitStrings(text);
    const isbnMatches = matches.filter((m) => /^97[89]/.test(m.text));
    expect(isbnMatches).toHaveLength(0);
  });

  test("should reject with Order/No. label", () => {
    const text = "Order No. 123456789";
    const matches = extractDigitStrings(text);
    expect(matches.length).toBe(0);
  });
});
