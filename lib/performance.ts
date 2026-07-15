import { isHolidayOrWeekend } from "@/lib/japaneseHolidays";

export type ServiceKey = "uber" | "demae" | "menu" | "rocket" | "other";
export type CompareTarget = "all" | ServiceKey;
export type ComparePeriod = "day" | "week" | "month" | "year";
export type CompareMetric =
  | "sales"
  | "hourly"
  | "unitPrice"
  | "minUnitPrice"
  | "maxUnitPrice"
  | "workTime"
  | "deliveries"
  | "averageDaily";

export type PerformanceRecord = {
  date: string;
  total?: number;
  workMinutes?: number;
  services?: Partial<Record<ServiceKey, { amount?: number; deliveries?: number }>>;
};

type Range = {
  label: string;
  start: string;
  end: string;
};

export function toIsoDate(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function startOfWeek(date: Date) {
  const day = date.getDay();
  return addDays(date, day === 0 ? -6 : 1 - day);
}

function endOfWeek(date: Date) {
  return addDays(startOfWeek(date), 6);
}

function rangeLabel(period: ComparePeriod, index: number) {
  const labels: Record<ComparePeriod, string[]> = {
    day: ["今日", "昨日", "一昨日"],
    week: ["今週", "先週", "先々週"],
    month: ["今月", "先月", "先々月"],
    year: ["今年", "昨年", "一昨年"],
  };
  return labels[period][index] ?? "";
}

export function getRecentRanges(period: ComparePeriod, baseDate = new Date()): Range[] {
  if (period === "day") {
    return [0, 1, 2].map((diff, index) => {
      const iso = toIsoDate(addDays(baseDate, -diff));
      return { label: rangeLabel(period, index), start: iso, end: iso };
    });
  }

  if (period === "week") {
    return [0, 1, 2].map((diff, index) => {
      const base = addDays(baseDate, diff * -7);
      return {
        label: rangeLabel(period, index),
        start: toIsoDate(startOfWeek(base)),
        end: toIsoDate(endOfWeek(base)),
      };
    });
  }

  if (period === "month") {
    return [0, 1, 2].map((diff, index) => {
      const start = new Date(baseDate.getFullYear(), baseDate.getMonth() - diff, 1);
      const end = new Date(start.getFullYear(), start.getMonth() + 1, 0);
      return { label: rangeLabel(period, index), start: toIsoDate(start), end: toIsoDate(end) };
    });
  }

  return [0, 1, 2].map((diff, index) => {
    const year = baseDate.getFullYear() - diff;
    return { label: rangeLabel(period, index), start: `${year}-01-01`, end: `${year}-12-31` };
  });
}

function totalDeliveries(record: PerformanceRecord, target: CompareTarget) {
  if (target !== "all") return record.services?.[target]?.deliveries ?? 0;
  return (Object.keys(record.services ?? {}) as ServiceKey[]).reduce(
    (sum, key) => sum + (record.services?.[key]?.deliveries ?? 0),
    0
  );
}

function sales(record: PerformanceRecord, target: CompareTarget) {
  if (target !== "all") return record.services?.[target]?.amount ?? 0;
  return record.total ?? 0;
}

function recordsInRange(records: PerformanceRecord[], range: Range) {
  return records.filter((record) => record.date >= range.start && record.date <= range.end);
}

function aggregate(records: PerformanceRecord[], target: CompareTarget) {
  const total = records.reduce((sum, record) => sum + sales(record, target), 0);
  const workMinutes = records.reduce((sum, record) => sum + (record.workMinutes ?? 0), 0);
  const deliveries = records.reduce((sum, record) => sum + totalDeliveries(record, target), 0);
  const unitPrices = records
    .map((record) => {
      const count = totalDeliveries(record, target);
      return count > 0 ? Math.floor(sales(record, target) / count) : null;
    })
    .filter((value): value is number => value !== null);

  return {
    total,
    workMinutes,
    deliveries,
    workDays: records.length,
    hourly: workMinutes > 0 ? Math.floor(total / (workMinutes / 60)) : null,
    unitPrice: deliveries > 0 ? Math.floor(total / deliveries) : null,
    minUnitPrice: unitPrices.length > 0 ? Math.min(...unitPrices) : null,
    maxUnitPrice: unitPrices.length > 0 ? Math.max(...unitPrices) : null,
    averageDaily: records.length > 0 ? Math.floor(total / records.length) : null,
  };
}

export function getMetricValue(
  records: PerformanceRecord[],
  range: Range,
  target: CompareTarget,
  metric: CompareMetric
) {
  const summary = aggregate(recordsInRange(records, range), target);
  if (metric === "sales") return summary.total;
  if (metric === "hourly") return summary.hourly;
  if (metric === "unitPrice") return summary.unitPrice;
  if (metric === "minUnitPrice") return summary.minUnitPrice;
  if (metric === "maxUnitPrice") return summary.maxUnitPrice;
  if (metric === "workTime") return summary.workMinutes;
  if (metric === "deliveries") return summary.deliveries;
  return summary.averageDaily;
}

export function getFixedPerformanceStats(records: PerformanceRecord[], baseDate = new Date()) {
  const dayRanges = getRecentRanges("day", baseDate);
  const weekRanges = getRecentRanges("week", baseDate);
  const monthStart = new Date(baseDate.getFullYear(), baseDate.getMonth(), 1);
  const monthEnd = new Date(baseDate.getFullYear(), baseDate.getMonth() + 1, 0);
  const monthRange = { label: "今月", start: toIsoDate(monthStart), end: toIsoDate(monthEnd) };
  const monthRecords = recordsInRange(records, monthRange);
  const weekdayRecords = monthRecords.filter((record) => !isHolidayOrWeekend(record.date));
  const holidayRecords = monthRecords.filter((record) => isHolidayOrWeekend(record.date));
  const bestSales = Math.max(0, ...monthRecords.map((record) => record.total ?? 0));
  const bestUnitPrice = Math.max(
    0,
    ...monthRecords.map((record) => {
      const deliveries = totalDeliveries(record, "all");
      return deliveries > 0 ? Math.floor((record.total ?? 0) / deliveries) : 0;
    })
  );

  return [
    { label: "今日", value: getMetricValue(records, dayRanges[0], "all", "sales"), format: "money" },
    { label: "昨日", value: getMetricValue(records, dayRanges[1], "all", "sales"), format: "money" },
    { label: "今週", value: getMetricValue(records, weekRanges[0], "all", "sales"), format: "money" },
    { label: "先週", value: getMetricValue(records, weekRanges[1], "all", "sales"), format: "money" },
    { label: "日給平均", value: aggregate(monthRecords, "all").averageDaily, format: "money" },
    { label: "", value: null, format: "money" },
    { label: "平日日給平均", value: aggregate(weekdayRecords, "all").averageDaily, format: "money" },
    { label: "休日給平均", value: aggregate(holidayRecords, "all").averageDaily, format: "money" },
    { label: "月間最高売上", value: bestSales || null, format: "money" },
    { label: "最高単価", value: bestUnitPrice || null, format: "unit" },
  ] as const;
}

export function formatPerformanceValue(
  value: number | null,
  metricOrFormat: CompareMetric | "money" | "count" | "unit"
) {
  if (value === null || Number.isNaN(value)) return "-";
  if (metricOrFormat === "workTime") {
    const hours = Math.floor(value / 60);
    const minutes = value % 60;
    return `${hours}:${String(minutes).padStart(2, "0")}`;
  }
  if (metricOrFormat === "deliveries" || metricOrFormat === "count") return `${value}件`;
  if (
    metricOrFormat === "unitPrice" ||
    metricOrFormat === "minUnitPrice" ||
    metricOrFormat === "maxUnitPrice" ||
    metricOrFormat === "unit"
  ) {
    return `￥${value.toLocaleString()}/件`;
  }
  return `￥${value.toLocaleString()}`;
}
