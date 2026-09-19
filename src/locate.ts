/**
 * Locate PII by running regex extraction and name candidate judgment,
 * then assembling spans.
 */

import { generateNameCandidatesWithTitles } from "./extract/names.js";
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
    honorific?: string;
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

  const genericMailboxRegex =
    /^(?:noreply|no-reply|do-not-reply|info|support|contact|sales|admin|postmaster|mailer-daemon|notifications)[a-zA-Z0-9._-]*@/i;
  const tollFreeRegex = /^(?:0120|0800|1-800|0570)[- ]?/;

  for (const match of regex) {
    if (match.kind === "email") {
      const isGenericMailbox = genericMailboxRegex.test(match.text);
      if (isGenericMailbox) {
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

      findings.push({
        type: "email",
        value: match.text,
        start: match.start,
        end: match.end,
        probability: prob,
        pii: prob >= 0.2,
      });
    } else if (match.kind === "phone") {
      const isTollFree = tollFreeRegex.test(match.text);
      if (isTollFree) {
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

      // Check if it's a pure-digit phone (no separators)
      const isPureDigitPhone = /^\d{10,}$/.test(match.text);
      if (isPureDigitPhone) {
        // Run choice on pure-digit numbers to disambiguate
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
        if (digitType !== "phone") {
          // Emit as number finding instead
          const maxProb = Math.max(...Object.values(digitAns.probabilities ?? {}));
          findings.push({
            type: "number",
            value: match.text,
            start: match.start,
            end: match.end,
            probability: maxProb,
            detail: {
              number_type: digitType,
              probabilities: digitAns.probabilities,
            },
            pii:
              digitType !== "order_or_tracking_number" &&
              digitType !== "product_serial" &&
              digitType !== "date" &&
              digitType !== "other",
          });
          continue;
        }
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

      findings.push({
        type: "phone",
        value: match.text,
        start: match.start,
        end: match.end,
        probability: prob,
        pii: prob >= 0.2,
      });
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
    // 600, not 200: a 4000-character chunk of prose yields 500+ candidates, and
    // the names near its end were silently dropped at the old cap.
    const { candidates: nameCandidatesList, titleMap } = generateNameCandidatesWithTitles(
      text,
      600,
    );
    let nameCandidates = nameCandidatesList;

    // Filter out candidates that overlap with emails, URLs, or phones
    const emailPhoneSpans = regex.filter((m) => m.kind === "email" || m.kind === "phone");
    const urlRegex = /https?:\/\/\S+/g;
    let urlMatch: RegExpExecArray | null;
    const urlSpans: Array<{ start: number; end: number }> = [];
    while ((urlMatch = urlRegex.exec(text)) !== null) {
      urlSpans.push({ start: urlMatch.index, end: urlMatch.index + urlMatch[0].length });
    }

    nameCandidates = nameCandidates.filter((cand) => {
      // Check overlap with emails/phones
      for (const efSpan of emailPhoneSpans) {
        if (cand.start < efSpan.end && cand.end > efSpan.start) {
          return false; // Overlaps
        }
      }
      // Check overlap with URLs
      for (const uSpan of urlSpans) {
        if (cand.start < uSpan.end && cand.end > uSpan.start) {
          return false; // Overlaps
        }
      }
      return true;
    });

    if (nameCandidates.length > 0) {
      // Judge only bare candidates, not title-attached ones
      // Batch into chunks of at most 25 candidates per request (2 questions per candidate = 50 questions)
      const batchSize = 25;
      const passingCandidates: Array<{
        text: string;
        start: number;
        end: number;
        prob: number;
        scores?: { person: number; name: number };
      }> = [];

      for (let batchStart = 0; batchStart < nameCandidates.length; batchStart += batchSize) {
        const batchEnd = Math.min(batchStart + batchSize, nameCandidates.length);
        const batch = nameCandidates.slice(batchStart, batchEnd);

        const batchQuestions: Record<string, { instructions: string }> = {};
        const batchMap: Record<
          string,
          { text: string; start: number; end: number; isPersonQ?: boolean }
        > = {};

        for (let i = 0; i < batch.length; i++) {
          const cand = batch[i];
          const baseIdx = batchStart + i;

          // Person question: is this a person reference?
          const personKey = `name_person_${baseIdx}`;
          batchQuestions[personKey] = {
            instructions: `In \`text\`, does 「${cand.text}」 refer to a person (an individual human being, named by surname or full name), rather than a place, organization, product or common word?`,
          };
          batchMap[personKey] = { ...cand, isPersonQ: true };

          // Name question: is this the full or part of a name?
          const nameKey = `name_name_${baseIdx}`;
          batchQuestions[nameKey] = {
            instructions: `In \`text\`, is the string 「${cand.text}」 the full name, or part of the name, of a specific person?`,
          };
          batchMap[nameKey] = { ...cand, isPersonQ: false };
        }

        const batchResponse = await judge.systemOne({ text }, batchQuestions);
        inputTokens += batchResponse.usage.input_tokens;

        // Group results by candidate
        const candScores: Record<number, { person: number; name: number }> = {};
        for (const key of Object.keys(batchMap)) {
          const prob = (batchResponse.answers[key] as { noul?: number }).noul ?? 0;
          const isPersonQ = batchMap[key].isPersonQ;

          // Extract candidate index from key: name_person_0 or name_name_0
          const parts = key.split("_");
          const candIdx = parseInt(parts[parts.length - 1], 10);

          if (!candScores[candIdx]) {
            candScores[candIdx] = { person: 0, name: 0 };
          }

          if (isPersonQ) {
            candScores[candIdx].person = prob;
          } else {
            candScores[candIdx].name = prob;
          }
        }

        // Filter candidates: person >= spanThreshold AND name >= 0.4
        for (let i = 0; i < batch.length; i++) {
          const cand = batch[i];
          const baseIdx = batchStart + i;
          const scores = candScores[baseIdx];

          if (scores && scores.person >= spanThreshold && scores.name >= 0.4) {
            passingCandidates.push({
              ...cand,
              prob: scores.person,
              scores,
            });
          }
        }
      }

      const assembled = assembleSpans(passingCandidates, text);
      for (const span of assembled) {
        const spanText = text.substring(span.start, span.end);
        const detail: {
          honorific?: string;
          title?: string;
          scores?: { person: number; name: number };
        } = {};
        if (span.honorific) detail.honorific = span.honorific;
        if (span.scores) detail.scores = span.scores;
        // Add title if it was stripped during candidate generation
        if (titleMap.has(spanText)) {
          detail.title = titleMap.get(spanText);
        }

        findings.push({
          type: "person_name",
          value: spanText,
          start: span.start,
          end: span.end,
          probability: span.probability,
          detail: Object.keys(detail).length > 0 ? detail : undefined,
          pii: true,
        });
      }
    }
  }

  return { findings, inputTokens };
}

const HONORIFICS = [
  "さん",
  "様",
  "氏",
  "君",
  "殿",
  "先輩",
  "部長",
  "課長",
  "社長",
  "副社長",
  "医師",
  "先生",
  "教授",
  "Dr.",
  "Dr",
  "Mr.",
  "Ms.",
  "Mrs.",
];

function assembleSpans(
  candidates: Array<{
    text: string;
    start: number;
    end: number;
    prob: number;
    scores?: { person: number; name: number };
  }>,
  text: string,
): Array<{
  start: number;
  end: number;
  probability: number;
  honorific?: string;
  scores?: { person: number; name: number };
}> {
  if (candidates.length === 0) return [];

  const sorted = [...candidates].sort((a, b) => {
    if (a.start !== b.start) return a.start - b.start;
    return b.end - b.start - (a.end - a.start);
  });

  const spans: Array<{
    start: number;
    end: number;
    probability: number;
    honorific?: string;
    scores?: { person: number; name: number };
  }> = [];
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
      // Check for following honorific
      let honorific: string | undefined;
      for (const title of HONORIFICS) {
        if (text.substring(current.end, current.end + title.length) === title) {
          honorific = title;
          break;
        }
      }

      spans.push({
        start: current.start,
        end: current.end,
        probability: currentMaxProb,
        honorific,
        scores: current.scores,
      });
      current = cand;
      currentMaxProb = cand.prob;
    }
  }

  if (current) {
    let honorific: string | undefined;
    for (const title of HONORIFICS) {
      if (text.substring(current.end, current.end + title.length) === title) {
        honorific = title;
        break;
      }
    }

    spans.push({
      start: current.start,
      end: current.end,
      probability: currentMaxProb,
      honorific,
      scores: current.scores,
    });
  }

  return spans;
}
