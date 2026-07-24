"use client";

import { useEffect, useMemo, useState } from "react";
import {
  getActiveUser,
  ensureActiveUserFromProfile,
  type UbalogUser,
} from "@/lib/users";
import { getMonthlyGoal, type MonthlyGoalPlan } from "@/lib/goals";
import { fetchSharedRecords, mergeRecords, type SharedRecord } from "@/lib/sharedRecords";

const RECORDS_STORAGE_KEY = "ubalog-records";
const PROFILE_STORAGE_KEY = "ubalog-profile";
const SHOW_GOALS_KEY = "ubalog-record-calendar-show-goals";

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

function formatPlainAmount(amount: number) {
  if (amount <= 0) return "-";
  return String(Math.floor(amount));
}

function safeNumber(value: unknown) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) && numberValue > 0 ? numberValue : 0;
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

      <div className="mt-2">
        <div className="mb-1 grid grid-cols-7 gap-1 text-center text-[11px] font-black tracking-tight text-gray-400">
          {["月", "火", "水", "木", "金", "土", "日"].map((day) => (
            <div key={day}>{day}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {calendarCells.map((date, index) => {
            if (!date) return <div key={`blank-${index}`} className="min-h-[62px]" />;
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
                }}
                className={`min-h-[62px] min-w-0 rounded-xl border px-1 py-1.5 text-left tracking-tight ${
                  isSelected
                    ? "border-green-600 bg-green-50 ring-2 ring-green-100"
                    : achieved
                    ? "border-green-200 bg-green-50"
                    : "border-gray-100 bg-white"
                } ${isToday ? "outline outline-2 outline-offset-0 outline-amber-400" : ""}`}
              >
                <div className={`text-[12px] font-black leading-tight ${isToday ? "text-amber-700" : "text-gray-900"}`}>
                  {Number(date.slice(8, 10))}
                </div>
                {showGoals && (
                  <div className="mt-1 whitespace-nowrap text-[9px] font-black leading-tight text-blue-600">
                    {target > 0 ? formatPlainAmount(target) : "-"}
                  </div>
                )}
                <div className="whitespace-nowrap text-[9px] font-black leading-tight text-green-700">
                  {summary.total > 0 ? formatPlainAmount(summary.total) : "0"}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-2 flex justify-center">
        <button
          type="button"
          onClick={toggleGoals}
          className="rounded-full bg-green-50 px-4 py-2 text-xs font-black text-green-700 ring-1 ring-green-100 active:bg-green-100"
          aria-label="目標表示切替"
        >
          {showGoals ? "目標表示 ON" : "目標表示 OFF"}
        </button>
      </div>
    </section>
  );
}
