import { describe, expect, test } from "vitest";
import type { Judge, JudgeResponse } from "../src/judge";
import { locatePII } from "../src/locate";
import { generateNameCandidates } from "../src/extract/names";

/**
 * FakeJudge for testing: returns preset probabilities for specific inputs.
 */
class FakeJudge implements Judge {
  private responses: Map<string, Record<string, number>> = new Map();

  setResponse(key: string, probabilities: Record<string, number>) {
    this.responses.set(key, probabilities);
  }

  async systemOne(
    _state: { text: string },
    questions: Record<string, { instructions: string }>,
  ): Promise<JudgeResponse> {
    const keys = Object.keys(questions);
    const answers: Record<string, any> = {};

    for (const key of keys) {
      const preset = this.responses.get(key);
      if (preset) {
        const maxProb = Math.max(...Object.values(preset));
        // Find the choice with the max probability
        const choice =
          Object.entries(preset).find(([_choiceName, prob]) => prob === maxProb)?.[0] ?? "other";

        answers[key] = {
          noul: maxProb,
          probabilities: preset,
          choice,
        };
      } else {
        // Default: low probability, digit choice
        if (
          questions[key].instructions.includes("digit_type") ||
          questions[key].instructions.includes("what kind of number")
        ) {
          answers[key] = {
            noul: 0.5,
            probabilities: {
              my_number: 0.5,
              credit_card: 0.3,
              other: 0.2,
            },
            choice: "my_number",
          };
        } else if (questions[key].instructions.includes("is the string")) {
          answers[key] = {
            noul: 0.3,
          };
        } else {
          answers[key] = {
            noul: 0.5,
          };
        }
      }
    }

    return {
      answers,
      usage: { input_tokens: 100 },
    };
  }
}

describe("Locate defect fixes", () => {
  test("number value keeps original formatting with spaces", async () => {
    const judge = new FakeJudge();
    judge.setResponse("digit_type", {
      my_number: 0.85,
      credit_card: 0.1,
      other: 0.05,
    });

    const text = "番号 1234 5678 9012 です";
    const result = await locatePII(judge, text, 0.5, 0.5, 0.5, false);

    const numberFindings = result.findings.filter((f) => f.type === "number");
    expect(numberFindings.length).toBeGreaterThan(0);
    // Should preserve spaces: "1234 5678 9012"
    const finding = numberFindings[0];
    expect(finding.value).toBe("1234 5678 9012");
    expect(finding.probability).toBe(0.85);
  });

  test("number with hyphens keeps original formatting", async () => {
    const judge = new FakeJudge();
    judge.setResponse("digit_type", {
      credit_card: 0.95,
      other: 0.05,
    });

    const text = "Card: 4111-1111-1111-1111";
    const result = await locatePII(judge, text, 0.5, 0.5, 0.5, false);

    const numberFindings = result.findings.filter((f) => f.type === "number");
    expect(numberFindings.length).toBeGreaterThan(0);
    expect(numberFindings[0].value).toBe("4111-1111-1111-1111");
  });

  test("multi-word Latin names are generated as candidates", () => {
    const text = "Payment received from Emily Carter, card 4111.";

    const candidates = generateNameCandidates(text);
    const candTexts = candidates.map((c) => c.text);

    // Should have "Emily Carter" as a single candidate
    expect(candTexts).toContain("Emily Carter");
  });

  test("Latin name across punctuation is not merged", () => {
    const text = "Emily, Carter wrote a book";

    const candidates = generateNameCandidates(text);
    const candTexts = candidates.map((c) => c.text);

    // Emily, and Carter are separate due to comma
    expect(candTexts).not.toContain("Emily, Carter");
  });

  test("Japanese multi-word names still merge correctly", () => {
    const text = "田中美咲と会った";

    const candidates = generateNameCandidates(text);
    const candTexts = candidates.map((c) => c.text);

    // Should have multi-word Japanese names
    expect(candTexts.some((t) => t.includes("田中") || t.includes("美咲"))).toBe(true);
  });
});
