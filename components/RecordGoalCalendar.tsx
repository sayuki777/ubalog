"use client";

import { useEffect, useMemo, useState } from "react";
import {
  getActiveUser,
  ensureActiveUserFromProfile,
  type UbalogUser,
} from "@/lib/users";
import {
  getMonthlyGoal,
  saveMonthlyGoal,
  updateDailyGoal,
  type MonthlyGoalPlan,
} from "@/lib/goals";
import { fetchSharedRecords, mergeRecords, type SharedRecord } from "@/lib/sharedRecords";

const RECORDS_STORAGE_KEY = "ubalog-records";
const PROFILE_STORAGE_KEY = "ubalog-profile";
const SHOW_GOALS_KEY = "ubalog-record-calendar-show-goals";
const MAX_DAILY_TARGET = 100000;

type ServiceKey = "uber" | "demae" | "menu" | "rocket" | "other";

type StoredRecord = {
  date: string;
  userId?: string;
  name?: string;
  displayName?: string;
  rankingName?: string;
  nickname?: string;
  total?: number;
  workMinutes?: number;
  hidden?: boolean;
  updatedAt?: string;
  services?: Partial<Record<ServiceKey, { amount?: number; deliveries?: number }>>;
};

type Profile = {
  displayName?: string;
  name?: string;
  nickname?: string;
  rankingName?: string;
};

type DaySummary = {
  total: number;
  workMinutes: number;
  deliveries: number;
};

