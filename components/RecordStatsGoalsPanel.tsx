"use client";

import { useEffect, useMemo, useState } from "react";
import GoalDashboard from "@/components/GoalDashboard";
import { fetchSharedRecords, mergeRecords, type SharedRecord } from "@/lib/sharedRecords";
import {
  ensureActiveUserFromProfile,
  getActiveUser,
  type UbalogUser,
} from "@/lib/users";

const RECORDS_STORAGE_KEY = "ubalog-records";
const PROFILE_STORAGE_KEY = "ubalog-profile";

type ServiceKey = "uber" | "demae" | "menu" | "rocket" | "other";

type StoredRecord = {
  date: string;
  userId?: string;
  name?: string;
  total: number;
  hourly?: number;
  workMinutes?: number;
  services?: Partial<Record<ServiceKey, { amount?: number; deliveries?: number }>>;
  hidden?: boolean;
  updatedAt?: string;
};

type Profile = {
  displayName?: string;
  name?: string;
  nickname?: string;
  rankingName?: string;
};

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function formatCurrency(amount: number) {
  return `¥${Math.max(0, Math.floor(amount)).toLocaleString()}`;
}

function safeNumber(value: unknown) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) && numberValue > 0 ? numberValue : 0;
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

function recordBelongsToUser(record: StoredRecord, user: UbalogUser | null) {
  if (!user) return false;
  if (record.userId) return record.userId === user.id;
  return false;
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

function totalDeliveries(record: StoredRecord) {
  const keys: ServiceKey[] = ["uber", "demae", "menu", "rocket", "other"];
  return keys.reduce(
    (sum, key) => sum + safeNumber(record.services?.[key]?.deliveries),
    0
  );
}

export default function RecordStatsGoalsPanel() {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"score" | "goal">("score");
  const [records, setRecords] = useState<StoredRecord[]>([]);
  const [activeUser, setActiveUser] = useState<UbalogUser | null>(null);
  const [currentMonth, setCurrentMonth] = useState(() => new Date());
  const month = monthKey(new Date());

  useEffect(() => {
    const load = () => {
      const profile = loadProfile();
      ensureActiveUserFromProfile(profile);
      const user = getActiveUser();
      setActiveUser(user);
      const localRecords = loadRecords();
      setRecords(localRecords.filter((record) => record.hidden !== true));
      void fetchSharedRecords().then((remoteRecords) => {
        if (remoteRecords.length === 0) return;
        setRecords(
          (
            mergeRecords(
              localRecords as unknown as SharedRecord[],
              remoteRecords
            ) as unknown as StoredRecord[]
          ).filter((record) => record.hidden !== true)
        );
      });
    };

    const timer = window.setTimeout(load, 0);
    window.addEventListener("focus", load);
    window.addEventListener("ubalog-records-updated", load);
    window.addEventListener("ubalog-profile-updated", load);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("focus", load);
      window.removeEventListener("ubalog-records-updated", load);
      window.removeEventListener("ubalog-profile-updated", load);
    };
  }, []);

  const personalRecords = useMemo(() => {
    const filtered = activeUser
      ? records.filter((record) => recordBelongsToUser(record, activeUser))
      : records;
    return dedupeRecords(filtered);
  }, [activeUser, records]);

  const monthRecords = personalRecords.filter((record) => record.date.startsWith(month));
  const monthTotal = monthRecords.reduce((sum, record) => sum + safeNumber(record.total), 0);
  const activeDays = monthRecords.filter(
    (record) => safeNumber(record.total) > 0 || safeNumber(record.workMinutes) > 0
  ).length;
  const dailyAverage = activeDays > 0 ? Math.floor(monthTotal / activeDays) : 0;
  const deliveries = monthRecords.reduce((sum, record) => sum + totalDeliveries(record), 0);
  const previousMonthDate = new Date();
  previousMonthDate.setMonth(previousMonthDate.getMonth() - 1, 1);
  const previousMonth = monthKey(previousMonthDate);
  const previousTotal = personalRecords
    .filter((record) => record.date.startsWith(previousMonth))
    .reduce((sum, record) => sum + safeNumber(record.total), 0);
  const compareText =
    previousTotal > 0
      ? `${monthTotal >= previousTotal ? "+" : "-"}${formatCurrency(Math.abs(monthTotal - previousTotal))}`
      : "-";
  const changeMonth = (diff: number) => {
    setCurrentMonth(
      (current) => new Date(current.getFullYear(), current.getMonth() + diff, 1)
    );
  };

  return (
    <section className="mt-4 rounded-2xl bg-white p-4 shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex w-full items-center justify-between gap-3 text-left"
      >
        <div>
          <div className="text-sm font-black text-gray-900">個人成績・目標</div>
          <div className="mt-1 text-xs font-bold text-gray-500">
            今月の状況をここでも確認できます
          </div>
        </div>
        <span className="shrink-0 rounded-full bg-green-50 px-3 py-1.5 text-xs font-black text-green-700">
          {open ? "閉じる" : "見る"}
        </span>
      </button>

      {open && (
        <div className="mt-4 space-y-3">
          <div className="grid grid-cols-2 gap-1 rounded-2xl bg-gray-100 p-1">
            {[
              { key: "score", label: "個人成績" },
              { key: "goal", label: "目標" },
            ].map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key as "score" | "goal")}
                className={`h-9 rounded-xl text-xs font-black ${
                  activeTab === tab.key
                    ? "bg-green-600 text-white"
                    : "text-gray-600"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {activeTab === "score" ? (
            <div className="grid grid-cols-2 gap-2">
              <MiniStat label="今月の売上" value={formatCurrency(monthTotal)} strong />
              <MiniStat label="稼働日数" value={`${activeDays}日`} />
              <MiniStat label="日給平均" value={formatCurrency(dailyAverage)} />
              <MiniStat label="前月比" value={compareText} />
              <MiniStat label="件数" value={`${deliveries.toLocaleString()}件`} />
              <MiniStat label="記録日" value={`${monthRecords.length}日分`} />
            </div>
          ) : (
            <GoalDashboard
              records={personalRecords}
              currentMonth={currentMonth}
              onChangeMonth={changeMonth}
            />
          )}
        </div>
      )}
    </section>
  );
}

function MiniStat({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="min-w-0 rounded-xl bg-gray-50 px-3 py-2">
      <div className="truncate text-[11px] font-bold text-gray-500">{label}</div>
      <div
        className={`mt-1 truncate font-black ${
          strong ? "text-base text-gray-900" : "text-sm text-gray-800"
        }`}
      >
        {value}
      </div>
    </div>
  );
}
