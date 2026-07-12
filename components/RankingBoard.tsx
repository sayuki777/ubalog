"use client";

import { useEffect, useMemo, useState } from "react";
import AppHeader from "@/components/AppHeader";
import BottomMenu from "@/components/BottomMenu";
import { getRegionByPrefecture, PREFECTURES, REGION_OPTIONS } from "@/lib/areas";
import {
  ensureActiveUserFromProfile,
  getActiveUser,
  type UbalogUser,
} from "@/lib/users";

const RECORDS_STORAGE_KEY = "ubalog-records";
const PROFILE_STORAGE_KEY = "ubalog-profile";

type ServiceKey = "uber" | "demae" | "menu" | "rocket" | "other";
type PeriodKey = "today" | "yesterday" | "week" | "month" | "calendar";

type Profile = {
  name?: string;
  nickname?: string;
  rankingName?: string;
  prefecture?: string;
  region?: string;
  area?: string;
};

type StoredRecord = {
  date: string;
  userId?: string;
  name?: string;
  prefecture?: string;
  region?: string;
  area?: string;
  comment?: string;
  total: number;
  ranking: boolean;
  hourly: number;
  workMinutes: number;
  services: Record<ServiceKey, { amount: number; deliveries: number }>;
};

type RankingEntry = {
  key: string;
  name: string;
  prefecture: string;
  area: string;
  total: number;
  workMinutes: number;
  deliveries: number;
  hourly: number;
  comment: string;
  isCurrentUser: boolean;
};

const periodOptions: { key: PeriodKey; label: string }[] = [
  { key: "today", label: "当日" },
  { key: "yesterday", label: "前日" },
  { key: "week", label: "今週" },
  { key: "month", label: "今月" },
  { key: "calendar", label: "カレンダー" },
];

