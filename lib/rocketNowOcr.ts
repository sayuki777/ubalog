import Tesseract from "tesseract.js";
import { preprocessRocketNowImageVariants } from "@/lib/imagePreprocess";
import type { RocketNowScanResult } from "@/lib/rocketNowScan";

const ROCKETNOW_SERVICE = "\u30ed\u30b1\u30ca\u30a6";
const READING_MESSAGE = "\u8aad\u307f\u53d6\u308a\u4e2d...";
const FAILED_MESSAGE = "\u8aad\u307f\u53d6\u308c\u307e\u305b\u3093\u3067\u3057\u305f\u3002\u624b\u5165\u529b\u3057\u3066\u304f\u3060\u3055\u3044";

export type RocketNowOcrProgress = {
  message: string;
  progress?: number;
};

export type RocketNowOcrResult = RocketNowScanResult & {
  rawText: string;
};

type AnalyzeOptions = {
  onProgress?: (progress: RocketNowOcrProgress) => void;
};

type AmountCandidate = {
  value: number;
  score: number;
};

type DistanceCandidate = {
  value: number;
  score: number;
};

type ParsedValues = {
  amount?: number;
  amountScore: number;
  distanceKm?: number;
  distanceScore: number;
};

type OcrAttempt = ParsedValues & {
  label: string;
  rawText: string;
};

function normalizeText(text: string) {
  return text
    .normalize("NFKC")
    .replace(/[\u00a5\uffe5]/g, "YEN")
    .replace(/[\uff0c\u3001]/g, ",")
    .replace(/[\uff0e\u3002]/g, ".")
    .replace(/[lI|](?=\.\d)/g, "1")
    .replace(/[Oo](?=\.\d)/g, "0")
    .replace(/[\uff4b\uff2b][\uff4d\uff2d]/g, "km")
    .replace(/[?K][?M]/g, "km");
}

