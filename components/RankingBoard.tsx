"use client";

import { useEffect, useMemo, useState } from "react";
import AffiliateMiniAd from "@/components/AffiliateMiniAd";
import AppHeader from "@/components/AppHeader";
import BottomMenu from "@/components/BottomMenu";
import RankingUserDetailSheet from "@/components/RankingUserDetailSheet";
import { PREFECTURES } from "@/lib/areas";
import {
  ensureActiveUserFromProfile,
  getActiveUser,
  type UbalogUser,
} from "@/lib/users";
import { fetchSharedRecords, mergeRecords } from "@/lib/sharedRecords";

const RECORDS_STORAGE_KEY = "ubalog-records";
const PROFILE_STORAGE_KEY = "ubalog-profile";

type ServiceKey = "uber" | "demae" | "menu" | "rocket" | "other";
type PeriodKey = "today" | "yesterday" | "week" | "month" | "previousMonth" | "calendar";
type RegionFilterKey = "全国" | "都道府県別" | "北日本" | "東日本" | "西日本" | "九州";
type RankingMetricKey = "sales" | "hourly" | "deliveries";

type Profile = {
  displayName?: string;
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
  displayName?: string;
  name?: string;
  rankingName?: string;
  nickname?: string;
  prefecture?: string;
  region?: string;
  area?: string;
  comment?: string;
  total: number;
  ranking?: boolean;
  hourly?: number;
  workMinutes?: number;
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
  unitPrice: number;
  comment: string;
  isCurrentUser: boolean;
  records: StoredRecord[];
};

const periodOptions: { key: PeriodKey; label: string }[] = [
  { key: "today", label: "今日" },
  { key: "yesterday", label: "昨日" },
  { key: "week", label: "今週" },
  { key: "month", label: "今月" },
  { key: "previousMonth", label: "前月" },
  { key: "calendar", label: "日付指定" },
];

const regionOptions: { key: RegionFilterKey; label: string }[] = [
  { key: "全国", label: "全国" },
  { key: "都道府県別", label: "都道府県" },
  { key: "北日本", label: "北日本" },
  { key: "東日本", label: "東日本" },
  { key: "西日本", label: "西日本" },
  { key: "九州", label: "九州" },
];

