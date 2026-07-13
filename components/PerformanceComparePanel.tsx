"use client";

import { useMemo, useState } from "react";
import {
  formatPerformanceValue,
  getMetricValue,
  getRecentRanges,
  type CompareMetric,
  type ComparePeriod,
  type CompareTarget,
  type PerformanceRecord,
} from "@/lib/performance";

const STORAGE_KEY = "ubalog-performance-compare";

const targets: { value: CompareTarget; label: string }[] = [
  { value: "all", label: "すべて" },
  { value: "uber", label: "Uber" },
  { value: "demae", label: "出前館" },
  { value: "menu", label: "menu" },
  { value: "rocket", label: "Rocket" },
  { value: "other", label: "その他" },
];

const periods: { value: ComparePeriod; label: string }[] = [
  { value: "day", label: "日" },
  { value: "week", label: "週" },
  { value: "month", label: "月" },
  { value: "year", label: "年" },
];

const metrics: { value: CompareMetric; label: string }[] = [
  { value: "sales", label: "売上" },
  { value: "hourly", label: "時給" },
  { value: "unitPrice", label: "1件単価" },
  { value: "minUnitPrice", label: "最低単価" },
  { value: "maxUnitPrice", label: "最高単価" },
  { value: "workTime", label: "稼働時間" },
  { value: "deliveries", label: "件数" },
  { value: "averageDaily", label: "平均日給" },
];

type CompareState = {
  target: CompareTarget;
  period: ComparePeriod;
  metric: CompareMetric;
};

function loadState(): CompareState {
  if (typeof window === "undefined") {
    return { target: "all", period: "day", metric: "sales" };
  }

  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "");
    return {
      target: targets.some((item) => item.value === parsed.target) ? parsed.target : "all",
      period: periods.some((item) => item.value === parsed.period) ? parsed.period : "day",
      metric: metrics.some((item) => item.value === parsed.metric) ? parsed.metric : "sales",
    };
  } catch {
    return { target: "all", period: "day", metric: "sales" };
  }
}

function labelOf<T extends string>(items: { value: T; label: string }[], value: T) {
  return items.find((item) => item.value === value)?.label ?? "";
}

export default function PerformanceComparePanel({
  records,
}: {
  records: PerformanceRecord[];
}) {
  const [state, setState] = useState<CompareState>(loadState);

  const updateState = (next: Partial<CompareState>) => {
    setState((current) => {
      const merged = { ...current, ...next };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
      return merged;
    });
  };

  const ranges = useMemo(() => getRecentRanges(state.period), [state.period]);
  const values = useMemo(
    () =>
      ranges.map((range) => ({
        label: range.label,
        value: getMetricValue(records, range, state.target, state.metric),
      })),
    [ranges, records, state.metric, state.target]
  );

  return (
    <section className="rounded-2xl bg-white p-3 shadow-sm">
      <div className="text-sm font-bold text-gray-900">各社/期間別/指標の比較</div>
      <div className="mt-3 grid grid-cols-3 gap-2">
        <SelectBox
          label="対象"
          value={state.target}
          options={targets}
          onChange={(value) => updateState({ target: value as CompareTarget })}
        />
        <SelectBox
          label="期間"
          value={state.period}
          options={periods}
          onChange={(value) => updateState({ period: value as ComparePeriod })}
        />
        <SelectBox
          label="指標"
          value={state.metric}
          options={metrics}
          onChange={(value) => updateState({ metric: value as CompareMetric })}
        />
      </div>

      <div className="mt-3 rounded-xl bg-green-50 px-3 py-2 text-xs font-bold text-green-700">
        {labelOf(targets, state.target)}・{labelOf(periods, state.period)}・
        {labelOf(metrics, state.metric)}
      </div>

      <div className="mt-2 grid grid-cols-3 gap-2">
        {values.map((item) => (
          <div key={item.label} className="rounded-xl bg-gray-50 px-2 py-3 text-center">
            <div className="text-[11px] font-bold text-gray-500">{item.label}</div>
            <div className="mt-1 break-words text-sm font-black text-gray-900">
              {formatPerformanceValue(item.value, state.metric)}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function SelectBox<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-[10px] font-bold text-gray-500">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 h-9 w-full rounded-lg border border-gray-200 bg-white px-2 text-xs font-bold text-gray-800"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