function numberFromText(value: string) {
  const parsed = Number(value.replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : undefined;
}

function isLikelyMissionContext(context: string) {
  return /\u30df\u30c3\u30b7\u30e7\u30f3|\u30dc\u30fc\u30ca\u30b9|bonus|mission/i.test(context);
}

function extractAmountWithScore(text: string): AmountCandidate | undefined {
  const normalized = normalizeText(text);
  const candidates: AmountCandidate[] = [];
  const amountPattern = /(?:YEN\s*)?(\d{1,3}(?:,\d{3})+|\d{3,5})\s*(?:\u5186)?/g;

  for (const match of normalized.matchAll(amountPattern)) {
    const raw = match[1];
    const value = numberFromText(raw);
    if (typeof value !== "number") continue;
    if (value < 100 || value > 20000) continue;

    const start = match.index ?? 0;
    const end = start + match[0].length;
    const before = normalized.slice(Math.max(0, start - 12), start);
    const after = normalized.slice(end, Math.min(normalized.length, end + 12));
    const context = `${before}${match[0]}${after}`;

    if (/\.\d/.test(raw) || /km/i.test(context)) continue;
    if (value < 500 && isLikelyMissionContext(context)) continue;

    let score = 0;
    if (/YEN|\u5186/.test(context)) score += 5;
    if (raw.includes(",")) score += 3;
    if (value >= 500 && value <= 5000) score += 2;
    if (/\u5831\u916c|\u5408\u8a08|\u914d\u9054\u6599|\u898b\u7a4d/i.test(context)) score += 2;
    if (isLikelyMissionContext(context)) score -= 4;
    score += Math.min(3, value / 2500);

    candidates.push({ value, score });
  }

  return candidates.sort((a, b) => b.score - a.score || b.value - a.value)[0];
}

function normalizeDistanceNumber(raw: string) {
  const value = Number(normalizeText(raw).replace(/,/g, "."));
  return Number.isFinite(value) ? value : undefined;
}

function extractDistanceWithScore(text: string): DistanceCandidate | undefined {
  const normalized = normalizeText(text);
  const candidates: DistanceCandidate[] = [];
  const kmPattern = /([0-9lIoO|]{1,2}(?:[\.,][0-9])?)\s*(?:km|\u30ad\u30ed)/gi;

  for (const match of normalized.matchAll(kmPattern)) {
    const value = normalizeDistanceNumber(match[1]);
    if (typeof value !== "number") continue;
    if (value < 0.1 || value > 30) continue;

    const start = match.index ?? 0;
    const before = normalized.slice(Math.max(0, start - 12), start);
    const context = `${before}${match[0]}`;
    let score = 5;

    if (/[\.,]/.test(match[1])) score += 3;
    if (value >= 0.5 && value <= 10) score += 2;
    if (/\u8ddd\u96e2|\u4e88\u5b9a|\u914d\u9054/i.test(context)) score += 2;

    candidates.push({ value, score });
  }

  const looseDecimalPattern = /(^|[^\d,])([0-9lIoO|]{1,2}[\.,][0-9])([^\d]|$)/g;
  for (const match of normalized.matchAll(looseDecimalPattern)) {
    const value = normalizeDistanceNumber(match[2]);
    if (typeof value !== "number") continue;
    if (value < 0.1 || value > 30) continue;

    const start = match.index ?? 0;
    const context = normalized.slice(Math.max(0, start - 10), start + match[0].length + 10);
    if (/YEN|\u5186/.test(context)) continue;

    let score = 1;
    if (value >= 0.5 && value <= 10) score += 2;
    if (/\u8ddd\u96e2|km|\u30ad\u30ed/i.test(context)) score += 3;
    candidates.push({ value, score });
  }

  return candidates.sort((a, b) => b.score - a.score)[0];
}

function parseValues(text: string): ParsedValues {
  const amount = extractAmountWithScore(text);
  const distance = extractDistanceWithScore(text);

  return {
    amount: amount?.value,
    amountScore: amount?.score ?? 0,
    distanceKm: distance?.value,
    distanceScore: distance?.score ?? 0,
  };
}

function chooseBestAttempt(attempts: OcrAttempt[]) {
  return attempts.sort((a, b) => {
    const aComplete = a.amount && a.distanceKm ? 100 : 0;
    const bComplete = b.amount && b.distanceKm ? 100 : 0;
    return (
      bComplete + b.amountScore + b.distanceScore -
      (aComplete + a.amountScore + a.distanceScore)
    );
  })[0];
}

export function parseRocketNowOcrText(rawText: string): RocketNowOcrResult {
  const parsed = parseValues(rawText);

  return {
    service: ROCKETNOW_SERVICE,
    amount: parsed.amount,
    distanceKm: parsed.distanceKm,
    confidence: Math.min(0.95, (parsed.amountScore + parsed.distanceScore) / 18),
    rawText,
  };
}

async function recognizeText(
  image: string | Blob,
  onProgress?: (progress: number) => void
) {
  const result = await Tesseract.recognize(image, "jpn+eng", {
    logger: (message) => {
      if (message.status === "recognizing text") {
        onProgress?.(Math.round(message.progress * 100));
      }
    },
  });

  return result.data.text;
}

export async function analyzeRocketNowOfferImageWithOcr(
  file: File,
  options: AnalyzeOptions = {}
): Promise<RocketNowOcrResult> {
  const { onProgress } = options;

  onProgress?.({ message: READING_MESSAGE });
  const variants = await preprocessRocketNowImageVariants(file);
  const attempts: OcrAttempt[] = [];

  for (let index = 0; index < variants.length; index += 1) {
    const variant = variants[index];
    onProgress?.({ message: READING_MESSAGE, progress: 0 });

    const rawText = await recognizeText(variant.dataUrl, (progress) => {
      const base = Math.round((index / variants.length) * 100);
      const span = Math.round(progress / variants.length);
      onProgress?.({ message: READING_MESSAGE, progress: Math.min(99, base + span) });
    });
    const parsed = parseValues(rawText);
    attempts.push({ ...parsed, label: variant.label, rawText });

    if (parsed.amount && parsed.distanceKm) break;
  }

  const best = chooseBestAttempt(attempts);
  if (!best || (!best.amount && !best.distanceKm)) {
    throw new Error(FAILED_MESSAGE);
  }

  onProgress?.({ message: READING_MESSAGE, progress: 100 });

  return {
    service: ROCKETNOW_SERVICE,
    amount: best.amount,
    distanceKm: best.distanceKm,
    confidence: Math.min(0.95, (best.amountScore + best.distanceScore) / 18),
    rawText: attempts.map((attempt) => attempt.rawText).filter(Boolean).join("\n"),
  };
}