function toIsoDate(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function todayIsoDate() {
  return toIsoDate(new Date());
}

function monthKeyFromIso(date: string) {
  return date.slice(0, 7);
}

function dateFromIso(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(year, month - 1, day);
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
  const firstDay = dateFromIso(`${month}-01`);
  const mondayOffset = (firstDay.getDay() + 6) % 7;
  const cells: (string | null)[] = Array.from({ length: mondayOffset }, () => null);
  cells.push(...dates);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function formatMonthLabel(month: string) {
  const [, monthNumber] = month.split("-").map(Number);
  return `${Number(month.slice(0, 4))}年${monthNumber}月`;
}

function formatCurrency(amount: number) {
  return `¥${Math.max(0, Math.floor(amount)).toLocaleString()}`;
}

function formatPlainAmount(amount: number) {
  if (amount <= 0) return "-";
  return String(Math.floor(amount));
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

function parseAmount(value: string) {
  const amount = parseInt(value.replace(/[^\d]/g, "") || "0", 10) || 0;
  return Math.min(Math.max(Math.floor(amount), 0), MAX_DAILY_TARGET);
}

function totalDeliveries(record: StoredRecord) {
  const keys: ServiceKey[] = ["uber", "demae", "menu", "rocket", "other"];
  return keys.reduce(
    (sum, key) => sum + safeNumber(record.services?.[key]?.deliveries),
    0
  );
}

function emptySummary(): DaySummary {
  return { total: 0, workMinutes: 0, deliveries: 0 };
}

function loadProfile(): Profile | null {
  const raw = localStorage.getItem(PROFILE_STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Profile;
  } catch {
    return null;
  }
}

function loadRecords(): StoredRecord[] {
  const raw = localStorage.getItem(RECORDS_STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as StoredRecord[]) : [];
  } catch {
    return [];
  }
}

function recordBelongsToUser(record: StoredRecord, user: UbalogUser | null, profile: Profile | null) {
  if (!user) return true;
  if (record.userId) return record.userId === user.id;
  const names = [
    user.name,
    profile?.displayName,
    profile?.rankingName,
    profile?.nickname,
    profile?.name,
  ]
    .map((name) => name?.trim())
    .filter(Boolean);
  return Boolean(record.name?.trim() && names.includes(record.name.trim()));
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
    if (
      nextTime > currentTime ||
      (nextTime === currentTime && safeNumber(record.total) > safeNumber(current.total))
    ) {
      map.set(record.date, record);
    }
  }
  return [...map.values()];
}

function goalMapFromPlan(plan: MonthlyGoalPlan | null) {
  const map = new Map<string, number>();
  for (const goal of plan?.dailyGoals ?? []) {
    map.set(goal.date, Math.max(0, Math.floor(goal.targetAmount)));
  }
  return map;
}

function createPlanWithGoals(
  month: string,
  current: MonthlyGoalPlan | null,
  goals: Map<string, number>
): MonthlyGoalPlan {
  const now = new Date().toISOString();
  return {
    month,
    weekdayTarget: current?.weekdayTarget ?? 0,
    holidayTarget: current?.holidayTarget ?? 0,
    dailyGoals: datesInMonth(month)
      .map((date) => ({
        date,
        targetAmount: Math.max(0, Math.floor(goals.get(date) ?? 0)),
        updatedAt: now,
      }))
      .filter((goal) => goal.targetAmount > 0),
    updatedAt: now,
  };
}

function aggregateByDate(records: StoredRecord[], month: string) {
  const map = new Map<string, DaySummary>();
  for (const record of records) {
    if (record.hidden === true || !record.date.startsWith(month)) continue;
    const current = map.get(record.date) ?? emptySummary();
    current.total += safeNumber(record.total);
    current.workMinutes += safeNumber(record.workMinutes);
    current.deliveries += totalDeliveries(record);
    map.set(record.date, current);
  }
  return map;
}

export default function RecordGoalCalendar({
  selectedDate,
  onSelectDate,
}: {
  selectedDate: string;
  onSelectDate: (date: string) => void;
}) {
  const [records, setRecords] = useState<StoredRecord[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [activeUser, setActiveUser] = useState<UbalogUser | null>(null);
  const [plan, setPlan] = useState<MonthlyGoalPlan | null>(null);
  const [targetInput, setTargetInput] = useState("");
  const [message, setMessage] = useState("");
  const [showGoals, setShowGoals] = useState(() => {
    if (typeof window === "undefined") return true;
    return localStorage.getItem(SHOW_GOALS_KEY) !== "false";
  });
  const month = monthKeyFromIso(selectedDate);
  const today = todayIsoDate();

  useEffect(() => {
    const load = () => {
      const nextProfile = loadProfile();
      ensureActiveUserFromProfile(nextProfile);
      const user = getActiveUser();
      const localRecords = loadRecords();
      setProfile(nextProfile);
      setActiveUser(user);
      setRecords(localRecords.filter((record) => record.hidden !== true));
      void fetchSharedRecords()
        .then((remoteRecords) => {
          if (remoteRecords.length === 0) return;
          setRecords(
            (
              mergeRecords(
                localRecords as unknown as SharedRecord[],
                remoteRecords
              ) as unknown as StoredRecord[]
            ).filter((record) => record.hidden !== true)
          );
        })
        .catch(() => {
          setRecords(localRecords.filter((record) => record.hidden !== true));
        });
    };

    load();
    window.addEventListener("focus", load);
    window.addEventListener("ubalog-records-updated", load);
    window.addEventListener("ubalog-profile-updated", load);
    return () => {
      window.removeEventListener("focus", load);
      window.removeEventListener("ubalog-records-updated", load);
      window.removeEventListener("ubalog-profile-updated", load);
    };
  }, []);

  useEffect(() => {
    const loadGoal = () => {
      const nextPlan = getMonthlyGoal(month);
      setPlan(nextPlan);
      const target = nextPlan?.dailyGoals.find((goal) => goal.date === selectedDate)?.targetAmount ?? 0;
      setTargetInput(target > 0 ? String(target) : "");
    };
    loadGoal();
    window.addEventListener("ubalog-goals-updated", loadGoal);
    return () => window.removeEventListener("ubalog-goals-updated", loadGoal);
  }, [month, selectedDate]);

  const personalRecords = useMemo(() => {
    const filtered = activeUser
      ? records.filter((record) => recordBelongsToUser(record, activeUser, profile))
      : records;
    return dedupeRecords(filtered);
  }, [activeUser, profile, records]);
  const summaries = useMemo(() => aggregateByDate(personalRecords, month), [month, personalRecords]);
  const goals = useMemo(() => goalMapFromPlan(plan), [plan]);
  const calendarCells = useMemo(() => buildCalendarCells(month), [month]);
  const selectedSummary = summaries.get(selectedDate) ?? emptySummary();
  const selectedTarget = goals.get(selectedDate) ?? 0;
  const selectedRemaining = Math.max(selectedTarget - selectedSummary.total, 0);
  const selectedRate =
    selectedTarget > 0 ? `${Math.min(999, Math.floor((selectedSummary.total / selectedTarget) * 100))}%` : "-";

  const toggleGoals = () => {
    const next = !showGoals;
    setShowGoals(next);
    localStorage.setItem(SHOW_GOALS_KEY, String(next));
  };

  const changeMonth = (diff: number) => {
    const next = dateFromIso(`${month}-01`);
    next.setMonth(next.getMonth() + diff);
    onSelectDate(toIsoDate(next));
  };

  const saveTarget = () => {
    const amount = parseAmount(targetInput);
    updateDailyGoal(month, selectedDate, amount);
    setMessage("目標を保存しました");
  };

  const deleteTarget = () => {
    const nextGoals = new Map(goals);
    nextGoals.delete(selectedDate);
    const nextPlan = createPlanWithGoals(month, plan, nextGoals);
    saveMonthlyGoal(nextPlan);
    setPlan(nextPlan);
    setTargetInput("");
    setMessage("目標を削除しました");
  };

  return (
    <section className="-mx-3 mt-3 overflow-hidden rounded-2xl bg-white p-2 shadow-sm">
      <div className="flex items-center justify-between gap-2 px-1">
        <button
          type="button"
          onClick={() => changeMonth(-1)}
          className="flex h-8 w-8 items-center justify-center rounded-full border border-green-100 text-lg font-black text-green-700"
          aria-label="前月"
        >
          ‹
        </button>
        <div className="text-sm font-black text-gray-900">{formatMonthLabel(month)}</div>
        <button
          type="button"
          onClick={() => changeMonth(1)}
          className="flex h-8 w-8 items-center justify-center rounded-full border border-green-100 text-lg font-black text-green-700"
          aria-label="翌月"
        >
          ›
        </button>
      </div>

      <div className="relative mt-2 pr-6">
        <button
          type="button"
          onClick={toggleGoals}
          className="absolute right-0 top-8 z-10 flex h-24 w-5 flex-col items-center justify-center rounded-l-lg bg-green-600 text-[9px] font-black leading-tight text-white shadow-sm active:bg-green-700"
          aria-label="目標表示切替"
        >
          <span>目標</span>
          <span>{showGoals ? "ON" : "OFF"}</span>
        </button>

        <div className="mb-1 grid grid-cols-7 gap-1 text-center text-[10px] font-black text-gray-400">
          {["月", "火", "水", "木", "金", "土", "日"].map((day) => (
            <div key={day}>{day}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {calendarCells.map((date, index) => {
            if (!date) return <div key={`blank-${index}`} className="min-h-[52px]" />;
            const summary = summaries.get(date) ?? emptySummary();
            const target = goals.get(date) ?? 0;
            const isToday = date === today;
            const isSelected = date === selectedDate;
            const achieved = target > 0 && summary.total >= target;
            return (
              <button
                key={date}
                type="button"
                onClick={() => {
                  onSelectDate(date);
                  setMessage("");
                }}
                className={`min-h-[52px] min-w-0 rounded-lg border px-0.5 py-1 text-left ${
                  isSelected
                    ? "border-green-600 bg-green-50 ring-2 ring-green-100"
                    : achieved
                    ? "border-green-200 bg-green-50"
                    : "border-gray-100 bg-white"
                } ${isToday ? "outline outline-2 outline-offset-0 outline-amber-400" : ""}`}
              >
                <div className={`text-[10px] font-black ${isToday ? "text-amber-700" : "text-gray-900"}`}>
                  {Number(date.slice(8, 10))}
                </div>
                {showGoals && (
                  <div className="mt-0.5 whitespace-nowrap text-[8px] font-black leading-tight text-blue-600">
                    {target > 0 ? formatPlainAmount(target) : "-"}
                  </div>
                )}
                <div className="whitespace-nowrap text-[8px] font-black leading-tight text-green-700">
                  {summary.total > 0 ? formatPlainAmount(summary.total) : "0"}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-3 rounded-2xl bg-gray-50 p-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="text-sm font-black text-gray-900">{selectedDate.replaceAll("-", "/")}</div>
            <div className="mt-1 text-[11px] font-bold text-gray-500">
              この日付を記録フォームに反映しています
            </div>
          </div>
          <div className="rounded-full bg-white px-2 py-1 text-[10px] font-black text-green-700">
            達成率 {selectedRate}
          </div>
        </div>

        <div className="mt-3 flex min-w-0 items-center gap-2">
          <div className="flex h-10 min-w-0 flex-1 items-center rounded-xl border border-gray-200 bg-white px-3">
            <span className="shrink-0 text-xs font-bold text-gray-500">¥</span>
            <input
              type="text"
              inputMode="numeric"
              value={targetInput}
              onChange={(event) => setTargetInput(String(parseAmount(event.target.value) || ""))}
              className="min-w-0 flex-1 bg-transparent px-2 text-right text-sm font-black outline-none"
              aria-label="この日の目標"
            />
          </div>
          <button
            type="button"
            onClick={saveTarget}
            className="h-10 rounded-xl bg-green-600 px-3 text-xs font-black text-white"
          >
            保存
          </button>
          <button
            type="button"
            onClick={deleteTarget}
            className="h-10 rounded-xl bg-red-500 px-3 text-xs font-black text-white"
          >
            削除
          </button>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <MiniStat label="目標" value={selectedTarget > 0 ? formatCurrency(selectedTarget) : "-"} />
          <MiniStat label="売上" value={formatCurrency(selectedSummary.total)} />
          <MiniStat label="稼働" value={formatMinutes(selectedSummary.workMinutes)} />
          <MiniStat label="件数" value={`${selectedSummary.deliveries.toLocaleString()}件`} />
          <MiniStat label="あと" value={formatCurrency(selectedRemaining)} />
          <MiniStat label="達成率" value={selectedRate} />
        </div>

        {message && (
          <div className="mt-3 rounded-xl bg-white px-3 py-2 text-center text-xs font-bold text-green-700">
            {message}
          </div>
        )}
      </div>
    </section>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-xl bg-white px-3 py-2">
      <div className="truncate text-[11px] font-bold text-gray-500">{label}</div>
      <div className="mt-1 truncate text-sm font-black text-gray-900">{value}</div>
    </div>
  );
}
