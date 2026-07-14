import type { UbalogServiceRecord, UbalogStoredRecord } from "@/lib/records";

export const ROCKETNOW_BULK_IMPORT_HISTORY_KEY =
  "ubalog-rocketnow-bulk-import-history";
export const ROCKETNOW_BULK_IMPORT_LOGS_KEY =
  "ubalog-rocketnow-bulk-import-logs";

export type RocketNowBestDay = {
  date: string;
  amount: number;
  deliveries: number;
};

export type RocketNowStats = {
  hasRocketRecords: boolean;
  todayAmount: number;
  weekAmount: number;
  monthAmount: number;
  monthDeliveries: number;
  monthUnitPrice: number | null;
  monthBestDay: RocketNowBestDay | null;
  latestBulkImportedCount: number | null;
  comment: string;
};

type BulkHistoryLike = {
  importedCount?: unknown;
  count?: unknown;
  items?: unknown;
};

function toIsoDate(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function startOfWeekMonday(date: Date) {
  const start = new Date(date);
  const day = start.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  start.setDate(start.getDate() + diff);
  return start;
}

function getMonthRange(now: Date) {
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return { start: toIsoDate(start), end: toIsoDate(end) };
}

function getWeekRange(now: Date) {
  const start = startOfWeekMonday(now);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return { start: toIsoDate(start), end: toIsoDate(end) };
}

function rocketService(record: UbalogStoredRecord): UbalogServiceRecord {
  return record.services?.rocket ?? { amount: 0, deliveries: 0 };
}

function amountOf(record: UbalogStoredRecord) {
  return Number(rocketService(record).amount) || 0;
}

function deliveriesOf(record: UbalogStoredRecord) {
  return Number(rocketService(record).deliveries) || 0;
}

function recordsInRange(records: UbalogStoredRecord[], start: string, end: string) {
  return records.filter((record) => record.date >= start && record.date <= end);
}

export function getRocketNowTodayAmount(
  records: UbalogStoredRecord[],
  now = new Date()
) {
  const today = toIsoDate(now);
  return records
    .filter((record) => record.date === today)
    .reduce((sum, record) => sum + amountOf(record), 0);
}

export function getRocketNowWeekAmount(
  records: UbalogStoredRecord[],
  now = new Date()
) {
  const range = getWeekRange(now);
  return recordsInRange(records, range.start, range.end).reduce(
    (sum, record) => sum + amountOf(record),
    0
  );
}

export function getRocketNowMonthAmount(
  records: UbalogStoredRecord[],
  now = new Date()
) {
  const range = getMonthRange(now);
  return recordsInRange(records, range.start, range.end).reduce(
    (sum, record) => sum + amountOf(record),
    0
  );
}

export function getRocketNowMonthDeliveries(
  records: UbalogStoredRecord[],
  now = new Date()
) {
  const range = getMonthRange(now);
  return recordsInRange(records, range.start, range.end).reduce(
    (sum, record) => sum + deliveriesOf(record),
    0
  );
}

export function getRocketNowBestDay(
  records: UbalogStoredRecord[],
  now = new Date()
): RocketNowBestDay | null {
  const range = getMonthRange(now);
  let best: RocketNowBestDay | null = null;

  for (const record of recordsInRange(records, range.start, range.end)) {
    const amount = amountOf(record);
    if (amount <= 0) continue;

    if (!best || amount > best.amount) {
      best = {
        date: record.date,
        amount,
        deliveries: deliveriesOf(record),
      };
    }
  }

  return best;
}

function numberFromHistoryItem(item: BulkHistoryLike) {
  const importedCount = Number(item.importedCount);
  if (Number.isFinite(importedCount) && importedCount > 0) return importedCount;

  const count = Number(item.count);
  if (Number.isFinite(count) && count > 0) return count;

  if (Array.isArray(item.items) && item.items.length > 0) return item.items.length;

  return null;
}

function latestImportedCountFromKey(key: string) {
  if (typeof window === "undefined") return null;

  const raw = localStorage.getItem(key);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    const latest = Array.isArray(parsed) ? parsed[0] : parsed;
    if (!latest || typeof latest !== "object") return null;
    return numberFromHistoryItem(latest as BulkHistoryLike);
  } catch {
    return null;
  }
}

export function getRocketNowLatestBulkImportedCount() {
  return (
    latestImportedCountFromKey(ROCKETNOW_BULK_IMPORT_HISTORY_KEY) ??
    latestImportedCountFromKey(ROCKETNOW_BULK_IMPORT_LOGS_KEY)
  );
}

function getComment(stats: Pick<RocketNowStats, "latestBulkImportedCount" | "monthBestDay" | "monthDeliveries">) {
  if (stats.latestBulkImportedCount) return "一気読み、いい感じです ✨";
  if (stats.monthDeliveries >= 20) return "ロケナウ伸びてます 🚀";
  if (stats.monthBestDay) return "今月のロケナウ記録、ナイスです";
  return "Rocket欄が育ってきました";
}

export function getRocketNowStats(
  records: UbalogStoredRecord[],
  now = new Date()
): RocketNowStats {
  const monthAmount = getRocketNowMonthAmount(records, now);
  const monthDeliveries = getRocketNowMonthDeliveries(records, now);
  const monthBestDay = getRocketNowBestDay(records, now);
  const latestBulkImportedCount = getRocketNowLatestBulkImportedCount();
  const hasRocketRecords = records.some(
    (record) => amountOf(record) > 0 || deliveriesOf(record) > 0
  );
  const baseStats = {
    latestBulkImportedCount,
    monthBestDay,
    monthDeliveries,
  };

  return {
    hasRocketRecords,
    todayAmount: getRocketNowTodayAmount(records, now),
    weekAmount: getRocketNowWeekAmount(records, now),
    monthAmount,
    monthDeliveries,
    monthUnitPrice:
      monthDeliveries > 0 ? Math.round(monthAmount / monthDeliveries) : null,
    monthBestDay,
    latestBulkImportedCount,
    comment: getComment(baseStats),
  };
}
