export const ROCKETNOW_DAILY_SCAN_FEEDBACK_KEY =
  "ubalog-rocketnow-daily-scan-feedbacks";
export const ROCKETNOW_BULK_CORRECTION_FEEDBACK_KEY =
  "ubalog-rocketnow-bulk-correction-feedbacks";
export const ROCKETNOW_FEEDBACK_UPDATED_EVENT = "ubalog-rocketnow-feedback-updated";

export type RocketNowSingleScanFeedback = {
  id: string;
  createdAt: string;
  type: "single";
  targetDate: string;
  matchedDateLabel?: string;
  ocrAmount: number | null;
  ocrDeliveries: number | null;
  correctedAmount: number;
  correctedDeliveries: number;
  baseAmount: number | null;
  adjustmentAmount: number;
  fileType: "image" | "video";
};

export type RocketNowBulkCorrectionItem = {
  date: string;
  matchedDateLabel?: string;
  ocrAmount: number | null;
  ocrDeliveries: number | null;
  correctedAmount: number;
  correctedDeliveries: number;
  baseAmount: number | null;
  adjustmentAmount: number;
};

export type RocketNowBulkCorrectionFeedback = {
  id: string;
  createdAt: string;
  type: "bulk";
  importHistoryId: string;
  items: RocketNowBulkCorrectionItem[];
};

export type RocketNowFeedbackEntry = {
  id: string;
  createdAt: string;
  source: "single" | "bulk";
  date: string;
  matchedDateLabel?: string;
  ocrAmount: number | null;
  ocrDeliveries: number | null;
  correctedAmount: number;
  correctedDeliveries: number;
};

function readJsonArray<T>(key: string): T[] {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem(key);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

function writeJsonArray<T>(key: string, value: T[]) {
  localStorage.setItem(key, JSON.stringify(value));
  window.dispatchEvent(new Event(ROCKETNOW_FEEDBACK_UPDATED_EVENT));
}

export function readSingleScanFeedbacks() {
  return readJsonArray<RocketNowSingleScanFeedback>(
    ROCKETNOW_DAILY_SCAN_FEEDBACK_KEY
  );
}

export function saveSingleScanFeedback(feedback: RocketNowSingleScanFeedback) {
  writeJsonArray(
    ROCKETNOW_DAILY_SCAN_FEEDBACK_KEY,
    [feedback, ...readSingleScanFeedbacks()].slice(0, 50)
  );
}

export function readBulkCorrectionFeedbacks() {
  return readJsonArray<RocketNowBulkCorrectionFeedback>(
    ROCKETNOW_BULK_CORRECTION_FEEDBACK_KEY
  );
}

export function saveBulkCorrectionFeedback(feedback: RocketNowBulkCorrectionFeedback) {
  writeJsonArray(
    ROCKETNOW_BULK_CORRECTION_FEEDBACK_KEY,
    [feedback, ...readBulkCorrectionFeedbacks()].slice(0, 30)
  );
}

export function clearRocketNowFeedbacks() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(ROCKETNOW_DAILY_SCAN_FEEDBACK_KEY);
  localStorage.removeItem(ROCKETNOW_BULK_CORRECTION_FEEDBACK_KEY);
  window.dispatchEvent(new Event(ROCKETNOW_FEEDBACK_UPDATED_EVENT));
}

export function readRocketNowFeedbackEntries(): RocketNowFeedbackEntry[] {
  const singles: RocketNowFeedbackEntry[] = readSingleScanFeedbacks().map((item) => ({
    id: item.id,
    createdAt: item.createdAt,
    source: "single",
    date: item.targetDate,
    matchedDateLabel: item.matchedDateLabel,
    ocrAmount: item.ocrAmount,
    ocrDeliveries: item.ocrDeliveries,
    correctedAmount: item.correctedAmount,
    correctedDeliveries: item.correctedDeliveries,
  }));
  const bulk: RocketNowFeedbackEntry[] = readBulkCorrectionFeedbacks().flatMap((entry) =>
    entry.items.map((item, index) => ({
      id: `${entry.id}-${index}`,
      createdAt: entry.createdAt,
      source: "bulk" as const,
      date: item.date,
      matchedDateLabel: item.matchedDateLabel,
      ocrAmount: item.ocrAmount,
      ocrDeliveries: item.ocrDeliveries,
      correctedAmount: item.correctedAmount,
      correctedDeliveries: item.correctedDeliveries,
    }))
  );

  return [...singles, ...bulk].sort((a, b) =>
    a.createdAt < b.createdAt ? 1 : -1
  );
}
