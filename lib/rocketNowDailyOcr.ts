import Tesseract from "tesseract.js";
import { preprocessRocketNowDailyImageVariants } from "@/lib/imagePreprocess";

const READ_ERROR_MESSAGE = "\u8aad\u307f\u53d6\u308c\u307e\u305b\u3093\u3067\u3057\u305f\u3002\u624b\u5165\u529b\u3057\u3066\u304f\u3060\u3055\u3044";

export type RocketNowDailyOcrResult = {
  amount: number | null;
  deliveries: number | null;
  baseAmount: number | null;
  adjustmentAmount: number;
  matchedDateLabel?: string;
};

export type RocketNowBulkDailyResult = {
  id: string;
  date: string;
  matchedDateLabel: string;
  baseAmount: number | null;
  adjustmentAmount: number;
  amount: number | null;
  deliveries: number | null;
  sourceFileName?: string;
  confidence?: number;
};

type ParsedLine = {
  index: number;
  text: string;
};

function normalizeText(text: string) {
  return text
    .normalize("NFKC")
    .replace(/[\u00a5\uffe5]/g, "YEN")
    .replace(/[\uff0c\u3001]/g, ",")
    .replace(/[\uff0e\u3002]/g, ".")
    .replace(/[\u30fb\u2022]/g, "/")
    .replace(/\s+/g, " ")
    .trim();
}

function targetMonthDay(targetDate: string) {
  const [, month, day] = targetDate.split("-").map(Number);
  return { month, day };
}

export function normalizeRocketNowDateLabel(value: string) {
  return normalizeText(value)
    .replace(/[\u706b\u6c34\u6728\u91d1\u571f\u65e5\u6708].*$/, "")
    .replace(/[^0-9\/\-.]/g, "")
    .trim();
}

function lineMatchesTargetDate(line: string, targetDate: string) {
  const { month, day } = targetMonthDay(targetDate);
  const normalized = normalizeText(line);
  const datePattern = /^[^\d]{0,6}(\d{1,2})\s*[\/\-.]\s*(\d{1,2})/;
  const match = normalized.match(datePattern);

  if (match && Number(match[1]) === month && Number(match[2]) === day) return match[0];

  return undefined;
}

function dateLabelFromLine(line: string) {
  const normalized = normalizeText(line);
  return normalized.match(/^[^\d]{0,6}(\d{1,2}\s*[\/\-.]\s*\d{1,2})/)?.[1];
}

