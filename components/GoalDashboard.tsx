"use client";

import { useEffect, useMemo, useState } from "react";
import {
  getMonthlyGoal,
  saveMonthlyGoal,
  updateDailyGoal,
  type DailyGoal,
  type MonthlyGoalPlan,
} from "@/lib/goals";

type ServiceKey = "uber" | "demae" | "menu" | "rocket" | "other";

type StoredRecord = {
  date: string;
  total: number;
  hourly?: number;
  workMinutes?: number;
  services?: Partial<Record<ServiceKey, { amount?: number; deliveries?: number }>>;
  hidden?: boolean;
  updatedAt?: string;
};

type Props = {
  records: StoredRecord[];
  currentMonth: Date;
  onChangeMonth: (diff: number) => void;
  displayName?: string;
};

type DaySummary = {
  date: string;
  total: number;
  workMinutes: number;
  deliveries: number;
  services: Record<ServiceKey, number>;
};

const SERVICE_LABELS: { key: ServiceKey; label: string }[] = [
  { key: "uber", label: "Uber" },
  { key: "rocket", label: "ロケット" },
  { key: "demae", label: "出前館" },
  { key: "menu", label: "menu" },
  { key: "other", label: "その他" },
];
const MAX_DAILY_TARGET = 100000;

function toIsoDate(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function formatMonthLabel(date: Date) {
  return `${date.getFullYear()}年${date.getMonth() + 1}月`;
}

function formatCurrency(amount: number) {
  return `¥${Math.max(0, Math.floor(amount)).toLocaleString()}`;
}

function formatShortCurrency(amount: number) {
  if (amount <= 0) return "-";
  if (amount >= 10000) return `${Math.floor(amount / 1000) / 10}万`;
  return amount.toLocaleString();
}

function formatMinutes(minutes: number) {
  const safeMinutes = Math.max(0, Math.floor(minutes));
  const h = Math.floor(safeMinutes / 60);
  const m = safeMinutes % 60;
  return `${h}:${String(m).padStart(2, "0")}`;
}

function safeNumber(value: unknown) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) && numberValue > 0 ? numberValue : 0;
}

function clampTarget(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(Math.max(Math.floor(value), 0), MAX_DAILY_TARGET);
}