const rankingMetricOptions: {
  key: RankingMetricKey;
  label: string;
  className: string;
}[] = [
  { key: "sales", label: "売上", className: "flex-[2]" },
  { key: "hourly", label: "時給", className: "flex-1" },
  { key: "deliveries", label: "件数", className: "flex-1" },
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

function previousMonthKey() {
  const date = new Date();
  date.setMonth(date.getMonth() - 1, 1);
  return monthKey(date);
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

function formatHourly(amount: number) {
  return amount > 0 ? `${formatCurrency(amount)}/h` : "-";
}

function formatUnitPrice(amount: number) {
  return amount > 0 ? formatCurrency(amount) : "-";
}

function totalDeliveries(record: StoredRecord) {
  return Object.values(record.services ?? {}).reduce(
    (sum, service) => sum + service.deliveries,
    0
  );
}

function calculateHourly(total: number, workMinutes: number, fallbackHourly?: number) {
  if (workMinutes > 0) return Math.floor(total / (workMinutes / 60));
  return fallbackHourly && fallbackHourly > 0 ? fallbackHourly : 0;
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
    profile?.displayName?.trim() ||
    profile?.name?.trim() ||
    profile?.rankingName?.trim() ||
    profile?.nickname?.trim() ||
    "匿名配達員"
  );
}

function displayNameFromRecord(record: StoredRecord, profile: Profile | null) {
  return (
    record.displayName?.trim() ||
    record.name?.trim() ||
    record.rankingName?.trim() ||
    record.nickname?.trim() ||
    displayNameFromProfile(profile)
  );
}

function recordUserKey(record: StoredRecord, profile: Profile | null) {
  return (
    record.userId?.trim() ||
    record.displayName?.trim() ||
    record.name?.trim() ||
    displayNameFromProfile(profile)
  );
}

function recordBelongsToUser(
  record: StoredRecord,
  profile: Profile | null,
  user: UbalogUser | null
) {
  if (record.userId) return user ? record.userId === user.id : false;
  const recordNames = [
    record.displayName,
    record.name,
    record.rankingName,
    record.nickname,
  ]
    .map((value) => value?.trim())
    .filter(Boolean);
  const currentNames = [
    profile?.displayName,
    profile?.name,
    profile?.rankingName,
    profile?.nickname,
    user?.name,
  ]
    .map((value) => value?.trim())
    .filter(Boolean);

  return recordNames.some((name) => currentNames.includes(name));
}

function periodRecords(records: StoredRecord[], period: PeriodKey, calendarDate: string) {
  const today = todayIsoDate();
  const yesterday = shiftIsoDate(today, -1);
  const currentMonth = monthKey(new Date());
  const previousMonth = previousMonthKey();
  const week = currentWeekRange();

  if (period === "today") return records.filter((record) => record.date === today);
  if (period === "yesterday") return records.filter((record) => record.date === yesterday);
  if (period === "week") {
    return records.filter((record) => record.date >= week.start && record.date <= week.end);
  }
  if (period === "month") {
    return records.filter((record) => record.date.startsWith(currentMonth));
  }
  if (period === "previousMonth") {
    return records.filter((record) => record.date.startsWith(previousMonth));
  }
  return records.filter((record) => record.date === calendarDate);
}

function passesRegionFilter(
  record: StoredRecord,
  regionFilter: RegionFilterKey,
  prefectureFilter: string
) {
  const recordPrefecture = record.prefecture ?? "";
  const recordRegion = record.region ?? "";

  if (regionFilter === "全国") return true;
  if (regionFilter === "都道府県別") {
    return Boolean(prefectureFilter) && recordPrefecture === prefectureFilter;
  }
  if (regionFilter === "九州") {
    return recordRegion === "九州四国" || recordRegion === "九州";
  }
  return recordRegion === regionFilter;
}

function compareRankingEntries(
  a: RankingEntry,
  b: RankingEntry,
  metric: RankingMetricKey
) {
  if (metric === "hourly") {
    return b.hourly - a.hourly || b.total - a.total || b.deliveries - a.deliveries;
  }
  if (metric === "deliveries") {
    return b.deliveries - a.deliveries || b.total - a.total || b.hourly - a.hourly;
  }
  return b.total - a.total || b.hourly - a.hourly || b.deliveries - a.deliveries;
}

function buildRankingEntries(
  records: StoredRecord[],
  profile: Profile | null,
  activeUser: UbalogUser | null,
  aggregate: boolean,
  metric: RankingMetricKey
) {
  const rankedRecords = records.filter(
    (record) => record.ranking !== false && record.total > 0
  );

  if (!aggregate) {
    return rankedRecords
      .map<RankingEntry>((record) => {
        const name = displayNameFromRecord(record, profile);
        const deliveries = totalDeliveries(record);
        const workMinutes = record.workMinutes ?? 0;
        const hourly = calculateHourly(record.total, workMinutes, record.hourly);
        return {
          key: `${record.date}-${recordUserKey(record, profile)}`,
          name,
          prefecture: record.prefecture ?? profile?.prefecture ?? "",
          area: record.area ?? profile?.area ?? "",
          total: record.total,
          workMinutes,
          deliveries,
          hourly,
          unitPrice: deliveries > 0 ? Math.floor(record.total / deliveries) : 0,
          comment: record.comment ?? "",
          isCurrentUser: recordBelongsToUser(record, profile, activeUser),
          records: [record],
        };
      })
      .sort((a, b) => compareRankingEntries(a, b, metric));
  }

  const map = new Map<string, RankingEntry>();

  for (const record of rankedRecords) {
    const name = displayNameFromRecord(record, profile);
    const key = recordUserKey(record, profile);
    const current = map.get(key);
    const workMinutes = (current?.workMinutes ?? 0) + (record.workMinutes ?? 0);
    const total = (current?.total ?? 0) + record.total;
    const deliveries = (current?.deliveries ?? 0) + totalDeliveries(record);
    const comment = record.comment?.trim() || current?.comment || "";
    const entryRecords = [...(current?.records ?? []), record];

    map.set(key, {
      key,
      name,
      prefecture: record.prefecture ?? profile?.prefecture ?? "",
      area: record.area ?? profile?.area ?? "",
      total,
      workMinutes,
      deliveries,
      hourly: calculateHourly(total, workMinutes),
      unitPrice: deliveries > 0 ? Math.floor(total / deliveries) : 0,
      comment,
      isCurrentUser:
        current?.isCurrentUser || recordBelongsToUser(record, profile, activeUser),
      records: entryRecords,
    });
  }

  return [...map.values()].sort((a, b) => compareRankingEntries(a, b, metric));
}

function mainMetricValue(entry: RankingEntry, metric: RankingMetricKey) {
  if (metric === "hourly") return formatHourly(entry.hourly);
  if (metric === "deliveries") return `${entry.deliveries.toLocaleString()}件`;
  return formatCurrency(entry.total);
}

function metricCaption(metric: RankingMetricKey) {
  if (metric === "hourly") return "時給順";
  if (metric === "deliveries") return "件数順";
  return "売上順";
}

function subMetrics(entry: RankingEntry, metric: RankingMetricKey) {
  if (metric === "hourly") {
    return [
      `売上 ${formatCurrency(entry.total)}`,
      `${entry.deliveries.toLocaleString()}件`,
      `稼働 ${formatMinutes(entry.workMinutes)}`,
    ];
  }
  if (metric === "deliveries") {
    return [
      `売上 ${formatCurrency(entry.total)}`,
      `時給 ${formatHourly(entry.hourly)}`,
      `1件 ${formatUnitPrice(entry.unitPrice)}`,
    ];
  }
  return [
    `時給 ${formatHourly(entry.hourly)}`,
    `${entry.deliveries.toLocaleString()}件`,
    `1件 ${formatUnitPrice(entry.unitPrice)}`,
  ];
}

function periodLabel(period: PeriodKey, calendarDate: string) {
  if (period === "today") return "今日";
  if (period === "yesterday") return "昨日";
  if (period === "week") return "今週";
  if (period === "month") return "今月";
  if (period === "previousMonth") return "前月";
  return calendarDate.replaceAll("-", "/");
}

function regionLabel(region: RegionFilterKey, prefecture: string) {
  if (region === "都道府県別") return prefecture || "都道府県";
  return region;
}

export default function RankingBoard() {
  const [records, setRecords] = useState<StoredRecord[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [activeUser, setActiveUser] = useState<UbalogUser | null>(null);
  const [period, setPeriod] = useState<PeriodKey>("today");
  const [regionFilter, setRegionFilter] = useState<RegionFilterKey>("全国");
  const [rankingMetric, setRankingMetric] = useState<RankingMetricKey>("sales");
  const [prefectureFilter, setPrefectureFilter] = useState("");
  const [calendarDate, setCalendarDate] = useState(todayIsoDate());
  const [selectedEntry, setSelectedEntry] = useState<{
    entry: RankingEntry;
    rank: number;
  } | null>(null);

  useEffect(() => {
    const load = () => {
      const nextProfile = loadProfile();
      ensureActiveUserFromProfile(nextProfile);
      setProfile(nextProfile);
      setActiveUser(getActiveUser());
      const localRecords = loadRecords();
      setRecords(localRecords);
      void fetchSharedRecords().then((remoteRecords) => {
        if (remoteRecords.length === 0) return;
        setRecords(
          mergeRecords(localRecords, remoteRecords) as StoredRecord[]
        );
      });
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
      period === "week" || period === "month" || period === "previousMonth",
      rankingMetric
    );
  }, [
    activeUser,
    calendarDate,
    period,
    prefectureFilter,
    profile,
    rankingMetric,
    records,
    regionFilter,
  ]);

  const top3 = rankingEntries.slice(0, 3);
  const others = rankingEntries.slice(3);
  const myRankIndex = rankingEntries.findIndex((entry) => entry.isCurrentUser);
  const showRankingAd = rankingEntries.length >= 2;

  return (
    <main className="mx-auto min-h-screen w-full max-w-[430px] bg-gray-50 pb-24">
      <AppHeader title="ランキング" />

      <div className="px-4 pt-2">
        <section className="rounded-2xl bg-white px-3 py-3 shadow-sm">
          <div className="flex gap-1.5 overflow-x-auto pb-0.5">
            {periodOptions.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setPeriod(item.key)}
                className={`shrink-0 rounded-full px-3 py-1.5 text-[11px] font-bold ${
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
              className="mt-2 h-10 w-full rounded-xl border border-gray-200 px-3 text-xs font-bold"
            />
          )}

          <div className="mt-2 flex gap-1.5 overflow-x-auto pb-0.5">
            {regionOptions.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setRegionFilter(item.key)}
                className={`shrink-0 rounded-full px-3 py-1.5 text-[11px] font-bold ${
                  regionFilter === item.key
                    ? "bg-green-600 text-white"
                    : "bg-gray-100 text-gray-600"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          {regionFilter === "都道府県別" && (
            <select
              value={prefectureFilter}
              onChange={(e) => setPrefectureFilter(e.target.value)}
              className="mt-2 h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-xs font-bold"
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

        <section className="mt-3 rounded-2xl bg-white p-3 shadow-sm">
          <div className="mb-3 flex rounded-2xl bg-gray-100 p-1">
            {rankingMetricOptions.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setRankingMetric(item.key)}
                className={`${item.className} rounded-xl px-3 py-2 text-xs font-black ${
                  rankingMetric === item.key
                    ? "bg-green-600 text-white shadow-sm"
                    : "text-gray-600"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          {rankingEntries.length === 0 ? (
            <div className="rounded-xl bg-gray-50 px-4 py-8 text-center text-sm font-bold text-gray-500">
              <div>まだランキング記録がありません</div>
              <div className="mt-1 text-xs">条件を変えると表示される場合があります</div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="rounded-2xl bg-green-50 px-3 py-3 text-sm font-bold text-green-800">
                {myRankIndex >= 0
                  ? `この条件でのあなたの順位: ${myRankIndex + 1}位 / ${
                      rankingEntries.length
                    }人中`
                  : "まだランキングに記録がありません。条件を変えると表示される場合があります"}
              </div>
              {top3.map((entry, index) => (
                <div key={entry.key} className="space-y-3">
                  <PodiumCard
                    entry={entry}
                    rank={index + 1}
                    metric={rankingMetric}
                    onSelect={() => setSelectedEntry({ entry, rank: index + 1 })}
                  />
                  {index === 0 && showRankingAd && (
                    <AffiliateMiniAd
                      placement={`ranking-${period}-${regionFilter}-${rankingMetric}`}
                      slot={0}
                      driverWeight={0.6}
                    />
                  )}
                </div>
              ))}
              {others.map((entry, index) => (
                <RankingCard
                  key={entry.key}
                  entry={entry}
                  rank={index + 4}
                  metric={rankingMetric}
                  onSelect={() => setSelectedEntry({ entry, rank: index + 4 })}
                />
              ))}
            </div>
          )}
        </section>
      </div>

      <BottomMenu />
      {selectedEntry && (
        <RankingUserDetailSheet
          entry={selectedEntry.entry}
          rank={selectedEntry.rank}
          metric={rankingMetric}
          period={periodLabel(period, calendarDate)}
          region={regionLabel(regionFilter, prefectureFilter)}
          onClose={() => setSelectedEntry(null)}
        />
      )}
    </main>
  );
}

function medalForRank(rank: number) {
  if (rank === 1) return "🥇";
  if (rank === 2) return "🥈";
  if (rank === 3) return "🥉";
  return "";
}

function PodiumCard({
  entry,
  rank,
  metric,
  onSelect,
}: {
  entry: RankingEntry;
  rank: number;
  metric: RankingMetricKey;
  onSelect: () => void;
}) {
  const styles =
    rank === 1
      ? "border-yellow-300 bg-yellow-50 shadow-md"
      : rank === 2
      ? "border-gray-200 bg-gray-50"
      : "border-amber-200 bg-amber-50";
  const details = subMetrics(entry, metric);

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`block w-full rounded-2xl border p-4 text-left active:scale-[0.99] ${styles}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className={rank === 1 ? "text-2xl" : "text-xl"}>
              {medalForRank(rank)}
            </span>
            <span
              className={
                rank === 1
                  ? "text-base font-black text-gray-900"
                  : "text-sm font-black text-gray-900"
              }
            >
              {rank}位
            </span>
            {entry.isCurrentUser && (
              <span className="rounded-full bg-green-600 px-2 py-0.5 text-[10px] font-bold text-white">
                あなた
              </span>
            )}
          </div>
          <div
            className={
              rank === 1
                ? "mt-1 truncate text-lg font-black text-gray-900"
                : "mt-1 truncate text-base font-black text-gray-900"
            }
          >
            {entry.name}
          </div>
          {(entry.prefecture || entry.area) && (
            <div className="mt-1 truncate text-[11px] font-bold text-gray-500">
              {[entry.prefecture, entry.area].filter(Boolean).join(" / ")}
            </div>
          )}
        </div>
        <div className="shrink-0 text-right">
          <div
            className={
              rank === 1
                ? "text-3xl font-black text-gray-900"
                : "text-xl font-black text-gray-900"
            }
          >
            {mainMetricValue(entry, metric)}
          </div>
          <div className="text-xs font-bold text-green-700">
            {metricCaption(metric)}
          </div>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-center text-[11px] font-bold text-gray-600">
        {details.map((detail) => (
          <div key={detail} className="rounded-xl bg-white/80 px-2 py-2">
            {detail}
          </div>
        ))}
      </div>
      {entry.comment.trim() && (
        <div className="mt-3 truncate rounded-xl bg-white/80 px-3 py-2 text-xs font-bold text-gray-700">
          {entry.comment.trim()}
        </div>
      )}
    </button>
  );
}

function RankingCard({
  entry,
  rank,
  metric,
  onSelect,
}: {
  entry: RankingEntry;
  rank: number;
  metric: RankingMetricKey;
  onSelect: () => void;
}) {
  const details = subMetrics(entry, metric);
  const isSimple = rank === 4 || rank === 5;
  const isCompact = rank >= 6 && rank <= 10;
  const isMinimal = rank >= 11;

  if (isMinimal) {
    return (
      <button
        type="button"
        onClick={onSelect}
        className={`flex w-full items-center justify-between gap-2 rounded-xl border px-3 py-2 text-left active:scale-[0.99] ${
          entry.isCurrentUser ? "border-green-300 bg-green-50" : "border-gray-100 bg-white"
        }`}
      >
        <div className="flex min-w-0 items-center gap-2">
          <span className="shrink-0 text-xs font-black text-gray-500">{rank}位</span>
          <span className="truncate text-sm font-bold text-gray-800">{entry.name}</span>
          {entry.isCurrentUser && (
            <span className="shrink-0 rounded-full bg-green-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
              あなた
            </span>
          )}
        </div>
        <div className="shrink-0 text-sm font-black text-gray-900">
          {mainMetricValue(entry, metric)}
        </div>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`block w-full rounded-2xl border text-left active:scale-[0.99] ${
        isCompact ? "p-2.5" : "p-3"
      } ${
        entry.isCurrentUser ? "border-green-300 bg-green-50" : "border-gray-100 bg-white"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            <span className="shrink-0 rounded-full bg-gray-100 px-2 py-1 text-xs font-black text-gray-700">
              {rank}位
            </span>
            <span className="truncate text-sm font-black text-gray-900">
              {entry.name}
            </span>
            {entry.isCurrentUser && (
              <span className="shrink-0 rounded-full bg-green-600 px-2 py-0.5 text-[10px] font-bold text-white">
                あなた
              </span>
            )}
          </div>
          {!isCompact && (
            <div className="mt-1 truncate text-[11px] font-bold text-gray-500">
              {[...details, entry.area || entry.prefecture]
                .filter(Boolean)
                .join(" / ")}
            </div>
          )}
          {isCompact && (
            <div className="mt-0.5 truncate text-[10px] font-bold text-gray-500">
              {details.slice(0, 2).join(" / ")}
            </div>
          )}
        </div>
        <div className="shrink-0 text-right">
          <div
            className={
              isCompact
                ? "text-sm font-black text-gray-900"
                : "text-base font-black text-gray-900"
            }
          >
            {mainMetricValue(entry, metric)}
          </div>
          <div className="text-[10px] font-bold text-green-700">
            {metricCaption(metric)}
          </div>
        </div>
      </div>
      {!isCompact && entry.comment.trim() && (
        <div className="mt-2 truncate rounded-xl bg-gray-50 px-3 py-2 text-xs font-bold text-gray-700">
          {entry.comment.trim()}
        </div>
      )}
      {isSimple && !entry.comment.trim() && (
        <div className="mt-1 text-[11px] font-bold text-gray-400">
          {details.join(" / ")}
        </div>
      )}
    </button>
  );
}
