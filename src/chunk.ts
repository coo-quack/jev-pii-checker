/**
 * Split text into chunks at paragraph/sentence boundaries.
 * Document-level: max probability per category, max sensitivity level.
 */

export interface Chunk {
  index: number;
  start: number;
  end: number;
  text: string;
}

export function splitIntoChunks(text: string, maxChars: number): Chunk[] {
  const chunks: Chunk[] = [];
  let pos = 0;
  let chunkIndex = 0;

  while (pos < text.length) {
    const end = Math.min(pos + maxChars, text.length);

    if (end === text.length) {
      chunks.push({
        index: chunkIndex,
        start: pos,
        end,
        text: text.substring(pos, end),
      });
      break;
    }

    let boundaryPos = end;

    const lastNewlineInChunk = text.lastIndexOf("\n", end);
    if (lastNewlineInChunk > pos) {
      boundaryPos = lastNewlineInChunk + 1;
    } else {
      const lastPeriodInChunk = text.lastIndexOf("。", end);
      if (lastPeriodInChunk > pos) {
        boundaryPos = lastPeriodInChunk + 1;
      } else {
        const lastSentenceEndInChunk = text.lastIndexOf("！", end);
        if (lastSentenceEndInChunk > pos) {
          boundaryPos = lastSentenceEndInChunk + 1;
        } else {
          const lastQuestionInChunk = text.lastIndexOf("？", end);
          if (lastQuestionInChunk > pos) {
            boundaryPos = lastQuestionInChunk + 1;
          } else {
            const lastEnglishPeriod = text.lastIndexOf(".", end);
            if (lastEnglishPeriod > pos) {
              boundaryPos = lastEnglishPeriod + 1;
            } else {
              boundaryPos = end;
            }
          }
        }
      }
    }

    chunks.push({
      index: chunkIndex,
      start: pos,
      end: boundaryPos,
      text: text.substring(pos, boundaryPos),
    });

    pos = boundaryPos;
    chunkIndex++;
  }

  return chunks;
}

export function aggregateCategoryProbabilities(
  chunkProbs: Array<Record<string, number>>,
): Record<string, number> {
  const result: Record<string, number> = {};

  for (const probs of chunkProbs) {
    for (const [category, prob] of Object.entries(probs)) {
      if (!result[category] || prob > result[category]) {
        result[category] = prob;
      }
    }
  }

  return result;
}

export function aggregateSensitivityLevel(levels: string[]): string {
  const levelRank: Record<string, number> = {
    none: 0,
    low: 1,
    high: 2,
  };

  let maxRank = 0;
  for (const level of levels) {
    const rank = levelRank[level] ?? 0;
    maxRank = Math.max(maxRank, rank);
  }

  const rankToLevel: Record<number, string> = {
    0: "none",
    1: "low",
    2: "high",
  };

  return rankToLevel[maxRank] ?? "none";
}