function toIsoDate(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function todayIsoDate() {
  return toIsoDate(new Date());
}

function shiftIsoDate(iso: string, diffDays: number) {
  const date = new Date(iso);
  date.setDate(date.getDate() + diffDays);
  return toIsoDate(date);
}

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function currentWeekRange() {
  const now = new Date();
  const day = now.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const start = new Date(now);
  start.setDate(now.getDate() + diff);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return { start: toIsoDate(start), end: toIsoDate(end) };
}

function formatCurrency(amount: number) {
  return `￥${amount.toLocaleString()}`;
}

function formatMinutes(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}:${String(m).padStart(2, "0")}`;
}

function totalDeliveries(record: StoredRecord) {
  return Object.values(record.services).reduce(
    (sum, service) => sum + service.deliveries,
    0
  );
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
    return JSON.parse(raw) as StoredRecord[];
  } catch {
    return [];
  }
}

function displayNameFromProfile(profile: Profile | null) {
  return (
    profile?.name?.trim() ||
    profile?.rankingName?.trim() ||
    profile?.nickname?.trim() ||
    "匿名配達員"
  );
}

function displayNameFromRecord(record: StoredRecord, profile: Profile | null) {
  return record.name?.trim() || displayNameFromProfile(profile);
}

function recordBelongsToUser(record: StoredRecord, user: UbalogUser | null) {
  if (!user) return false;
  if (record.userId) return record.userId === user.id;
  return record.name?.trim() === user.name;
}

function periodRecords(records: StoredRecord[], period: PeriodKey, calendarDate: string) {
  const today = todayIsoDate();
  const yesterday = shiftIsoDate(today, -1);
  const currentMonth = monthKey(new Date());
  const week = currentWeekRange();

  if (period === "today") return records.filter((record) => record.date === today);
  if (period === "yesterday") return records.filter((record) => record.date === yesterday);
  if (period === "week") {
    return records.filter((record) => record.date >= week.start && record.date <= week.end);
  }
  if (period === "month") {
    return records.filter((record) => record.date.startsWith(currentMonth));
  }
  return records.filter((record) => record.date === calendarDate);
}

function passesRegionFilter(
  record: StoredRecord,
  regionFilter: string,
  prefectureFilter: string
) {
  const recordPrefecture = record.prefecture ?? "";
  const recordRegion = record.region || getRegionByPrefecture(recordPrefecture);

  if (regionFilter === "全国") return true;
  if (regionFilter === "都道府県別") {
    return Boolean(prefectureFilter) && recordPrefecture === prefectureFilter;
  }
  return recordRegion === regionFilter;
}

function buildRankingEntries(
  records: StoredRecord[],
  profile: Profile | null,
  activeUser: UbalogUser | null,
  aggregate: boolean
) {
  const rankedRecords = records.filter((record) => record.ranking);

  if (!aggregate) {
    return rankedRecords
      .map<RankingEntry>((record) => {
        const name = displayNameFromRecord(record, profile);
        return {
          key: `${record.date}-${record.userId ?? name}`,
          name,
          prefecture: record.prefecture ?? profile?.prefecture ?? "",
          area: record.area ?? profile?.area ?? "",
          total: record.total,
          workMinutes: record.workMinutes,
          deliveries: totalDeliveries(record),
          hourly: record.hourly,
          comment: record.comment ?? "",
          isCurrentUser: recordBelongsToUser(record, activeUser),
        };
      })
      .sort((a, b) => b.total - a.total || b.hourly - a.hourly);
  }

  const map = new Map<string, RankingEntry>();

  for (const record of rankedRecords) {
    const name = displayNameFromRecord(record, profile);
    const key = record.userId || name;
    const current = map.get(key);
    const workMinutes = (current?.workMinutes ?? 0) + record.workMinutes;
    const total = (current?.total ?? 0) + record.total;
    const comment = record.comment?.trim() || current?.comment || "";

    map.set(key, {
      key,
      name,
      prefecture: record.prefecture ?? profile?.prefecture ?? "",
      area: record.area ?? profile?.area ?? "",
      total,
      workMinutes,
      deliveries: (current?.deliveries ?? 0) + totalDeliveries(record),
      hourly: workMinutes > 0 ? Math.floor(total / (workMinutes / 60)) : 0,
      comment,
      isCurrentUser: current?.isCurrentUser || recordBelongsToUser(record, activeUser),
    });
  }

  return [...map.values()].sort((a, b) => b.total - a.total || b.hourly - a.hourly);
}

export default function RankingBoard() {
  const [records, setRecords] = useState<StoredRecord[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [activeUser, setActiveUser] = useState<UbalogUser | null>(null);
  const [period, setPeriod] = useState<PeriodKey>("today");
  const [regionFilter, setRegionFilter] = useState<string>("全国");
  const [prefectureFilter, setPrefectureFilter] = useState("");
  const [calendarDate, setCalendarDate] = useState(todayIsoDate());

  useEffect(() => {
    const load = () => {
      const nextProfile = loadProfile();
      ensureActiveUserFromProfile(nextProfile);
      setProfile(nextProfile);
      setActiveUser(getActiveUser());
      setRecords(loadRecords());
      if (nextProfile?.prefecture) setPrefectureFilter(nextProfile.prefecture);
    };

    const timer = window.setTimeout(load, 0);
    window.addEventListener("focus", load);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("focus", load);
    };
  }, []);

  const rankingEntries = useMemo(() => {
    const base = periodRecords(records, period, calendarDate).filter((record) =>
      passesRegionFilter(record, regionFilter, prefectureFilter)
    );
    return buildRankingEntries(
      base,
      profile,
      activeUser,
      period === "week" || period === "month"
    );
  }, [activeUser, calendarDate, period, prefectureFilter, profile, records, regionFilter]);

  const top3 = rankingEntries.slice(0, 3);
  const others = rankingEntries.slice(3);
  const myRankIndex = rankingEntries.findIndex((entry) => entry.isCurrentUser);

  return (
    <main className="mx-auto min-h-screen w-full max-w-[430px] bg-gray-50 pb-24">
      <AppHeader title="ランキング" />

      <div className="px-4 pt-4">
        <section className="rounded-2xl bg-white p-4 shadow-sm">
          <h1 className="text-xl font-bold text-gray-900">ランキング</h1>

          <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
            {periodOptions.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setPeriod(item.key)}
                className={`shrink-0 rounded-full px-4 py-2 text-xs font-bold ${
                  period === item.key
                    ? "bg-green-600 text-white"
                    : "bg-gray-100 text-gray-600"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          {period === "calendar" && (
            <input
              type="date"
              value={calendarDate}
              onChange={(e) => setCalendarDate(e.target.value)}
              className="mt-3 h-11 w-full rounded-xl border border-gray-200 px-3 text-sm font-bold"
            />
          )}

          <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
            {REGION_OPTIONS.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setRegionFilter(item)}
                className={`shrink-0 rounded-full px-4 py-2 text-xs font-bold ${
                  regionFilter === item
                    ? "bg-green-600 text-white"
                    : "bg-gray-100 text-gray-600"
                }`}
              >
                {item}
              </button>
            ))}
          </div>

          {regionFilter === "都道府県別" && (
            <select
              value={prefectureFilter}
              onChange={(e) => setPrefectureFilter(e.target.value)}
              className="mt-3 h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm font-bold"
            >
              <option value="">都道府県を選択</option>
              {PREFECTURES.map((prefecture) => (
                <option key={prefecture} value={prefecture}>
                  {prefecture}
                </option>
              ))}
            </select>
          )}
        </section>

        <section className="mt-4 rounded-2xl bg-white p-4 shadow-sm">
          {rankingEntries.length === 0 ? (
            <div className="rounded-xl bg-gray-50 px-4 py-8 text-center text-sm text-gray-500">
              条件に合う記録はありません
            </div>
          ) : (
            <div className="space-y-3">
              <div className="rounded-2xl bg-green-50 px-3 py-3 text-sm font-bold text-green-800">
                {myRankIndex >= 0
                  ? `この条件でのあなたの順位: ${myRankIndex + 1}位 / ${
                      rankingEntries.length
                    }人中`
                  : "この条件ではまだ記録がありません"}
              </div>
              {top3.map((entry, index) => (
                <RankingCard key={entry.key} entry={entry} rank={index + 1} featured />
              ))}
              {others.map((entry, index) => (
                <RankingCard key={entry.key} entry={entry} rank={index + 4} />
              ))}
            </div>
          )}
        </section>
      </div>

      <BottomMenu />
    </main>
  );
}

