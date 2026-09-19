/**
 * Locate PII by running regex extraction and name candidate judgment,
 * then assembling spans.
 */

import { attachTitleSuffix, generateNameCandidates } from "./extract/names.js";
import { extractAllRegex } from "./extract/regex.js";
import type { Judge } from "./judge.js";

export interface PIIFinding {
  type: "email" | "phone" | "number" | "person_name";
  value: string;
  start: number;
  end: number;
  probability: number;
  detail?: {
    number_type?: string;
    probabilities?: Record<string, number>;
  };
  pii: boolean;
}

export interface LocateResult {
  findings: PIIFinding[];
  personNameThreshold?: number;
  inputTokens: number;
}

export async function locatePII(
  judge: Judge,
  text: string,
  personNameGateProb: number,
  threshold: number,
  spanThreshold: number,
  skipSpans: boolean,
): Promise<LocateResult> {
  let inputTokens = 0;

  const regex = extractAllRegex(text);
  const findings: PIIFinding[] = [];

  const noreplyRegex = /^noreply[a-zA-Z0-9._]*@/i;

  for (const match of regex) {
    if (match.kind === "email") {
      const isNoreply = noreplyRegex.test(match.text);
      if (isNoreply) {
        findings.push({
          type: "email",
          value: match.text,
          start: match.start,
          end: match.end,
          probability: 0,
          pii: false,
        });
        continue;
      }

      const questions = {
        is_personal: {
          instructions:
            'Is the email address "' +
            match.text +
            '" the personal contact of an identifiable individual (vs system/no-reply/corporate general line)?',
        },
      };

      const response = await judge.systemOne({ text }, questions);
      const prob = (response.answers.is_personal as { noul?: number }).noul ?? 0;
      inputTokens += response.usage.input_tokens;

      if (prob >= threshold) {
        findings.push({
          type: "email",
          value: match.text,
          start: match.start,
          end: match.end,
          probability: prob,
          pii: true,
        });
      }
    } else if (match.kind === "phone") {
      const toll_free = /^0120-/.test(match.text);
      if (toll_free) {
        findings.push({
          type: "phone",
          value: match.text,
          start: match.start,
          end: match.end,
          probability: 0,
          pii: false,
        });
        continue;
      }

      const questions = {
        is_personal: {
          instructions:
            'Is the phone number "' +
            match.text +
            '" the personal contact of an identifiable individual (vs corporate hotline)?',
        },
      };

      const response = await judge.systemOne({ text }, questions);
      const prob = (response.answers.is_personal as { noul?: number }).noul ?? 0;
      inputTokens += response.usage.input_tokens;

      if (prob >= threshold) {
        findings.push({
          type: "phone",
          value: match.text,
          start: match.start,
          end: match.end,
          probability: prob,
          pii: true,
        });
      }
    } else if (match.kind === "number") {
      const digitChoiceQuestions = {
        digit_type: {
          instructions: `In \`text\`, what kind of number is 「${match.text}」?`,
          criteria: {
            my_number: "マイナンバー or Japanese My Number",
            credit_card: "Credit card number",
            bank_account: "Bank account number",
            phone: "Phone number (mobile or landline)",
            driver_licence_or_passport: "Driver's licence or passport number",
            order_or_tracking_number: "Order number or parcel tracking number",
            product_serial: "Product serial number or SKU",
            date: "Date or date-related number",
            other: "Other type of number",
          },
        },
      };

      const response = await judge.systemOne({ text }, digitChoiceQuestions);
      const digitAns = response.answers.digit_type as {
        choice?: string;
        probabilities?: Record<string, number>;
      };
      inputTokens += response.usage.input_tokens;

      const digitType = digitAns.choice ?? "other";
      const isPII =
        digitType !== "order_or_tracking_number" &&
        digitType !== "product_serial" &&
        digitType !== "date" &&
        digitType !== "other";

      const maxProb = Math.max(...Object.values(digitAns.probabilities ?? {}));

      findings.push({
        type: "number",
        value: text.slice(match.start, match.end),
        start: match.start,
        end: match.end,
        probability: maxProb,
        detail: {
          number_type: digitType,
          probabilities: digitAns.probabilities,
        },
        pii: isPII,
      });
    }
  }

  if (!skipSpans && personNameGateProb >= threshold) {
    const nameCandidates = generateNameCandidates(text, 200);

    if (nameCandidates.length > 0) {
      const titleAttached = attachTitleSuffix(nameCandidates, text);

      const nameQuestions: Record<string, { instructions: string }> = {};
      const candidateMap: Record<string, { text: string; start: number; end: number }> = {};

      for (let i = 0; i < titleAttached.length; i++) {
        const cand = titleAttached[i];
        const key = `name_${i}`;
        nameQuestions[key] = {
          instructions: `In \`text\`, is the string 「${cand.text}」 the full name, or part of the name, of a specific person?`,
        };
        candidateMap[key] = cand;
      }

      const nameResponse = await judge.systemOne({ text }, nameQuestions);
      inputTokens += nameResponse.usage.input_tokens;

      const passingCandidates: Array<{ text: string; start: number; end: number; prob: number }> =
        [];
      for (const key of Object.keys(candidateMap)) {
        const prob = (nameResponse.answers[key] as { noul?: number }).noul ?? 0;
        if (prob >= spanThreshold) {
          passingCandidates.push({
            ...candidateMap[key],
            prob,
          });
        }
      }

      const assembled = assembleSpans(passingCandidates);
      for (const span of assembled) {
        findings.push({
          type: "person_name",
          value: text.substring(span.start, span.end),
          start: span.start,
          end: span.end,
          probability: span.probability,
          pii: true,
        });
      }
    }
  }

  return { findings, inputTokens };
}

function assembleSpans(
  candidates: Array<{ text: string; start: number; end: number; prob: number }>,
): Array<{ start: number; end: number; probability: number }> {
  if (candidates.length === 0) return [];

  const sorted = [...candidates].sort((a, b) => {
    if (a.start !== b.start) return a.start - b.start;
    return b.end - b.start - (a.end - a.start);
  });

  const spans: Array<{ start: number; end: number; probability: number }> = [];
  let current: (typeof sorted)[0] | null = null;
  let currentMaxProb = 0;

  for (const cand of sorted) {
    if (!current) {
      current = cand;
      currentMaxProb = cand.prob;
    } else if (cand.start <= current.end) {
      if (cand.end > current.end) {
        current = cand;
        currentMaxProb = Math.max(currentMaxProb, cand.prob);
      } else {
        currentMaxProb = Math.max(currentMaxProb, cand.prob);
      }
    } else {
      spans.push({ start: current.start, end: current.end, probability: currentMaxProb });
      current = cand;
      currentMaxProb = cand.prob;
    }
  }

  if (current) {
    spans.push({ start: current.start, end: current.end, probability: currentMaxProb });
  }

  return spans;
}