function parseAmount(value: string) {
  return clampTarget(parseInt(value.replace(/[^\d]/g, "") || "0", 10) || 0);
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

function buildCalendarCells(month: string) {
  const dates = datesInMonth(month);
  const [year, monthNumber] = month.split("-").map(Number);
  const firstDay = new Date(year, monthNumber - 1, 1);
  const mondayOffset = (firstDay.getDay() + 6) % 7;
  const cells: (string | null)[] = Array.from({ length: mondayOffset }, () => null);
  cells.push(...dates);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function goalMapFromPlan(plan: MonthlyGoalPlan | null) {
  const map = new Map<string, number>();
  for (const goal of plan?.dailyGoals ?? []) {
    map.set(goal.date, clampTarget(goal.targetAmount));
  }
  return map;
}

function monthlyTargetFromGoals(plan: MonthlyGoalPlan | null) {
  return [...goalMapFromPlan(plan).values()].reduce((sum, amount) => sum + amount, 0);
}

function createPlanWithDailyGoals(
  month: string,
  current: MonthlyGoalPlan | null,
  goals: Map<string, number>
): MonthlyGoalPlan {
  const now = new Date().toISOString();
  const dailyGoals: DailyGoal[] = datesInMonth(month).map((date) => ({
    date,
    targetAmount: clampTarget(goals.get(date) ?? 0),
    updatedAt: now,
  })).filter((goal) => goal.targetAmount > 0);

  return {
    month,
    weekdayTarget: current?.weekdayTarget ?? 0,
    holidayTarget: current?.holidayTarget ?? 0,
    dailyGoals,
    updatedAt: now,
  };
}

function emptySummary(date: string): DaySummary {
  return {
    date,
    total: 0,
    workMinutes: 0,
    deliveries: 0,
    services: { uber: 0, demae: 0, menu: 0, rocket: 0, other: 0 },
  };
}

function totalServiceDeliveries(record: StoredRecord) {
  return SERVICE_LABELS.reduce(
    (sum, service) => sum + safeNumber(record.services?.[service.key]?.deliveries),
    0
  );
}

function aggregateMonth(records: StoredRecord[], month: string) {
  const seen = new Set<string>();
  const map = new Map<string, DaySummary>();

  for (const record of records) {
    if (record.hidden === true || !record.date.startsWith(month)) continue;
    const key = [
      record.date,
      record.updatedAt ?? "",
      safeNumber(record.total),
      safeNumber(record.workMinutes),
      totalServiceDeliveries(record),
    ].join("|");
    if (seen.has(key)) continue;
    seen.add(key);

    const current = map.get(record.date) ?? emptySummary(record.date);
    current.total += safeNumber(record.total);
    current.workMinutes += safeNumber(record.workMinutes);
    current.deliveries += totalServiceDeliveries(record);
    for (const service of SERVICE_LABELS) {
      current.services[service.key] += safeNumber(record.services?.[service.key]?.amount);
    }
    map.set(record.date, current);
  }

  return map;
}

function hourly(total: number, workMinutes: number) {
  if (workMinutes <= 0) return 0;
  return Math.floor(total / (workMinutes / 60));
}

function rateText(total: number, target: number) {
  if (target <= 0) return "-";
  return `${Math.min(999, Math.floor((total / target) * 100))}%`;
}

function monthProgressRate(month: string) {
  const today = new Date();
  const currentMonth = monthKey(today);
  const totalDays = daysInMonth(month);
  if (month < currentMonth) return 100;
  if (month > currentMonth) return 0;
  return Math.min(100, Math.floor((today.getDate() / totalDays) * 100));
}

function remainingDaysFromToday(month: string) {
  const today = new Date();
  if (month !== monthKey(today)) return 0;
  return Math.max(daysInMonth(month) - today.getDate() + 1, 1);
}

function supportComment(target: number, actual: number) {
  if (target <= 0) return "今日の目標を入れてみよう";
  if (actual >= target) return "達成！いい感じです";
  if (actual > 0) return "あと少しずつ積み上げよう";
  return "今日の1件からスタートしよう";
}

export default function GoalDashboard({ records, currentMonth, onChangeMonth }: Props) {
  const month = monthKey(currentMonth);
  const today = toIsoDate(new Date());
  const [plan, setPlan] = useState<MonthlyGoalPlan | null>(null);
  const [bulkInput, setBulkInput] = useState("20000");
  const [confirmBulk, setConfirmBulk] = useState(false);
  const [bulkMessage, setBulkMessage] = useState("");
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [detailTargetInput, setDetailTargetInput] = useState("");
  const [detailMessage, setDetailMessage] = useState("");

  useEffect(() => {
    const load = () => {
      setPlan(getMonthlyGoal(month));
      setBulkMessage("");
      setConfirmBulk(false);
    };
    const timer = window.setTimeout(load, 0);
    window.addEventListener("ubalog-goals-updated", load);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("ubalog-goals-updated", load);
    };
  }, [month]);

  const goalMap = useMemo(() => goalMapFromPlan(plan), [plan]);
  const summaries = useMemo(() => aggregateMonth(records, month), [month, records]);
  const calendarCells = useMemo(() => buildCalendarCells(month), [month]);
  const monthDates = useMemo(() => datesInMonth(month), [month]);
  const todaySummary = summaries.get(today) ?? emptySummary(today);
  const todayTarget = goalMap.get(today) ?? 0;
  const selectedSummary = selectedDate
    ? summaries.get(selectedDate) ?? emptySummary(selectedDate)
    : null;
  const selectedTarget = selectedDate ? goalMap.get(selectedDate) ?? 0 : 0;
  const monthTarget = monthlyTargetFromGoals(plan);
  const monthTotal = monthDates.reduce(
    (sum, date) => sum + (summaries.get(date)?.total ?? 0),
    0
  );
  const remainingMonthAmount = Math.max(monthTarget - monthTotal, 0);
  const remainingDays = remainingDaysFromToday(month);
  const neededDailyAmount =
    month === today.slice(0, 7) && monthTarget > 0
      ? monthTotal >= monthTarget
        ? 0
        : Math.ceil(remainingMonthAmount / remainingDays)
      : 0;

  const openDetail = (date: string) => {
    setSelectedDate(date);
    setDetailTargetInput(String(goalMap.get(date) ?? ""));
    setDetailMessage("");
  };

  const applyBulkGoals = () => {
    const amount = parseAmount(bulkInput);
    const nextGoals = new Map(goalMap);
    for (const date of monthDates) nextGoals.set(date, amount);
    const nextPlan = createPlanWithDailyGoals(month, plan, nextGoals);
    saveMonthlyGoal(nextPlan);
    setPlan(nextPlan);
    setConfirmBulk(false);
    setBulkMessage("目標を入れました");
  };

  const saveDetailGoal = () => {
    if (!selectedDate) return;
    const amount = parseAmount(detailTargetInput);
    updateDailyGoal(month, selectedDate, amount);
    const nextGoals = new Map(goalMap);
    nextGoals.set(selectedDate, amount);
    const nextPlan = createPlanWithDailyGoals(month, plan, nextGoals);
    setPlan(nextPlan);
    setDetailTargetInput(amount > 0 ? String(amount) : "");
    setDetailMessage("保存しました");
  };

  const deleteDetailGoal = () => {
    if (!selectedDate) return;
    const nextGoals = new Map(goalMap);
    nextGoals.delete(selectedDate);
    const nextPlan = createPlanWithDailyGoals(month, plan, nextGoals);
    saveMonthlyGoal(nextPlan);
    setPlan(nextPlan);
    setDetailTargetInput("");
    setDetailMessage("目標を削除しました");
  };

  return (
    <div className="space-y-3">
      <section className="rounded-2xl bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3">
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
            aria-label="翌月"
          >
            ›
          </button>
        </div>

        <div className="mt-3 rounded-2xl bg-green-50 px-3 py-3">
          <div className="text-xs font-black text-green-800">今日の目標</div>
          {todayTarget > 0 ? (
            <div className="mt-1 text-xs font-bold leading-5 text-green-900">
              目標 {formatCurrency(todayTarget)} / 売上 {formatCurrency(todaySummary.total)}
              <br />
              あと {formatCurrency(Math.max(todayTarget - todaySummary.total, 0))}
            </div>
          ) : (
            <div className="mt-1 text-xs font-bold text-green-900">
              今日の目標を入れてみよう
            </div>
          )}
        </div>
      </section>

      <section className="rounded-2xl bg-white p-4 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-sm font-black text-gray-900">とりま入れとく？</div>
            <div className="mt-1 text-xs font-bold leading-5 text-gray-500">
              今月の各日に、まとめて1日の目標を入れられます。
            </div>
          </div>
          <div className="shrink-0 rounded-full bg-gray-50 px-2 py-1 text-[10px] font-black text-gray-500">
            月合計 {formatCurrency(monthTarget)}
          </div>
        </div>

        <div className="mt-3 flex min-w-0 items-center gap-2">
          <div className="flex h-11 min-w-0 flex-1 items-center rounded-xl border border-gray-200 bg-gray-50 px-3 focus-within:border-green-500 focus-within:ring-2 focus-within:ring-green-100">
            <span className="shrink-0 text-sm font-bold text-gray-500">¥</span>
            <input
              type="text"
              inputMode="numeric"
              value={bulkInput}
              onChange={(event) => setBulkInput(String(parseAmount(event.target.value) || ""))}
              className="min-w-0 flex-1 bg-transparent px-2 text-right text-sm font-black outline-none"
              aria-label="1日の目標"
            />
          </div>
          <button
            type="button"
            onClick={() => setConfirmBulk(true)}
            className="h-11 shrink-0 rounded-xl bg-green-600 px-3 text-xs font-black text-white active:bg-green-700"
          >
            1日 {formatCurrency(parseAmount(bulkInput))}で入れる
          </button>
        </div>

        {confirmBulk && (
          <div className="mt-3 rounded-xl bg-amber-50 px-3 py-3">
            <div className="text-xs font-bold leading-5 text-amber-800">
              表示中の月に、1日 {formatCurrency(parseAmount(bulkInput))} の目標をまとめて入れますか？
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setConfirmBulk(false)}
                className="h-9 rounded-xl bg-white text-xs font-black text-gray-600 ring-1 ring-gray-200"
              >
                やめる
              </button>
              <button
                type="button"
                onClick={applyBulkGoals}
                className="h-9 rounded-xl bg-green-600 text-xs font-black text-white"
              >
                入れる
              </button>
            </div>
          </div>
        )}

        {bulkMessage && (
          <div className="mt-3 rounded-xl bg-green-50 px-3 py-2 text-center text-xs font-bold text-green-700">
            {bulkMessage}
          </div>
        )}
      </section>

      <section className="rounded-2xl bg-white p-3 shadow-sm">
        <div className="mb-2 flex items-center justify-between gap-2 text-[10px] font-black">
          <div className="text-blue-600">青: 目標</div>
          <div className="text-green-700">緑: 売上</div>
        </div>
        <div className="mb-2 grid grid-cols-7 gap-1 text-center text-[10px] font-black text-gray-500">
          {["月", "火", "水", "木", "金", "土", "日"].map((day) => (
            <div key={day}>{day}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {calendarCells.map((date, index) => {
            if (!date) return <div key={`blank-${index}`} className="aspect-[0.82]" />;
            const summary = summaries.get(date) ?? emptySummary(date);
            const target = goalMap.get(date) ?? 0;
            const achieved = target > 0 && summary.total >= target;
            const isFuture = date > today;
            return (
              <button
                key={date}
                type="button"
                onClick={() => openDetail(date)}
                className={`min-w-0 rounded-lg border px-1 py-1 text-left ${
                  achieved
                    ? "border-green-200 bg-green-50"
                    : isFuture
                    ? "border-gray-100 bg-gray-50 text-gray-400"
                    : "border-gray-100 bg-white"
                }`}
              >
                <div className="text-[10px] font-black">{Number(date.slice(8, 10))}</div>
                <div className="mt-0.5 whitespace-nowrap text-[9px] font-black leading-tight text-blue-600">
                  {target > 0 ? formatShortCurrency(target) : "-"}
                </div>
                <div className="whitespace-nowrap text-[9px] font-black leading-tight text-green-700">
                  {summary.total > 0 ? formatShortCurrency(summary.total) : "0"}
                </div>
              </button>
            );
          })}
        </div>
        <div className="mt-3 rounded-xl bg-gray-50 px-3 py-2 text-xs font-black text-gray-700">
          {supportComment(todayTarget, todaySummary.total)}
        </div>
      </section>

      <GoalProgressSummary
        monthTarget={monthTarget}
        monthTotal={monthTotal}
        progressRate={monthProgressRate(month)}
        remainingAmount={remainingMonthAmount}
        neededDailyAmount={neededDailyAmount}
        isCurrentMonth={month === today.slice(0, 7)}
      />

      <GoalTable
        dates={monthDates}
        goals={goalMap}
        summaries={summaries}
      />

      {selectedDate && selectedSummary && (
        <DayDetailSheet
          date={selectedDate}
          target={selectedTarget}
          summary={selectedSummary}
          targetInput={detailTargetInput}
          message={detailMessage}
          onChangeTarget={(value) => setDetailTargetInput(String(parseAmount(value) || ""))}
          onSave={saveDetailGoal}
          onDelete={deleteDetailGoal}
          onClose={() => setSelectedDate(null)}
        />
      )}
    </div>
  );
}

function GoalProgressSummary({
  monthTarget,
  monthTotal,
  progressRate,
  remainingAmount,
  neededDailyAmount,
  isCurrentMonth,
}: {
  monthTarget: number;
  monthTotal: number;
  progressRate: number;
  remainingAmount: number;
  neededDailyAmount: number;
  isCurrentMonth: boolean;
}) {
  const achievementRate = monthTarget > 0 ? Math.floor((monthTotal / monthTarget) * 100) : 0;

  return (
    <section className="rounded-2xl bg-white p-4 shadow-sm">
      <div className="text-sm font-black text-gray-900">月の目標状況</div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <MiniStat label="月間目標" value={monthTarget > 0 ? formatCurrency(monthTarget) : "-"} />
        <MiniStat label="現在売上" value={formatCurrency(monthTotal)} />
        <MiniStat label="達成率" value={monthTarget > 0 ? `${achievementRate}%` : "-"} />
        <MiniStat label="月進捗" value={`${progressRate}%`} />
        <MiniStat label="あと" value={formatCurrency(remainingAmount)} />
        <MiniStat
          label="今日から"
          value={
            !isCurrentMonth
              ? "-"
              : monthTarget > 0 && remainingAmount <= 0
              ? "達成済み"
              : monthTarget > 0
              ? `${formatCurrency(neededDailyAmount)}/日`
              : "-"
          }
        />
      </div>
    </section>
  );
}

function GoalTable({
  dates,
  goals,
  summaries,
}: {
  dates: string[];
  goals: Map<string, number>;
  summaries: Map<string, DaySummary>;
}) {
  return (
    <section className="rounded-2xl bg-white p-4 shadow-sm">
      <div className="text-sm font-black text-gray-900">目標テーブル</div>
      <div className="mt-3 overflow-x-auto rounded-xl border border-gray-100">
        <table className="min-w-[620px] border-collapse bg-white text-[11px]">
          <thead className="bg-gray-100 text-gray-600">
            <tr>
              {["日付", "目標", "売上", "達成率", "稼働", "時給", "件数"].map((label) => (
                <th key={label} className="border-b border-gray-200 px-2 py-2 text-right font-black first:text-left">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {dates.map((date) => {
              const summary = summaries.get(date) ?? emptySummary(date);
              const target = goals.get(date) ?? 0;
              return (
                <tr key={date} className="odd:bg-white even:bg-gray-50">
                  <td className="border-b border-gray-100 px-2 py-2 text-left font-bold">
                    {date.slice(5).replace("-", "/")}
                  </td>
                  <td className="border-b border-gray-100 px-2 py-2 text-right font-bold">
                    {target > 0 ? formatCurrency(target) : "-"}
                  </td>
                  <td className="border-b border-gray-100 px-2 py-2 text-right font-bold">
                    {formatCurrency(summary.total)}
                  </td>
                  <td className="border-b border-gray-100 px-2 py-2 text-right font-bold">
                    {rateText(summary.total, target)}
                  </td>
                  <td className="border-b border-gray-100 px-2 py-2 text-right font-bold">
                    {formatMinutes(summary.workMinutes)}
                  </td>
                  <td className="border-b border-gray-100 px-2 py-2 text-right font-bold">
                    {hourly(summary.total, summary.workMinutes) > 0
                      ? formatCurrency(hourly(summary.total, summary.workMinutes))
                      : "-"}
                  </td>
                  <td className="border-b border-gray-100 px-2 py-2 text-right font-bold">
                    {summary.deliveries.toLocaleString()}件
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="mt-2 text-[11px] font-bold text-gray-500">
        表の中だけ横にスライドできます
      </div>
    </section>
  );
}

function DayDetailSheet({
  date,
  target,
  summary,
  targetInput,
  message,
  onChangeTarget,
  onSave,
  onDelete,
  onClose,
}: {
  date: string;
  target: number;
  summary: DaySummary;
  targetInput: string;
  message: string;
  onChangeTarget: (value: string) => void;
  onSave: () => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const remaining = Math.max(target - summary.total, 0);
  const hourlyAmount = hourly(summary.total, summary.workMinutes);

  return (
    <div className="fixed inset-0 z-[60] bg-black/30 px-4 py-6" onClick={onClose}>
      <div
        className="mx-auto max-h-[calc(100dvh-3rem)] w-full max-w-[430px] overflow-y-auto rounded-2xl bg-white p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-base font-black text-gray-900">{date.replaceAll("-", "/")}</div>
            <div className="mt-1 text-xs font-bold text-gray-500">日別目標と実績</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-gray-100 px-3 py-1.5 text-xs font-black text-gray-600"
          >
            閉じる
          </button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <MiniStat label="目標" value={target > 0 ? formatCurrency(target) : "目標未設定"} />
          <MiniStat label="売上" value={formatCurrency(summary.total)} />
          <MiniStat label="達成率" value={rateText(summary.total, target)} />
          <MiniStat label="目標まであと" value={formatCurrency(remaining)} />
          <MiniStat label="稼働時間" value={formatMinutes(summary.workMinutes)} />
          <MiniStat label="時給" value={hourlyAmount > 0 ? formatCurrency(hourlyAmount) : "-"} />
          <MiniStat label="件数" value={`${summary.deliveries.toLocaleString()}件`} />
        </div>

        <div className="mt-4 rounded-2xl bg-gray-50 p-3">
          <div className="text-sm font-black text-gray-900">サービス別売上</div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {SERVICE_LABELS.map((service) => (
              <MiniStat
                key={service.key}
                label={service.label}
                value={formatCurrency(summary.services[service.key])}
              />
            ))}
          </div>
        </div>

        <div className="mt-4 rounded-2xl bg-green-50 p-3">
          <label className="block">
            <span className="text-sm font-black text-green-900">この日の目標</span>
            <div className="mt-2 flex min-w-0 items-center gap-2">
              <div className="flex h-11 min-w-0 flex-1 items-center rounded-xl border border-green-100 bg-white px-3">
                <span className="shrink-0 text-sm font-bold text-gray-500">¥</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={targetInput}
                  onChange={(event) => onChangeTarget(event.target.value)}
                  className="min-w-0 flex-1 bg-transparent px-2 text-right text-sm font-black outline-none"
                />
              </div>
              <button
                type="button"
                onClick={onSave}
                className="h-11 shrink-0 rounded-xl bg-green-600 px-3 text-sm font-black text-white"
              >
                保存
              </button>
              <button
                type="button"
                onClick={onDelete}
                className="h-11 shrink-0 rounded-xl bg-red-500 px-3 text-sm font-black text-white"
              >
                削除
              </button>
            </div>
          </label>
          {message && (
            <div className="mt-2 rounded-xl bg-white px-3 py-2 text-center text-xs font-bold text-green-700">
              {message}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-xl bg-white px-3 py-2 ring-1 ring-gray-100">
      <div className="truncate text-[11px] font-bold text-gray-500">{label}</div>
      <div className="mt-1 truncate text-sm font-black text-gray-900">{value}</div>
    </div>
  );
}