function isoDateFromLabel(label: string, baseYear: number) {
  const match = normalizeText(label).match(/(\d{1,2})\s*[\/\-.]\s*(\d{1,2})/);
  if (!match) return null;

  const month = Number(match[1]);
  const day = Number(match[2]);
  if (!Number.isFinite(month) || !Number.isFinite(day)) return null;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  return `${baseYear}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function amountCandidates(text: string, minimumAmount = 100) {
  const normalized = normalizeText(text);
  const candidates: Array<{ value: number; index: number; score: number }> = [];
  const pattern = /(?:YEN\s*)?(\d{1,3}(?:,\d{3})+|\d{3,6})\s*(?:\u5186)?/g;

  for (const match of normalized.matchAll(pattern)) {
    const value = Number(match[1].replace(/,/g, ""));
    if (!Number.isFinite(value) || value < minimumAmount || value > 100000) continue;
    const index = match.index ?? 0;
    const context = normalized.slice(Math.max(0, index - 8), index + match[0].length + 8);
    let score = 0;
    if (/YEN|\u5186/.test(context)) score += 5;
    if (match[1].includes(",")) score += 3;
    if (/\u5831\u916c|\u58f2\u4e0a|\u53ce\u5165|\u5408\u8a08|\u30dc\u30fc\u30ca\u30b9/.test(context)) score += 2;
    score += Math.min(4, value / 10000);
    candidates.push({ value, index, score });
  }

  return candidates.sort((a, b) => b.score - a.score || a.index - b.index);
}

function extractAmountFromText(text: string, minimumAmount = 100) {
  return amountCandidates(text, minimumAmount)[0]?.value ?? null;
}

export function extractDeliveryCount(line: string) {
  const normalized = normalizeText(line);
  const preferred = normalized.match(/\u914d\u9054\s*([0-9OoIl|]{1,3})\s*\u4ef6/);
  const fallback = normalized.match(/([0-9OoIl|]{1,3})\s*\u4ef6/);
  const raw = preferred?.[1] ?? fallback?.[1];
  const value = Number(
    raw
      ?.replace(/[Oo]/g, "0")
      .replace(/[lI|]/g, "1")
  );
  if (!Number.isFinite(value) || value <= 0 || value > 300) return null;
  return value;
}

function extractLooseDeliveryCountFromDailyRow(line: string) {
  const withoutDate = normalizeText(line)
    .replace(/^[^\d]{0,6}\d{1,2}\s*[\/\-.]\s*\d{1,2}\s*[\u6708\u706b\u6c34\u6728\u91d1\u571f\u65e5]?/, " ")
    .replace(/(?:YEN\s*)?\d{1,3}(?:,\d{3})+\s*(?:\u5186)?/g, " ")
    .replace(/\d{3,6}\s*\u5186/g, " ");
  const match = withoutDate.match(/(?:\u914d\u9054\s*)?([0-9OoIl|]{1,3})\s*(?:\u4ef6)?/);
  const value = Number(
    match?.[1]
      ?.replace(/[Oo]/g, "0")
      .replace(/[lI|]/g, "1")
  );
  if (!Number.isFinite(value) || value <= 0 || value > 300) return null;
  return value;
}

function parseLines(text: string): ParsedLine[] {
  return text
    .split(/\r?\n/)
    .map((line, index) => ({ index, text: normalizeText(line) }))
    .filter((line) => line.text.length > 0);
}

function isDailyIncomeHeading(line: string) {
  return /\u65e5\u5225.*\u914d\u9054.*\u53ce\u5165|\u914d\u9054.*\u53ce\u5165/.test(line);
}

function isAdjustmentHeading(line: string) {
  return /\u30df\u30c3\u30b7\u30e7\u30f3.*\u30dc\u30fc\u30ca\u30b9|\u8abf\u6574.*\u5185\u8a33|\u8abf\u6574\u984d|mission.*bonus/i.test(line);
}

function section(lines: ParsedLine[], startIndex: number, endIndex: number) {
  return lines.filter((line) => line.index > startIndex && line.index < endIndex);
}

function dateLabelPattern(targetDate: string) {
  const { month, day } = targetMonthDay(targetDate);
  return `${month}\\s*[\\/\\-.]\\s*0?${day}|0?${month}\\s*[\\/\\-.]\\s*0?${day}`;
}

function extractInlineDailyRow(text: string, targetDate: string) {
  const normalized = normalizeText(text);
  const pattern = new RegExp(
    `(?:^|\\s)(${dateLabelPattern(targetDate)})\\s*[\\u6708\\u706b\\u6c34\\u6728\\u91d1\\u571f\\u65e5]?\\s*(?:\\u914d\\u9054\\s*)?([0-9OoIl|]{1,3})\\s*(?:\\u4ef6)?\\s*(?:YEN\\s*)?(\\d{1,3}(?:,\\d{3})+|\\d{3,6})\\s*(?:\\u5186)?`
  );
  const match = normalized.match(pattern);
  if (!match) return null;

  const deliveries = extractDeliveryCount(`\u914d\u9054${match[2]}\u4ef6`);
  const amount = Number(match[3].replace(/,/g, ""));

  return {
    amount: Number.isFinite(amount) ? amount : null,
    deliveries,
    matchedDateLabel: match[1],
  };
}

function extractColumnDailyRow(lines: ParsedLine[], targetDate: string) {
  const rows = lines
    .map((line, position) => {
      const dateLabel = normalizeText(line.text).match(
        /^[^\d]{0,6}(\d{1,2}\s*[\/\-.]\s*\d{1,2})/
      )?.[1];
      const deliveries =
        extractDeliveryCount(line.text) ?? extractLooseDeliveryCountFromDailyRow(line.text);
      return dateLabel && deliveries ? { position, dateLabel, deliveries, text: line.text } : null;
    })
    .filter((row): row is NonNullable<typeof row> => Boolean(row));
  const targetRowIndex = rows.findIndex((row) => lineMatchesTargetDate(row.text, targetDate));
  if (targetRowIndex < 0) return null;

  const amounts = lines
    .map((line, position) => ({ position, amount: extractAmountFromText(line.text) }))
    .filter((item): item is { position: number; amount: number } => typeof item.amount === "number");
  const amountsAfterFirstRow = amounts.filter((item) => item.position >= rows[0].position);
  const amount = amountsAfterFirstRow[targetRowIndex]?.amount ?? null;

  return {
    amount,
    deliveries: rows[targetRowIndex].deliveries,
    matchedDateLabel: rows[targetRowIndex].dateLabel,
  };
}

function startsWithAnyDate(line: string) {
  return /^[^\d]{0,6}\d{1,2}\s*[\/\-.]\s*\d{1,2}/.test(normalizeText(line));
}

function extractRowText(lines: ParsedLine[], targetDate: string) {
  for (let i = 0; i < lines.length; i += 1) {
    const matchedDateLabel = lineMatchesTargetDate(lines[i].text, targetDate);
    if (!matchedDateLabel) continue;
    const rowParts = [lines[i].text];
    const nextLine = lines[i + 1]?.text;
    if (nextLine && !startsWithAnyDate(nextLine)) {
      rowParts.push(nextLine);
    }
    const row = rowParts.join(" ");
    return { row, matchedDateLabel };
  }
  return null;
}

export function extractDailyIncome(text: string, targetDate: string) {
  const lines = parseLines(text);
  const dailyHeading = lines.find((line) => isDailyIncomeHeading(line.text));
  const adjustmentHeading = lines.find((line) => isAdjustmentHeading(line.text));
  const dailyLines = dailyHeading
    ? section(lines, dailyHeading.index, adjustmentHeading?.index ?? Number.POSITIVE_INFINITY)
    : lines;
  const dailyText = dailyLines.map((line) => line.text).join(" ");
  const inlineRow = extractInlineDailyRow(dailyText, targetDate);
  if (inlineRow && (inlineRow.amount || inlineRow.deliveries)) return inlineRow;

  const columnRow = extractColumnDailyRow(dailyLines, targetDate);
  if (columnRow && (columnRow.amount || columnRow.deliveries)) return columnRow;

  const row = extractRowText(dailyLines, targetDate) ?? extractRowText(lines, targetDate);

  if (!row) {
    return { amount: null, deliveries: null, matchedDateLabel: undefined };
  }

  return {
    amount: extractAmountFromText(row.row),
    deliveries: extractDeliveryCount(row.row),
    matchedDateLabel: row.matchedDateLabel,
  };
}

export function extractAdjustmentAmount(text: string, targetDate: string) {
  const lines = parseLines(text);
  const adjustmentHeading = lines.find((line) => isAdjustmentHeading(line.text));
  if (!adjustmentHeading) return 0;

  const adjustmentLines = section(lines, adjustmentHeading.index, Number.POSITIVE_INFINITY);
  let total = 0;

  for (let i = 0; i < adjustmentLines.length; i += 1) {
    if (!lineMatchesTargetDate(adjustmentLines[i].text, targetDate)) continue;
    const row = [adjustmentLines[i]?.text, adjustmentLines[i + 1]?.text]
      .filter(Boolean)
      .join(" ");
    total += extractAmountFromText(row, 1) ?? 0;
  }

  return total;
}

function scoreBulkResult(result: RocketNowBulkDailyResult) {
  return (
    (result.amount ? 12 : 0) +
    (result.baseAmount ? 8 : 0) +
    (result.deliveries ? 8 : 0) +
    (result.adjustmentAmount > 0 ? 1 : 0)
  );
}

function mergeBulkResult(
  current: RocketNowBulkDailyResult | undefined,
  next: RocketNowBulkDailyResult
) {
  if (!current) return next;

  const merged: RocketNowBulkDailyResult = {
    ...current,
    baseAmount: current.baseAmount ?? next.baseAmount,
    deliveries: current.deliveries ?? next.deliveries,
    adjustmentAmount: Math.max(current.adjustmentAmount, next.adjustmentAmount),
    sourceFileName: current.sourceFileName ?? next.sourceFileName,
    confidence: Math.max(current.confidence ?? 0, next.confidence ?? 0),
  };
  merged.amount =
    merged.baseAmount === null && merged.adjustmentAmount === 0
      ? null
      : (merged.baseAmount ?? 0) + merged.adjustmentAmount;

  return scoreBulkResult(next) > scoreBulkResult(merged)
    ? { ...next, adjustmentAmount: merged.adjustmentAmount, amount: next.baseAmount === null && merged.adjustmentAmount === 0 ? null : (next.baseAmount ?? 0) + merged.adjustmentAmount }
    : merged;
}

export function parseRocketNowDailyOcrTextForAllDates(
  text: string,
  baseYear: number
): RocketNowBulkDailyResult[] {
  const lines = parseLines(text);
  const dailyHeading = lines.find((line) => isDailyIncomeHeading(line.text));
  const adjustmentHeading = lines.find((line) => isAdjustmentHeading(line.text));
  const dailyLines = dailyHeading
    ? section(lines, dailyHeading.index, adjustmentHeading?.index ?? Number.POSITIVE_INFINITY)
    : lines;
  const results = new Map<string, RocketNowBulkDailyResult>();

  const rows = dailyLines
    .map((line, position) => {
      const matchedDateLabel = dateLabelFromLine(line.text);
      const date = matchedDateLabel ? isoDateFromLabel(matchedDateLabel, baseYear) : null;
      if (!matchedDateLabel || !date) return null;
      const deliveries = extractDeliveryCount(line.text);
      const inlineAmount = extractAmountFromText(line.text);
      return { position, date, matchedDateLabel, deliveries, inlineAmount, text: line.text };
    })
    .filter((row): row is NonNullable<typeof row> => Boolean(row));

  const amountRows = dailyLines
    .map((line, position) => ({ position, amount: extractAmountFromText(line.text) }))
    .filter((line): line is { position: number; amount: number } => typeof line.amount === "number");
  const amountRowsAfterFirstDate = rows[0]
    ? amountRows.filter((line) => line.position >= rows[0].position)
    : amountRows;

  rows.forEach((row, index) => {
    const baseAmount = row.inlineAmount ?? amountRowsAfterFirstDate[index]?.amount ?? null;
    const next: RocketNowBulkDailyResult = {
      id: `rocket-${row.date}`,
      date: row.date,
      matchedDateLabel: row.matchedDateLabel.replace(/\s/g, ""),
      baseAmount,
      adjustmentAmount: 0,
      amount: baseAmount,
      deliveries: row.deliveries,
      confidence: (baseAmount ? 0.45 : 0) + (row.deliveries ? 0.45 : 0),
    };
    results.set(row.date, mergeBulkResult(results.get(row.date), next));
  });

  if (adjustmentHeading) {
    const adjustmentLines = section(lines, adjustmentHeading.index, Number.POSITIVE_INFINITY);
    for (let index = 0; index < adjustmentLines.length; index += 1) {
      const matchedDateLabel = dateLabelFromLine(adjustmentLines[index].text);
      const date = matchedDateLabel ? isoDateFromLabel(matchedDateLabel, baseYear) : null;
      if (!matchedDateLabel || !date) continue;

      const row = [adjustmentLines[index]?.text, adjustmentLines[index + 1]?.text]
        .filter(Boolean)
        .join(" ");
      const adjustmentAmount = extractAmountFromText(row, 1) ?? 0;
      if (adjustmentAmount <= 0) continue;

      const current = results.get(date);
      const next: RocketNowBulkDailyResult = {
        id: `rocket-${date}`,
        date,
        matchedDateLabel: matchedDateLabel.replace(/\s/g, ""),
        baseAmount: current?.baseAmount ?? null,
        adjustmentAmount,
        amount:
          current?.baseAmount === null || typeof current?.baseAmount === "undefined"
            ? null
            : current.baseAmount + adjustmentAmount,
        deliveries: current?.deliveries ?? null,
        confidence: current?.confidence ?? 0.2,
      };
      results.set(date, mergeBulkResult(current, next));
    }
  }

  return [...results.values()]
    .filter((result) => isRecordDateLike(result.date))
    .sort((a, b) => (a.date > b.date ? 1 : -1));
}

function isRecordDateLike(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function parseRocketNowDailyOcrText(
  text: string,
  targetDate: string
): RocketNowDailyOcrResult {
  const daily = extractDailyIncome(text, targetDate);
  const adjustmentAmount = extractAdjustmentAmount(text, targetDate);
  const baseAmount = daily.amount;
  const amount = baseAmount === null && adjustmentAmount === 0
    ? null
    : (baseAmount ?? 0) + adjustmentAmount;

  return {
    amount,
    deliveries: daily.deliveries,
    baseAmount,
    adjustmentAmount,
    matchedDateLabel: daily.matchedDateLabel,
  };
}

function scoreResult(result: RocketNowDailyOcrResult) {
  return (result.amount ? 10 : 0) + (result.deliveries ? 8 : 0) + result.adjustmentAmount / 10000;
}

async function recognizeImage(blob: Blob) {
  const variants = await preprocessRocketNowDailyImageVariants(blob);
  const texts: string[] = [];

  for (const variant of variants) {
    const result = await Tesseract.recognize(variant.dataUrl, "jpn+eng");
    texts.push(result.data.text);
  }

  return texts.join("\n");
}

async function videoMetadata(video: HTMLVideoElement) {
  return new Promise<void>((resolve, reject) => {
    video.onloadedmetadata = () => resolve();
    video.onerror = () => reject(new Error("video load failed"));
  });
}

async function seekVideo(video: HTMLVideoElement, time: number) {
  return new Promise<void>((resolve, reject) => {
    video.onseeked = () => resolve();
    video.onerror = () => reject(new Error("video seek failed"));
    video.currentTime = time;
  });
}

async function canvasToBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("frame conversion failed"));
    }, "image/png");
  });
}

async function extractVideoFrames(file: File) {
  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.src = url;
  video.muted = true;
  video.playsInline = true;
  video.preload = "metadata";

  try {
    await videoMetadata(video);
    const duration = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 1;
    const points = [0.1, 0.25, 0.4, 0.55, 0.7, 0.85];
    const frames: Blob[] = [];

    for (const point of points) {
      await seekVideo(video, Math.min(duration - 0.05, Math.max(0, duration * point)));
      const canvas = document.createElement("canvas");
      const maxWidth = 1200;
      const width = Math.min(maxWidth, video.videoWidth || maxWidth);
      const scale = width / (video.videoWidth || width);
      canvas.width = width;
      canvas.height = Math.max(1, Math.floor((video.videoHeight || width) * scale));
      const context = canvas.getContext("2d");
      if (!context) continue;
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      frames.push(await canvasToBlob(canvas));
    }

    return frames;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function ensureReadableResult(result: RocketNowDailyOcrResult) {
  if (!result.amount && !result.deliveries) throw new Error(READ_ERROR_MESSAGE);
  return result;
}

export async function readRocketNowDailyFromImage(
  file: File,
  targetDate: string
): Promise<RocketNowDailyOcrResult> {
  const text = await recognizeImage(file);
  return ensureReadableResult(parseRocketNowDailyOcrText(text, targetDate));
}

export async function readRocketNowBulkDailyFromImages(
  files: File[],
  baseYear: number
): Promise<RocketNowBulkDailyResult[]> {
  const byDate = new Map<string, RocketNowBulkDailyResult>();

  for (const file of files) {
    const text = await recognizeImage(file);
    const parsed = parseRocketNowDailyOcrTextForAllDates(text, baseYear);

    for (const item of parsed) {
      const next = {
        ...item,
        id: `${item.date}-${file.name}`,
        sourceFileName: file.name,
      };
      byDate.set(item.date, mergeBulkResult(byDate.get(item.date), next));
    }
  }

  return [...byDate.values()].sort((a, b) => (a.date > b.date ? 1 : -1));
}

export async function readRocketNowDailyFromVideo(
  file: File,
  targetDate: string
): Promise<RocketNowDailyOcrResult> {
  const frames = await extractVideoFrames(file);
  let best: RocketNowDailyOcrResult = {
    amount: null,
    deliveries: null,
    baseAmount: null,
    adjustmentAmount: 0,
  };

  for (const frame of frames) {
    const text = await recognizeImage(frame);
    const result = parseRocketNowDailyOcrText(text, targetDate);
    if (scoreResult(result) > scoreResult(best)) best = result;
  }

  return ensureReadableResult(best);
}
