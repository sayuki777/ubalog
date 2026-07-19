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

function shortDate(iso: string) {
  const [, month, day] = iso.split("-");
  return `${Number(month)}/${Number(day)}`;
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

function safeServiceAmount(record: StoredRecord, key: ServiceKey) {
  return safeNumber(record.services?.[key]?.amount);
}

function monthRange(base: Date, diffMonths: number) {
  const target = new Date(base.getFullYear(), base.getMonth() + diffMonths, 1);
  return {
    key: monthKey(target),
    label: diffMonths === 0 ? "今月" : diffMonths === -1 ? "前月" : "前々月",
  };
}

function serviceSales(records: StoredRecord[]) {
  const items: { key: ServiceKey; label: string; amount: number }[] = [
    { key: "uber", label: "Uber", amount: 0 },
    { key: "demae", label: "出前館", amount: 0 },
    { key: "rocket", label: "ロケナウ", amount: 0 },
    { key: "menu", label: "menu", amount: 0 },
    { key: "other", label: "その他", amount: 0 },
  ];

  return items
    .map((item) => ({
      ...item,
      amount: records.reduce((sum, record) => sum + safeServiceAmount(record, item.key), 0),
    }))
    .sort((a, b) => b.amount - a.amount);
}

export default function RecordStatsGoalsPanel() {
  const [records, setRecords] = useState<StoredRecord[]>([]);
  const [activeUser, setActiveUser] = useState<UbalogUser | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [currentMonth, setCurrentMonth] = useState(() => new Date());
  const month = monthKey(currentMonth);

  useEffect(() => {
    const load = () => {
      const nextProfile = loadProfile();
      ensureActiveUserFromProfile(nextProfile);
      const user = getActiveUser();
      setActiveUser(user);
      setProfile(nextProfile);
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
      ? records.filter((record) => recordBelongsToUser(record, activeUser, profile))
      : records;
    return dedupeRecords(filtered);
  }, [activeUser, profile, records]);

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
  const bestRecord =
    [...monthRecords].sort((a, b) => safeNumber(b.total) - safeNumber(a.total))[0] ?? null;
  const services = serviceSales(monthRecords);
  const maxServiceAmount = Math.max(...services.map((service) => service.amount), 1);
  const monthlySales = [0, -1, -2].map((diff) => {
    const range = monthRange(currentMonth, diff);
    return {
      label: range.label,
      amount: personalRecords
        .filter((record) => record.date.startsWith(range.key))
        .reduce((sum, record) => sum + safeNumber(record.total), 0),
    };
  });
  const changeMonth = (diff: number) => {
    setCurrentMonth(
      (current) => new Date(current.getFullYear(), current.getMonth() + diff, 1)
    );
  };

  return (
    <div className="mt-4 space-y-3 pb-32">
      <section className="rounded-2xl bg-white p-4 shadow-sm">
        <div className="text-sm font-black text-gray-900">個人成績</div>
        <div className="mt-1 text-xs font-bold text-gray-500">
          マイページと同じ記録データで集計しています
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <MiniStat label="今月の売上" value={formatCurrency(monthTotal)} strong />
          <MiniStat label="稼働日数" value={`${activeDays}日`} />
          <MiniStat label="日給平均" value={formatCurrency(dailyAverage)} />
          <MiniStat label="前月比" value={compareText} />
          <MiniStat label="件数" value={`${deliveries.toLocaleString()}件`} />
          <MiniStat label="記録日" value={`${monthRecords.length}日分`} />
        </div>

        <div className="mt-3 rounded-2xl bg-amber-50 px-3 py-3">
          <div className="text-xs font-black text-amber-700">今月の最高売上日</div>
          {bestRecord ? (
            <div className="mt-2 flex items-center justify-between gap-3">
              <div className="text-sm font-black text-gray-950">{shortDate(bestRecord.date)}</div>
              <div className="text-lg font-black text-gray-950">
                {formatCurrency(safeNumber(bestRecord.total))}
              </div>
            </div>
          ) : (
            <div className="mt-2 text-xs font-bold text-gray-500">まだ記録がありません</div>
          )}
        </div>
      </section>

      <section className="rounded-2xl bg-white p-4 shadow-sm">
        <div className="text-sm font-black text-gray-900">サービス別売上</div>
        <div className="mt-3 space-y-2">
          {services.map((service) => (
            <div key={service.key} className="min-w-0">
              <div className="flex items-center justify-between gap-3 text-xs font-bold">
                <span className="text-gray-600">{service.label}</span>
                <span className={service.amount > 0 ? "text-gray-900" : "text-gray-400"}>
                  {formatCurrency(service.amount)}
                </span>
              </div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-gray-100">
                <div
                  className="h-full rounded-full bg-green-500"
                  style={{ width: `${Math.round((service.amount / maxServiceAmount) * 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl bg-white p-4 shadow-sm">
        <div className="text-sm font-black text-gray-900">月間売上</div>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {monthlySales.map((item) => (
            <div key={item.label} className="min-w-0 rounded-2xl bg-gray-50 px-2 py-3 text-center">
              <div className="text-xs font-bold text-gray-500">{item.label}</div>
              <div className="mt-1 truncate text-sm font-black text-gray-900">
                {formatCurrency(item.amount)}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl bg-white p-4 shadow-sm">
        <div className="mb-3 text-sm font-black text-gray-900">目標</div>
        <GoalDashboard
          records={personalRecords}
          currentMonth={currentMonth}
          onChangeMonth={changeMonth}
        />
      </section>
    </div>
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
