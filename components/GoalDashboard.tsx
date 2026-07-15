"use client";

import { useEffect, useMemo, useState } from "react";
import {
  getMonthlyGoal,
  saveMonthlyGoal,
  type MonthlyGoalPlan,
} from "@/lib/goals";

type ServiceKey = "uber" | "demae" | "menu" | "rocket" | "other";

type StoredRecord = {
  date: string;
  total: number;
  services: Record<ServiceKey, { amount: number; deliveries: number }>;
  hidden?: boolean;
  updatedAt?: string;
};

type Props = {
  records: StoredRecord[];
  currentMonth: Date;
  onChangeMonth: (diff: number) => void;
  displayName?: string;
};

const MAX_MONTHLY_TARGET = 1000000;

function toIsoDate(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function todayIsoDate() {
  return toIsoDate(new Date());
}

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function formatMonthLabel(date: Date) {
  return `${date.getFullYear()}年${date.getMonth() + 1}月`;
}

function formatCurrency(amount: number) {
  return `¥${Math.max(0, amount).toLocaleString()}`;
}

function clampAmount(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(Math.max(Math.floor(value), 0), MAX_MONTHLY_TARGET);
}

function parseAmount(value: string) {
  return clampAmount(parseInt(value.replace(/[^\d]/g, "") || "0", 10) || 0);
}

function daysInMonth(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  return new Date(year, monthNumber, 0).getDate();
}

function datesInMonth(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  return Array.from({ length: daysInMonth(month) }, (_, index) =>
    toIsoDate(new Date(year, monthNumber - 1, index + 1))
  );
}

function createPlanFromMonthlyTarget(month: string, targetAmount: number): MonthlyGoalPlan {
  const now = new Date().toISOString();
  const dates = datesInMonth(month);
  const baseDaily = dates.length > 0 ? Math.floor(targetAmount / dates.length) : 0;
  let remainder = targetAmount - baseDaily * dates.length;

  return {
    month,
    weekdayTarget: baseDaily,
    holidayTarget: baseDaily,
    dailyGoals: dates.map((date) => {
      const extra = remainder > 0 ? 1 : 0;
      remainder -= extra;
      return {
        date,
        targetAmount: baseDaily + extra,
        updatedAt: now,
      };
    }),
    updatedAt: now,
  };
}

function monthlyTargetFromPlan(plan: MonthlyGoalPlan | null) {
  return plan?.dailyGoals.reduce((sum, goal) => sum + goal.targetAmount, 0) ?? 0;
}

function dedupeRecords(records: StoredRecord[]) {
  const map = new Map<string, StoredRecord>();

  for (const record of records) {
    if (record.hidden === true) continue;
    const current = map.get(record.date);
    if (!current) {
      map.set(record.date, record);
      continue;
    }

    const currentTime = new Date(current.updatedAt ?? "").getTime();
    const nextTime = new Date(record.updatedAt ?? "").getTime();
    if (nextTime > currentTime || (nextTime === currentTime && record.total > current.total)) {
      map.set(record.date, record);
    }
  }

  return [...map.values()];
}

function remainingDaysForMonth(month: string) {
  const today = todayIsoDate();
  const currentMonth = today.slice(0, 7);
  const totalDays = daysInMonth(month);

  if (month < currentMonth) return 0;
  if (month > currentMonth) return totalDays;

  const todayDay = Number(today.slice(8, 10));
  return Math.max(totalDays - todayDay + 1, 1);
}

function supportComment(target: number, actual: number) {
  if (target <= 0) return "まずは今月の目標を入れてみよう";
  if (actual <= 0) return "今日の1件からスタートしよう";
  const rate = actual / target;
  if (rate >= 1) return "今月の目標達成！すごい！";
  if (rate >= 0.5) return "いいペースです";
  return "コツコツ積み上げよう";
}

export default function GoalDashboard({
  records,
  currentMonth,
  onChangeMonth,
}: Props) {
  const month = monthKey(currentMonth);
  const [plan, setPlan] = useState<MonthlyGoalPlan | null>(null);
  const [targetInput, setTargetInput] = useState("");
  const [savedMessage, setSavedMessage] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const current = getMonthlyGoal(month);
      setPlan(current);
      const target = monthlyTargetFromPlan(current);
      setTargetInput(target > 0 ? String(target) : "");
      setSavedMessage("");
    }, 0);

    return () => window.clearTimeout(timer);
  }, [month]);

  const monthRecords = useMemo(
    () => dedupeRecords(records).filter((record) => record.date.startsWith(month)),
    [month, records]
  );

  const targetAmount = monthlyTargetFromPlan(plan);
  const actualAmount = monthRecords.reduce((sum, record) => sum + (record.total || 0), 0);
  const remainingAmount = Math.max(targetAmount - actualAmount, 0);
  const achieved = targetAmount > 0 && actualAmount >= targetAmount;
  const remainingDays = remainingDaysForMonth(month);
  const dailyPace =
    targetAmount > 0 && !achieved && remainingDays > 0
      ? Math.ceil(remainingAmount / remainingDays)
      : 0;
  const progressRate =
    targetAmount > 0 ? Math.min(Math.floor((actualAmount / targetAmount) * 100), 999) : 0;
  const comment = supportComment(targetAmount, actualAmount);

  const handleSaveTarget = () => {
    const nextTarget = parseAmount(targetInput);
    const nextPlan = createPlanFromMonthlyTarget(month, nextTarget);
    saveMonthlyGoal(nextPlan);
    setPlan(nextPlan);
    setTargetInput(nextTarget > 0 ? String(nextTarget) : "");
    setSavedMessage("目標を保存しました");
  };

  return (
    <div className="space-y-3">
      <section
        className={`rounded-2xl p-4 shadow-sm ${
          achieved ? "border border-amber-100 bg-amber-50" : "bg-white"
        }`}
      >
        <div className="mb-3 flex items-center justify-between">
          <button
            type="button"
            onClick={() => onChangeMonth(-1)}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-green-200 text-lg font-bold text-green-700"
            aria-label="前月"
          >
            ‹
          </button>
          <div className="text-sm font-black text-gray-900">{formatMonthLabel(currentMonth)}</div>
          <button
            type="button"
            onClick={() => onChangeMonth(1)}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-green-200 text-lg font-bold text-green-700"
            aria-label="次月"
          >
            ›
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <GoalMiniStat label="今月の目標" value={formatCurrency(targetAmount)} strong />
          <GoalMiniStat label="現在売上" value={formatCurrency(actualAmount)} strong />
        </div>

        <div className="mt-3 rounded-2xl bg-white/80 px-3 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-xs font-bold text-gray-500">
                {targetAmount <= 0
                  ? "目標を設定してみよう"
                  : achieved
                  ? "今月の目標達成！"
                  : "目標まであと"}
              </div>
              <div className="mt-1 text-xl font-black text-gray-950">
                {targetAmount <= 0 || achieved
                  ? achieved
                    ? "残り ¥0"
                    : "未設定"
                  : formatCurrency(remainingAmount)}
              </div>
            </div>
            {targetAmount > 0 && (
              <div className="shrink-0 rounded-full bg-green-50 px-3 py-1.5 text-xs font-black text-green-700">
                {progressRate}%
              </div>
            )}
          </div>

          {targetAmount > 0 && (
            <div className="mt-3 rounded-xl bg-green-50 px-3 py-2 text-xs font-bold text-green-800">
              {achieved
                ? "このペースでOK！"
                : remainingDays > 0
                ? `今日からなら 1日 ${formatCurrency(dailyPace)} で達成ペース`
                : "今月の記録を振り返ろう"}
            </div>
          )}
        </div>

        <div className="mt-3 rounded-xl bg-green-50 px-3 py-2 text-xs font-black text-green-800">
          {comment}
        </div>
      </section>

      <section className="rounded-2xl bg-white p-4 shadow-sm">
        <label className="block">
          <span className="text-sm font-black text-gray-900">今月の目標売上</span>
          <div className="mt-2 flex min-w-0 items-center gap-2">
            <div className="flex h-11 min-w-0 flex-1 items-center rounded-xl border border-gray-200 bg-gray-50 px-3 focus-within:border-green-500 focus-within:ring-2 focus-within:ring-green-100">
              <span className="shrink-0 text-sm font-bold text-gray-500">¥</span>
              <input
                type="text"
                inputMode="numeric"
                value={targetInput}
                onChange={(event) => setTargetInput(String(parseAmount(event.target.value) || ""))}
                className="min-w-0 flex-1 bg-transparent px-2 text-right text-sm font-black outline-none"
                placeholder="100000"
                aria-label="今月の目標売上"
              />
            </div>
            <button
              type="button"
              onClick={handleSaveTarget}
              className="h-11 shrink-0 rounded-xl bg-green-600 px-4 text-sm font-black text-white active:bg-green-700"
            >
              保存
            </button>
          </div>
        </label>

        <div className="mt-3 grid grid-cols-3 gap-2">
          {[100000, 200000, 300000].map((amount) => (
            <button
              key={amount}
              type="button"
              onClick={() => setTargetInput(String(amount))}
              className="h-9 rounded-xl bg-gray-100 text-xs font-black text-gray-700 active:bg-gray-200"
            >
              {formatCurrency(amount)}
            </button>
          ))}
        </div>

        {savedMessage && (
          <div className="mt-3 rounded-xl bg-green-50 px-3 py-2 text-center text-xs font-bold text-green-700">
            {savedMessage}
          </div>
        )}
      </section>
    </div>
  );
}

function GoalMiniStat({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="min-w-0 rounded-2xl bg-gray-50 px-3 py-3">
      <div className="truncate text-xs font-bold text-gray-500">{label}</div>
      <div
        className={`mt-1 break-words font-black leading-tight text-gray-950 ${
          strong ? "text-lg" : "text-base"
        }`}
      >
        {value}
      </div>
    </div>
  );
}