function RankingCard({
  entry,
  rank,
  featured = false,
}: {
  entry: RankingEntry;
  rank: number;
  featured?: boolean;
}) {
  const medalClass =
    rank === 1
      ? "bg-yellow-400 text-yellow-950 ring-yellow-200"
      : rank === 2
      ? "bg-gray-300 text-gray-900 ring-gray-200"
      : rank === 3
      ? "bg-amber-600 text-white ring-amber-200"
      : "bg-gray-100 text-gray-600 ring-gray-100";

  return (
    <div
      className={`rounded-2xl border p-4 ${
        featured ? "border-green-100 bg-green-50" : "border-gray-100 bg-white"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-black ring-4 ${medalClass}`}
          >
            {rank}
          </div>
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-2">
              <div className="truncate text-base font-bold text-gray-900">
                {entry.name}
              </div>
              {entry.isCurrentUser && (
                <span className="shrink-0 rounded-full bg-green-600 px-2 py-0.5 text-[10px] font-bold text-white">
                  あなた
                </span>
              )}
            </div>
            <div className="mt-1 text-xs font-bold text-gray-500">
              {[entry.prefecture, entry.area].filter(Boolean).join(" / ") || "全国"}
            </div>
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-lg font-black text-gray-900">
            {formatCurrency(entry.total)}
          </div>
          <div className="text-xs font-bold text-green-700">
            時給 {formatCurrency(entry.hourly)}
          </div>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs font-bold text-gray-600">
        <div>稼働 {formatMinutes(entry.workMinutes)}</div>
        <div>件数 {entry.deliveries}件</div>
      </div>
      {entry.comment.trim() && (
        <div className="mt-3 truncate rounded-xl bg-white px-3 py-2 text-xs font-bold text-gray-700">
          {entry.comment.trim()}
        </div>
      )}
    </div>
  );
}
