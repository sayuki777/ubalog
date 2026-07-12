import Tesseract from "tesseract.js";
import {
  fileToDataUrl,
  preprocessRocketNowImage,
} from "@/lib/imagePreprocess";
import type { RocketNowScanResult } from "@/lib/rocketNowScan";

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

function normalizeText(text: string) {
  return text
    .replace(/[０-９]/g, (char) =>
      String.fromCharCode(char.charCodeAt(0) - 0xfee0)
    )
    .replace(/[，、]/g, ",")
    .replace(/[．。]/g, ".")
    .replace(/[¥￥]/g, "￥");
}

function parseNumber(text: string) {
  const normalized = normalizeText(text).replace(/,/g, "");
  const match = normalized.match(/\d+(?:\.\d+)?/);
  if (!match) return undefined;
  const value = Number(match[0]);
  return Number.isFinite(value) ? value : undefined;
}

function extractAmount(text: string) {
  const normalized = normalizeText(text);
  const candidates = Array.from(
    normalized.matchAll(/(?:￥\s*)?(\d{1,3}(?:,\d{3})+|\d{3,5})\s*円/g)
  )
    .map((match) => Number(match[1].replace(/,/g, "")))
    .filter((value) => Number.isFinite(value) && value > 500);

  if (candidates.length === 0) return undefined;
  return Math.max(...candidates);
}

function extractDistance(text: string) {
  const normalized = normalizeText(text);
  const deliveryDistance = normalized.match(
    /配達距離\s*(\d+(?:\.\d+)?)\s*km/i
  );
  if (deliveryDistance) return parseNumber(deliveryDistance[1]);

  const anyDistance = normalized.match(/(\d+(?:\.\d+)?)\s*km/i);
  return anyDistance ? parseNumber(anyDistance[1]) : undefined;
}

export function parseRocketNowOcrText(
  rawText: string,
  priorityText = rawText
): RocketNowOcrResult {
  const amount = extractAmount(priorityText) ?? extractAmount(rawText);
  const distanceKm = extractDistance(priorityText) ?? extractDistance(rawText);
  const confidence = amount && distanceKm ? 0.75 : 0.5;

  return {
    service: "ロケナウ",
    amount,
    distanceKm,
    shopName: "",
    dropoffArea: "",
    offerTags: undefined,
    orderCount: undefined,
    missionCount: undefined,
    missionBonusAmount: undefined,
    includesBonus: undefined,
    confidence,
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

  onProgress?.({ message: "画像を調整中..." });
  const preprocessed = await preprocessRocketNowImage(file);

  onProgress?.({ message: "文字を読み取り中...", progress: 0 });
  const croppedText = await recognizeText(preprocessed.dataUrl, (progress) => {
    onProgress?.({ message: "文字を読み取り中...", progress });
  });

  let fullText = "";
  try {
    const originalDataUrl = await fileToDataUrl(file);
    fullText = await recognizeText(originalDataUrl);
  } catch {
    fullText = "";
  }

  onProgress?.({ message: "結果を整理中..." });
  const combinedText = [croppedText, fullText].filter(Boolean).join("\n");
  const result = parseRocketNowOcrText(combinedText, croppedText || combinedText);

  if (!result.amount && !result.distanceKm) {
    throw new Error("読み取れませんでした。手入力してください");
  }

  return result;
}
