import { describe, expect, test } from "vitest";
import { maskValue } from "../src/mask";

describe("Value masking", () => {
  test("masks short strings", () => {
    expect(maskValue("a")).toBe("…");
    expect(maskValue("ab")).toBe("…");
    expect(maskValue("abc")).toBe("…");
  });

  test("masks email", () => {
    const masked = maskValue("john.doe@example.com");
    expect(masked).toBe("jo…m");
  });

  test("masks phone number", () => {
    const masked = maskValue("090-1234-5678");
    expect(masked).toBe("09…8");
  });

  test("masks credit card", () => {
    const masked = maskValue("4111111111111111");
    expect(masked).toBe("41…1");
  });

  test("masks name", () => {
    const masked = maskValue("佐藤健一郎");
    expect(masked).toBe("佐藤…郎");
  });
});
