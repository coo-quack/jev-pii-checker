/**
 * Gate: run 12 PII category Nouls + sensitivity Score over a chunk of text.
 */

import type { Judge } from "./judge.js";

export type Category =
  | "person_name"
  | "email_or_phone"
  | "postal_address"
  | "date_of_birth"
  | "government_id"
  | "financial_account"
  | "health_info"
  | "biometric"
  | "ip_address_of_a_person"
  | "sns_handle"
  | "employment_info"
  | "race_or_religion";

export type SensitivityLevel = "none" | "low" | "high";

export interface GateResult {
  categories: Record<Category, number>;
  sensitivity: {
    level: SensitivityLevel;
    score: number;
    probabilities: Record<string, number>;
  };
  inputTokens: number;
}

export async function runGate(judge: Judge, text: string): Promise<GateResult> {
  const questions: Record<string, any> = {
    person_name: {
      instructions: "Does the text mention the name of a specific individual person?",
    },
    email_or_phone: {
      instructions: "Does the text contain an email address or phone number of a specific person?",
    },
    postal_address: {
      instructions: "Does the text contain a postal address associated with a specific person?",
    },
    date_of_birth: {
      instructions: "Does the text contain the date of birth of a specific person?",
    },
    government_id: {
      instructions:
        "Does the text contain a government-issued identifier of a person (e.g., マイナンバー, passport number, driver's licence number)?",
    },
    financial_account: {
      instructions:
        "Does the text contain a credit card number or bank account number of a person?",
    },
    health_info: {
      instructions:
        "Does the text contain medical information, diagnosis, or treatment details of an identifiable person?",
    },
    biometric: {
      instructions:
        "Does the text contain biometric data (fingerprint, facial recognition, iris scan) of a specific person?",
    },
    ip_address_of_a_person: {
      instructions:
        "Does the text contain the IP address of a specific person's device or network?",
    },
    sns_handle: {
      instructions: "Does the text contain a social media handle or username of a specific person?",
    },
    employment_info: {
      instructions:
        "Does the text contain employment information (workplace, job title, role) of a specific person?",
    },
    race_or_religion: {
      instructions:
        "Does the text contain information about the race, ethnicity, or religious beliefs of a specific person?",
    },
    sensitivity: {
      instructions:
        "If this text leaked, how sensitive is the personal information contained in it?",
      criteria: [
        "none: No information about an identifiable individual",
        "low: Identifies or gives contact/basic details of a person (name, phone, email, address, birthday, job) but a leak would cause little direct harm",
        "high: Contains a government ID number, financial account, health or biometric information of a person, or a list that reveals a sensitive fact about named people",
      ],
    },
  };

  const response = await judge.systemOne({ text }, questions);

  const categories: Record<Category, number> = {
    person_name: 0,
    email_or_phone: 0,
    postal_address: 0,
    date_of_birth: 0,
    government_id: 0,
    financial_account: 0,
    health_info: 0,
    biometric: 0,
    ip_address_of_a_person: 0,
    sns_handle: 0,
    employment_info: 0,
    race_or_religion: 0,
  };

  const categoryKeys: Category[] = [
    "person_name",
    "email_or_phone",
    "postal_address",
    "date_of_birth",
    "government_id",
    "financial_account",
    "health_info",
    "biometric",
    "ip_address_of_a_person",
    "sns_handle",
    "employment_info",
    "race_or_religion",
  ];

  for (const key of categoryKeys) {
    const ans = response.answers[key];
    if (ans && "noul" in ans) {
      categories[key] = (ans as { noul: number }).noul;
    }
  }

  const sensAns = response.answers.sensitivity;
  let level: SensitivityLevel = "none";
  let score = 0;
  let probabilities: Record<string, number> = {};

  if (sensAns && "score" in sensAns) {
    const s = sensAns as {
      score: number;
      probabilities?: Record<string, number>;
    };
    score = s.score;
    probabilities = s.probabilities ?? {};

    const levelIndex = Math.round(score);
    const levels: SensitivityLevel[] = ["none", "low", "high"];
    level = levels[Math.min(levelIndex, 2)];
  }

  return {
    categories,
    sensitivity: {
      level,
      score,
      probabilities,
    },
    inputTokens: response.usage.input_tokens,
  };
}
