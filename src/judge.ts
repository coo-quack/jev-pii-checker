import { choice, noul, score, TypeSafeClient } from "@typesafe-ai/sdk";

export interface JudgeResponse {
  answers: {
    [key: string]: {
      noul?: number;
      choice?: string;
      probabilities?: Record<string, number>;
      confidence?: number;
      score?: number;
    };
  };
  usage: {
    input_tokens: number;
  };
}

export interface Judge {
  systemOne(state: { text: string }, questions: Record<string, unknown>): Promise<JudgeResponse>;
}

export interface JevJudgeOpts {
  apiKey?: string;
  timeout?: number;
  retry?: number;
  defaultModel?: string;
}

export function createJevJudge(_opts?: JevJudgeOpts): Judge {
  const client = new TypeSafeClient();

  return {
    async systemOne(state, questions) {
      const questionsMap: Record<string, unknown> = {};

      for (const [key, q] of Object.entries(questions)) {
        if (q instanceof Object && "instructions" in q) {
          const qObj = q as {
            instructions: string;
            criteria?: unknown;
            type?: string;
          };
          if (qObj.type === "noul" || (!("criteria" in qObj) && !("type" in qObj))) {
            questionsMap[key] = noul(qObj.instructions);
          } else if (
            "criteria" in qObj &&
            typeof qObj.criteria === "object" &&
            !Array.isArray(qObj.criteria)
          ) {
            questionsMap[key] = choice(qObj.instructions, qObj.criteria as Record<string, string>);
          } else if ("criteria" in qObj && Array.isArray(qObj.criteria)) {
            questionsMap[key] = (score as any)(qObj.instructions, qObj.criteria as any);
          }
        }
      }

      const result = (await (client as any).systemOne({
        state: { text: state.text },
        questions: questionsMap,
      })) as any;

      const answers: Record<string, unknown> = {};
      for (const [key, val] of Object.entries((result as any).answers)) {
        const v = val as any;
        if ("noul" in v) {
          answers[key] = { noul: v.noul as number };
        } else if ("choice" in v) {
          answers[key] = {
            choice: v.choice,
            probabilities: v.probabilities,
            confidence: v.confidence,
          };
        } else if ("score" in v) {
          answers[key] = {
            score: v.score,
            probabilities: v.probabilities,
            confidence: v.confidence,
          };
        }
      }

      return {
        answers,
        usage: {
          input_tokens: result.usage.input_tokens,
        },
      };
    },
  };
}
