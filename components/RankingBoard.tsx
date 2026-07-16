"use client";

import { useEffect, useMemo, useRef, useState, type TouchEvent } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import AffiliateMiniAd from "@/components/AffiliateMiniAd";
import AppHeader from "@/components/AppHeader";
import BottomMenu from "@/components/BottomMenu";
import RankingUserDetailSheet from "@/components/RankingUserDetailSheet";
import { useAdminMode } from "@/lib/admin";
import { PREFECTURES } from "@/lib/areas";
import {
  ensureActiveUserFromProfile,
  getAnonymousDisplayName,
  getActiveUser,
  type UbalogUser,
} from "@/lib/users";
import {
  fetchSharedRecords,
  hideSharedRecord,
  mergeRecords,
  type SharedRecord,
} from "@/lib/sharedRecords";
import {
  fetchSharedRealtimeOffers,
  loadLocalRealtimeOffers,
  mergeRealtimeOffers,
  type SharedRealtimeOffer,
} from "@/lib/realtime";

const RECORDS_STORAGE_KEY = "ubalog-records";
const PROFILE_STORAGE_KEY = "ubalog-profile";
const RANKING_PAGE_SIZE = 50;

type ServiceKey = "uber" | "demae" | "menu" | "rocket" | "other";
type PeriodKey = "today" | "yesterday" | "week" | "month" | "previousMonth" | "calendar";
type RegionFilterKey = "全国" | "都道府県別" | "北海道" | "東日本" | "西日本" | "九州";
type RankingMetricKey = "sales" | "hourly" | "deliveries" | "unitPrice";

type Profile = {
  displayName?: string;
  name?: string;
  nickname?: string;
  rankingName?: string;
  anonymousNumber?: string;
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
  anonymousNumber?: string;
  prefecture?: string;
  region?: string;
  area?: string;
  comment?: string;
  total: number;
  ranking?: boolean;
  hourly?: number;
  workMinutes?: number;
  services: Record<ServiceKey, { amount: number; deliveries: number }>;
  deviceId?: string;
  firestoreId?: string;
  hidden?: boolean;
  hiddenAt?: string;
  hiddenReason?: string;
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
  offer?: SharedRealtimeOffer;
};

const PARTICIPATE_UNIT_PRICE_LINK = (
  <Link
    href="/realtime"
    className="block rounded-2xl border border-green-100 bg-green-50 px-3 py-3 text-sm font-bold text-green-800 active:bg-green-100"
  >
    <div>高報酬案件を見つけたら共有しよう</div>
    <div className="mt-1 text-xs text-green-700">
      リアルタイム共有で報酬単価ランキングに参加できます
    </div>
    <div className="mt-2 inline-flex rounded-full bg-green-600 px-3 py-1.5 text-xs text-white">
      案件を共有する
    </div>
  </Link>
);

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
  { key: "北海道", label: "北海道" },
  { key: "東日本", label: "東日本" },
  { key: "西日本", label: "西日本" },
  { key: "九州", label: "九州" },
];

const rankingMetricOptions: {
  key: RankingMetricKey;
  label: string;
  className: string;
}[] = [
  { key: "sales", label: "売上詳細", className: "flex-[1.6]" },
  { key: "hourly", label: "時給", className: "flex-1" },
  { key: "deliveries", label: "件数", className: "flex-1" },
  { key: "unitPrice", label: "単価", className: "flex-1" },
];

const serviceLabels: { key: ServiceKey; label: string }[] = [
  { key: "uber", label: "Uber" },
  { key: "demae", label: "出前館" },
  { key: "menu", label: "menu" },
  { key: "rocket", label: "ロケナウ" },
  { key: "other", label: "Other" },
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
  return `¥${Math.max(0, Math.floor(amount)).toLocaleString()}`;
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

function formatOfferAge(createdAt?: string) {
  const time = new Date(createdAt ?? "").getTime();
  if (!time) return "-";
  const diffMinutes = Math.max(0, Math.floor((Date.now() - time) / 60000));
  if (diffMinutes < 1) return "たった今";
  if (diffMinutes < 60) return `${diffMinutes}分前`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}時間前`;
  return `${Math.floor(diffHours / 24)}日前`;
}

function totalDeliveries(record: StoredRecord) {
  return Object.values(record.services ?? {}).reduce(
    (sum, service) => sum + service.deliveries,
    0
  );
}

function serviceAmount(entry: RankingEntry, serviceKey: ServiceKey) {
  return entry.records.reduce(
    (sum, record) => sum + (record.services?.[serviceKey]?.amount ?? 0),
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
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? (parsed as StoredRecord[]).filter((record) => record.hidden !== true)
      : [];
  } catch {
    return [];
  }
}

function loadAllRecords(): StoredRecord[] {
  const raw = localStorage.getItem(RECORDS_STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as StoredRecord[]) : [];
  } catch {
    return [];
  }
}

function saveAllRecords(records: StoredRecord[]) {
  localStorage.setItem(RECORDS_STORAGE_KEY, JSON.stringify(records));
  window.dispatchEvent(new Event("ubalog-records-updated"));
}

function displayNameFromProfile(profile: Profile | null) {
  return sanitizeDisplayName(
    profile?.displayName?.trim() ||
    profile?.name?.trim() ||
    profile?.rankingName?.trim() ||
    profile?.nickname?.trim() ||
    (profile?.anonymousNumber ? `匿名${profile.anonymousNumber}` : "") ||
    ""
  );
}

function displayNameFromRecord(record: StoredRecord, profile: Profile | null) {
  return sanitizeDisplayName(
    record.displayName?.trim() ||
    record.name?.trim() ||
    record.rankingName?.trim() ||
    record.nickname?.trim() ||
    (record.anonymousNumber ? `匿名${record.anonymousNumber}` : "") ||
    displayNameFromProfile(profile)
  );
}

function looksBrokenText(value: string) {
  return /[縺繧譁譛蜿荳鬆莉蛯蟆邨髢驕螢謨譌逕鬟髱]/.test(value);
}

function sanitizeDisplayName(value?: string) {
  const trimmed = (value ?? "").replace(/[\r\n\t]+/g, " ").trim();
  if (!trimmed || looksBrokenText(trimmed)) return getAnonymousDisplayName();
  return trimmed.length > 12 ? `${trimmed.slice(0, 12)}…` : trimmed;
}

function safeText(value?: string, maxLength = 24) {
  const trimmed = (value ?? "").replace(/[\r\n\t]+/g, " ").trim();
  if (!trimmed || looksBrokenText(trimmed)) return "";
  return trimmed.length > maxLength ? `${trimmed.slice(0, maxLength)}…` : trimmed;
}

function recordUserKey(record: StoredRecord, profile: Profile | null) {
  return (
    record.deviceId?.trim() ||
    record.userId?.trim() ||
    record.displayName?.trim() ||
    record.name?.trim() ||
    displayNameFromProfile(profile)
  );
}

function recordHideKey(record: StoredRecord) {
  return [
    record.firestoreId,
    record.deviceId,
    record.userId,
    record.date,
    record.displayName,
    record.name,
    record.rankingName,
  ]
    .filter(Boolean)
    .join("_");
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

function recordUpdatedTime(record: StoredRecord) {
  const source = (record as StoredRecord & { updatedAt?: string; createdAt?: string });
  return new Date(source.updatedAt || source.createdAt || "").getTime() || 0;
}

function rankingRecordKeys(record: StoredRecord, profile: Profile | null) {
  const totalKey = String(record.total ?? 0);
  const date = record.date;
  const keys = [
    record.deviceId ? `device:${record.deviceId}:${date}` : "",
    record.userId ? `user:${record.userId}:${date}` : "",
    record.displayName?.trim()
      ? `display:${record.displayName.trim()}:${date}:${totalKey}`
      : "",
    record.name?.trim() ? `name:${record.name.trim()}:${date}:${totalKey}` : "",
    record.rankingName?.trim()
      ? `ranking:${record.rankingName.trim()}:${date}:${totalKey}`
      : "",
    record.nickname?.trim()
      ? `nickname:${record.nickname.trim()}:${date}:${totalKey}`
      : "",
    `resolved:${displayNameFromRecord(record, profile)}:${date}:${totalKey}`,
  ].filter(Boolean);

  return keys.length > 0 ? keys : [`anonymous:${date}:${totalKey}`];
}

function chooseLatestRecord(current: StoredRecord | undefined, next: StoredRecord) {
  if (!current) return next;
  const currentTime = recordUpdatedTime(current);
  const nextTime = recordUpdatedTime(next);
  if (nextTime !== currentTime) return nextTime > currentTime ? next : current;
  return next.total >= current.total ? next : current;
}

function dedupeRankingRecords(records: StoredRecord[], profile: Profile | null) {
  const merged = new Map<string, StoredRecord>();
  const aliases = new Map<string, string>();

  for (const record of records) {
    if (record.hidden === true) continue;
    const keys = rankingRecordKeys(record, profile);
    const primaryKey =
      keys.map((key) => aliases.get(key)).find(Boolean) ?? keys[0];
    merged.set(primaryKey, chooseLatestRecord(merged.get(primaryKey), record));
    keys.forEach((key) => aliases.set(key, primaryKey));
  }

  return [...merged.values()];
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

function offerDate(offer: SharedRealtimeOffer) {
  const date = new Date(offer.createdAt);
  return Number.isNaN(date.getTime()) ? "" : toIsoDate(date);
}

function periodOffers(offers: SharedRealtimeOffer[], period: PeriodKey, calendarDate: string) {
  const today = todayIsoDate();
  const yesterday = shiftIsoDate(today, -1);
  const currentMonth = monthKey(new Date());
  const previousMonth = previousMonthKey();
  const week = currentWeekRange();

  return offers.filter((offer) => {
    if (offer.hidden === true || offer.amount <= 0) return false;
    const date = offerDate(offer);
    if (!date) return false;
    if (period === "today") return date === today;
    if (period === "yesterday") return date === yesterday;
    if (period === "week") return date >= week.start && date <= week.end;
    if (period === "month") return date.startsWith(currentMonth);
    if (period === "previousMonth") return date.startsWith(previousMonth);
    return date === calendarDate;
  });
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
    return recordRegion === "九州沖縄" || recordRegion === "九州";
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
  if (metric === "unitPrice") {
    return b.total - a.total || b.unitPrice - a.unitPrice || b.deliveries - a.deliveries;
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
  const rankedRecords = dedupeRankingRecords(records, profile).filter(
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
          prefecture: safeText(record.prefecture ?? profile?.prefecture ?? "", 12),
          area: safeText(record.area ?? profile?.area ?? "", 16),
          total: record.total,
          workMinutes,
          deliveries,
          hourly,
          unitPrice: deliveries > 0 ? Math.floor(record.total / deliveries) : 0,
          comment: safeText(record.comment ?? "", 28),
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
      prefecture: safeText(record.prefecture ?? profile?.prefecture ?? "", 12),
      area: safeText(record.area ?? profile?.area ?? "", 16),
      total,
      workMinutes,
      deliveries,
      hourly: calculateHourly(total, workMinutes),
      unitPrice: deliveries > 0 ? Math.floor(total / deliveries) : 0,
      comment: safeText(comment, 28),
      isCurrentUser:
        current?.isCurrentUser || recordBelongsToUser(record, profile, activeUser),
      records: entryRecords,
    });
  }

  return [...map.values()].sort((a, b) => compareRankingEntries(a, b, metric));
}

function buildRealtimeUnitPriceEntries(offers: SharedRealtimeOffer[]) {
  return offers
    .map<RankingEntry | null>((offer) => {
      if (offer.hidden === true || offer.amount <= 0) {
        return null;
      }
      const unitPrice =
        offer.unitPrice > 0
          ? offer.unitPrice
          : offer.distanceKm > 0
          ? Math.floor(offer.amount / offer.distanceKm)
          : 0;

      return {
        key: offer.id,
        name: sanitizeDisplayName(offer.name),
        prefecture: "",
        area: safeText(String(offer.area ?? ""), 16),
        total: offer.amount,
        workMinutes: 0,
        deliveries: 0,
        hourly: 0,
        unitPrice,
        comment: "",
        isCurrentUser: false,
        records: [],
        offer: { ...offer, unitPrice },
      };
    })
    .filter((entry): entry is RankingEntry => Boolean(entry))
    .sort((a, b) => compareRankingEntries(a, b, "unitPrice"));
}

function mainMetricValue(entry: RankingEntry, metric: RankingMetricKey) {
  if (metric === "hourly") return formatHourly(entry.hourly);
  if (metric === "deliveries") return `${entry.deliveries.toLocaleString()}件`;
  if (metric === "unitPrice") return formatCurrency(entry.total);
  return formatCurrency(entry.total);
}

function metricCaption(metric: RankingMetricKey) {
  if (metric === "hourly") return "時給順";
  if (metric === "deliveries") return "件数順";
  if (metric === "unitPrice") return "報酬順";
  return "売上順";
}

function subMetrics(entry: RankingEntry, metric: RankingMetricKey) {
  if (metric === "unitPrice") {
    return [
      `報酬 ${formatCurrency(entry.total)}`,
      entry.offer ? `距離 ${entry.offer.distanceKm.toLocaleString()}km` : "",
      entry.unitPrice > 0 ? `参考 ${formatCurrency(entry.unitPrice)}/km` : "",
    ].filter(Boolean);
  }
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
      `1件単価 ${formatUnitPrice(entry.unitPrice)}`,
    ];
  }
  return [
    `時給 ${formatHourly(entry.hourly)}`,
    `${entry.deliveries.toLocaleString()}件`,
    `1件単価 ${formatUnitPrice(entry.unitPrice)}`,
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

function periodFromQuery(value: string | null): PeriodKey {
  if (value === "date") return "calendar";
  const periodKeys: PeriodKey[] = [
    "today",
    "yesterday",
    "week",
    "month",
    "previousMonth",
    "calendar",
  ];
  return value && periodKeys.includes(value as PeriodKey)
    ? (value as PeriodKey)
    : "today";
}

function dateFromQuery(value: string | null) {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : todayIsoDate();
}

function metricFromQuery(value: string | null): RankingMetricKey {
  const keys: RankingMetricKey[] = ["sales", "hourly", "deliveries", "unitPrice"];
  return value && keys.includes(value as RankingMetricKey)
    ? (value as RankingMetricKey)
    : "sales";
}

export default function RankingBoard() {
  const searchParams = useSearchParams();
  const focusedEntryRef = useRef<HTMLDivElement | null>(null);
  const swipeStartRef = useRef<{ x: number; y: number } | null>(null);
  const isAdmin = useAdminMode();
  const [records, setRecords] = useState<StoredRecord[]>([]);
  const [realtimeOffers, setRealtimeOffers] = useState<SharedRealtimeOffer[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [activeUser, setActiveUser] = useState<UbalogUser | null>(null);
  const [period, setPeriod] = useState<PeriodKey>(() =>
    periodFromQuery(searchParams.get("period"))
  );
  const [regionFilter, setRegionFilter] = useState<RegionFilterKey>("全国");
  const [rankingMetric, setRankingMetric] = useState<RankingMetricKey>(() =>
    metricFromQuery(searchParams.get("tab"))
  );
  const [showSalesDetail, setShowSalesDetail] = useState(false);
  const [prefectureFilter, setPrefectureFilter] = useState("");
  const [calendarDate, setCalendarDate] = useState(() =>
    dateFromQuery(searchParams.get("date"))
  );
  const [selectedEntry, setSelectedEntry] = useState<{
    entry: RankingEntry;
    rank: number;
  } | null>(null);
  const [visibleCount, setVisibleCount] = useState(RANKING_PAGE_SIZE);
  const focusMode = searchParams.get("focus");

  useEffect(() => {
    const load = () => {
      const nextProfile = loadProfile();
      ensureActiveUserFromProfile(nextProfile);
      setProfile(nextProfile);
      setActiveUser(getActiveUser());
      const localRecords = loadRecords();
      setRecords(localRecords);
      const localOffers = loadLocalRealtimeOffers();
      setRealtimeOffers(localOffers.filter((offer) => offer.hidden !== true));
      void fetchSharedRecords().then((remoteRecords) => {
        if (remoteRecords.length === 0) return;
        setRecords(
          mergeRecords(localRecords, remoteRecords) as StoredRecord[]
        );
      });
      void fetchSharedRealtimeOffers().then((remoteOffers) => {
        if (remoteOffers.length === 0) return;
        setRealtimeOffers(
          mergeRealtimeOffers(localOffers, remoteOffers).filter(
            (offer) => offer.hidden !== true
          )
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
    if (rankingMetric === "unitPrice") {
      return buildRealtimeUnitPriceEntries(
        periodOffers(realtimeOffers, period, calendarDate)
      );
    }
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
    realtimeOffers,
    records,
    regionFilter,
  ]);

  const visibleRankingEntries = rankingEntries.slice(0, visibleCount);
  const visibleTop3 = visibleRankingEntries.slice(0, 3);
  const visibleOthers = visibleRankingEntries.slice(3);
  const myRankIndex = rankingEntries.findIndex((entry) => entry.isCurrentUser);
  const showRankingAd = rankingMetric !== "unitPrice" && rankingEntries.length >= 2;
  const shouldFocusMe = focusMode === "me";

  const switchRankingMetric = (direction: 1 | -1) => {
    const currentIndex = rankingMetricOptions.findIndex(
      (item) => item.key === rankingMetric
    );
    const nextIndex = currentIndex + direction;
    const next = rankingMetricOptions[nextIndex];
    if (!next) return;
    setRankingMetric(next.key);
    setShowSalesDetail(false);
  };

  const handleRankingMetricSelect = (key: RankingMetricKey) => {
    if (key === "sales") {
      if (rankingMetric === "sales") {
        setShowSalesDetail((current) => !current);
        return;
      }
      setRankingMetric("sales");
      setShowSalesDetail(false);
      return;
    }

    setRankingMetric(key);
    setShowSalesDetail(false);
  };

  const handleRankingTouchStart = (event: TouchEvent<HTMLElement>) => {
    const touch = event.touches[0];
    swipeStartRef.current = { x: touch.clientX, y: touch.clientY };
  };

  const handleRankingTouchEnd = (event: TouchEvent<HTMLElement>) => {
    const start = swipeStartRef.current;
    swipeStartRef.current = null;
    const touch = event.changedTouches[0];
    if (!start || !touch) return;

    const diffX = touch.clientX - start.x;
    const diffY = touch.clientY - start.y;
    if (Math.abs(diffX) < 50 || Math.abs(diffX) <= Math.abs(diffY)) return;

    if (diffX < 0) {
      switchRankingMetric(1);
    } else {
      switchRankingMetric(-1);
    }
  };

  const handleHideEntry = (entry: RankingEntry) => {
    const hiddenAt = new Date().toISOString();
    const targetKeys = new Set(entry.records.map(recordHideKey));
    const hiddenRecords = entry.records.map((record) => ({
      ...record,
      hidden: true,
      hiddenAt,
      hiddenReason: "admin_hidden",
    }));
    const localRecords = loadAllRecords();
    const nextLocal = localRecords.map((record) =>
      targetKeys.has(recordHideKey(record))
        ? {
            ...record,
            hidden: true,
            hiddenAt,
            hiddenReason: "admin_hidden",
          }
        : record
    );
    saveAllRecords(nextLocal);
    setRecords((current) =>
      current.filter((record) => !targetKeys.has(recordHideKey(record)))
    );
    for (const record of hiddenRecords) {
      void hideSharedRecord(record as SharedRecord);
    }
  };

  useEffect(() => {
    if (!shouldFocusMe || myRankIndex < 0) return;
    const timer = window.setTimeout(() => {
      focusedEntryRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }, 350);
    return () => window.clearTimeout(timer);
  }, [myRankIndex, shouldFocusMe]);

  useEffect(() => {
    const timer = window.setTimeout(() => setVisibleCount(RANKING_PAGE_SIZE), 0);
    return () => window.clearTimeout(timer);
  }, [calendarDate, period, prefectureFilter, rankingMetric, regionFilter]);

  return (
    <main className="mx-auto min-h-screen w-full max-w-[430px] overflow-x-hidden bg-gray-50">
      <AppHeader title="ランキング" />

      <div className="px-4 pb-80 pt-2">
        <section
          className="rounded-2xl bg-white p-3 shadow-sm [touch-action:pan-y]"
          onTouchStart={handleRankingTouchStart}
          onTouchEnd={handleRankingTouchEnd}
        >
          {rankingEntries.length === 0 ? (
            <div className="space-y-3">
              <div className="rounded-xl bg-gray-50 px-4 py-8 text-center text-sm font-bold text-gray-500">
                <div>
                  {rankingMetric === "unitPrice"
                    ? "まだ報酬単価ランキングはありません"
                    : "まだランキング記録はありません"}
                </div>
                <div className="mt-1 text-xs">
                  {rankingMetric === "unitPrice"
                    ? "良い案件を見つけたら共有してみましょう"
                    : "条件を変えると表示される場合があります"}
                </div>
              </div>
              {rankingMetric === "unitPrice" && PARTICIPATE_UNIT_PRICE_LINK}
            </div>
          ) : (
            <div className="space-y-3">
              {shouldFocusMe && myRankIndex < 0 && (
                <div className="rounded-2xl bg-amber-50 px-3 py-3 text-sm font-bold text-amber-800">
                  今回の記録はランキング対象外です。ランキングに参加するとここに表示されます。
                </div>
              )}
              <div className="rounded-2xl bg-green-50 px-3 py-2 text-sm font-bold text-green-800">
                {myRankIndex >= 0
                  ? `あなたの順位 ${myRankIndex + 1}位 / ${rankingEntries.length}人中`
                  : "この条件ではまだ順位がありません"}
              </div>
              {rankingMetric === "sales" && showSalesDetail && (
                <SalesDetailPanel entries={rankingEntries.slice(0, 10)} />
              )}
              {visibleTop3.map((entry, index) => (
                <div
                  key={entry.key}
                  ref={shouldFocusMe && entry.isCurrentUser ? focusedEntryRef : null}
                  className="space-y-3"
                >
                  <PodiumCard
                    entry={entry}
                    rank={index + 1}
                    metric={rankingMetric}
                    onSelect={() => setSelectedEntry({ entry, rank: index + 1 })}
                  />
                  {isAdmin && (
                    <AdminHideRecordButton onHide={() => handleHideEntry(entry)} />
                  )}
                  {index === 0 && showRankingAd && (
                    <AffiliateMiniAd
                      placement={`ranking-${period}-${regionFilter}-${rankingMetric}`}
                      slot={0}
                      driverWeight={0.6}
                    />
                  )}
                </div>
              ))}
              {visibleOthers.map((entry, index) => (
                <div
                  key={entry.key}
                  ref={shouldFocusMe && entry.isCurrentUser ? focusedEntryRef : null}
                >
                  <RankingCard
                    entry={entry}
                    rank={index + 4}
                    metric={rankingMetric}
                    onSelect={() => setSelectedEntry({ entry, rank: index + 4 })}
                  />
                  {isAdmin && (
                    <AdminHideRecordButton onHide={() => handleHideEntry(entry)} />
                  )}
                </div>
              ))}
              {visibleRankingEntries.length < rankingEntries.length && (
                <button
                  type="button"
                  onClick={() => setVisibleCount((current) => current + RANKING_PAGE_SIZE)}
                  className="w-full rounded-2xl border border-green-100 bg-green-50 px-4 py-3 text-sm font-black text-green-700 active:bg-green-100"
                >
                  もっと見る
                </button>
              )}
              {rankingMetric === "unitPrice" && PARTICIPATE_UNIT_PRICE_LINK}
            </div>
          )}
        </section>
      </div>

      <section className="fixed bottom-[calc(4rem+env(safe-area-inset-bottom))] left-1/2 z-40 w-full max-w-[430px] -translate-x-1/2 px-4">
        <div className="rounded-2xl border border-gray-100 bg-white/95 px-3 py-3 shadow-[0_-8px_24px_rgba(15,23,42,0.12)] backdrop-blur">
          <div className="flex rounded-2xl bg-gray-100 p-1">
            {rankingMetricOptions.map((item) => {
              const isActive = rankingMetric === item.key;
              const isDetailActive = item.key === "sales" && showSalesDetail;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => handleRankingMetricSelect(item.key)}
                  className={`${item.className} min-w-0 rounded-xl px-2 py-2 text-[11px] font-black ${
                    isActive
                      ? "bg-green-600 text-white shadow-sm"
                      : "text-gray-600"
                  } ${isDetailActive ? "ring-2 ring-green-200" : ""}`}
                >
                  <span className="block truncate">{item.label}</span>
                </button>
              );
            })}
          </div>

          <div className="mt-2 flex gap-1.5 overflow-x-auto pb-0.5">
            {periodOptions.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setPeriod(item.key)}
                className={`h-9 shrink-0 rounded-full px-3 text-[11px] font-bold ${
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
              className="mt-2 h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-xs font-bold"
            />
          )}

          <div className="mt-2 flex gap-1.5 overflow-x-auto pb-0.5">
            {regionOptions.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setRegionFilter(item.key)}
                className={`h-9 shrink-0 rounded-full px-3 text-[11px] font-bold ${
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
        </div>
      </section>

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

function SalesDetailPanel({ entries }: { entries: RankingEntry[] }) {
  return (
    <div className="space-y-2 rounded-2xl border border-green-100 bg-green-50/70 p-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="text-sm font-black text-green-900">売上のサービス別内訳</div>
          <div className="text-[11px] font-bold text-green-700">
            上位10名まで表示しています
          </div>
        </div>
        <div className="shrink-0 rounded-full bg-white px-2 py-1 text-[10px] font-black text-green-700 ring-1 ring-green-100">
          内訳
        </div>
      </div>

      <div className="space-y-2">
        {entries.map((entry, index) => (
          <div
            key={entry.key}
            className="rounded-xl border border-green-100 bg-white px-3 py-3"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="text-xs font-black text-green-700">
                  {index + 1}位
                </div>
                <div className="truncate text-sm font-black text-gray-900">
                  {entry.name}
                </div>
              </div>
              <div className="shrink-0 text-right">
                <div className="text-[10px] font-bold text-gray-500">合計</div>
                <div className="text-sm font-black text-gray-900">
                  {formatCurrency(entry.total)}
                </div>
              </div>
            </div>

            <div className="mt-2 grid grid-cols-2 gap-1.5">
              {serviceLabels.map((service) => (
                <div
                  key={service.key}
                  className="min-w-0 rounded-lg bg-gray-50 px-2 py-1.5"
                >
                  <div className="truncate text-[10px] font-bold text-gray-500">
                    {service.label}
                  </div>
                  <div className="text-xs font-black text-gray-900">
                    {formatCurrency(serviceAmount(entry, service.key))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AdminHideRecordButton({ onHide }: { onHide: () => void }) {
  const [confirming, setConfirming] = useState(false);

  if (confirming) {
    return (
      <div className="rounded-xl border border-red-100 bg-red-50 px-3 py-2">
        <div className="text-xs font-bold text-red-700">この記録を非表示にしますか？</div>
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            onClick={() => setConfirming(false)}
            className="h-8 flex-1 rounded-lg bg-white text-xs font-bold text-gray-600 ring-1 ring-gray-200"
          >
            キャンセル
          </button>
          <button
            type="button"
            onClick={onHide}
            className="h-8 flex-1 rounded-lg bg-red-600 text-xs font-bold text-white"
          >
            非表示
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-end">
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="rounded-full bg-red-50 px-3 py-1.5 text-xs font-bold text-red-600 ring-1 ring-red-100"
      >
        非表示
      </button>
    </div>
  );
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
  if (metric === "unitPrice") {
    return <UnitPriceRankingCard entry={entry} rank={rank} onSelect={onSelect} featured={rank === 1} />;
  }

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
  if (metric === "unitPrice") {
    return <UnitPriceRankingCard entry={entry} rank={rank} onSelect={onSelect} />;
  }

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
      {isSimple && (
        <div className="mt-1 text-[11px] font-bold text-gray-400">
          {details.join(" / ")}
        </div>
      )}
    </button>
  );
}

function UnitPriceRankingCard({
  entry,
  rank,
  onSelect,
  featured = false,
}: {
  entry: RankingEntry;
  rank: number;
  onSelect: () => void;
  featured?: boolean;
}) {
  const offer = entry.offer;
  const rankLabel = offer?.rank ? `${offer.rank}ランク` : "";
  const serviceLabel = offer?.service ?? "サービス -";
  const distanceLabel = offer ? `${offer.distanceKm.toLocaleString()}km` : "-";
  const isMedium = rank === 4 || rank === 5;
  const isCompact = rank >= 6 && rank <= 10;
  const isMinimal = rank >= 11;

  if (isMinimal) {
    return (
      <button
        type="button"
        onClick={onSelect}
        className="flex w-full items-center justify-between gap-2 rounded-xl border border-gray-100 bg-white px-3 py-2 text-left active:scale-[0.99]"
      >
        <div className="flex min-w-0 items-center gap-2">
          <span className="shrink-0 text-xs font-black text-gray-500">{rank}位</span>
          <span className="truncate text-sm font-bold text-gray-700">{serviceLabel}</span>
        </div>
        <div className="shrink-0 text-sm font-black text-gray-900">
          {mainMetricValue(entry, "unitPrice")}
        </div>
      </button>
    );
  }

  if (isCompact) {
    return (
      <button
        type="button"
        onClick={onSelect}
        className="block w-full rounded-xl border border-gray-100 bg-white p-2.5 text-left active:scale-[0.99]"
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <span className="shrink-0 rounded-full bg-gray-100 px-2 py-1 text-xs font-black text-gray-700">
              {rank}位
            </span>
            <span className="truncate text-sm font-black text-gray-900">{serviceLabel}</span>
          </div>
          <div className="shrink-0 text-base font-black text-gray-900">
            {mainMetricValue(entry, "unitPrice")}
          </div>
        </div>
        <div className="mt-1 truncate text-[10px] font-bold text-gray-500">
          距離 {distanceLabel}
        </div>
      </button>
    );
  }

  if (isMedium) {
    return (
      <button
        type="button"
        onClick={onSelect}
        className="block w-full rounded-2xl border border-gray-100 bg-white p-3 text-left active:scale-[0.99]"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-gray-100 px-2 py-1 text-xs font-black text-gray-700">
                {rank}位
              </span>
              {rankLabel && (
                <span className="rounded-full bg-green-600 px-2 py-0.5 text-[10px] font-bold text-white">
                  {rankLabel}
                </span>
              )}
            </div>
            <div className="mt-1 truncate text-sm font-bold text-green-700">
              {serviceLabel} / 距離 {distanceLabel}
            </div>
            <div className="mt-1 truncate text-xs font-bold text-gray-500">
              共有者: {entry.name}
            </div>
          </div>
          <div className="shrink-0 text-right">
            <div className="text-xl font-black text-gray-900">
              {mainMetricValue(entry, "unitPrice")}
            </div>
            <div className="text-[10px] font-bold text-green-700">報酬順</div>
          </div>
        </div>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`block w-full rounded-2xl border p-4 text-left active:scale-[0.99] ${
        featured
          ? "border-yellow-300 bg-yellow-50 shadow-md"
          : "border-gray-100 bg-white"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-black text-gray-900">{rank}位</span>
            {rankLabel && (
              <span className="rounded-full bg-green-600 px-2 py-0.5 text-[10px] font-bold text-white">
                {rankLabel}
              </span>
            )}
          </div>
          <div className="mt-1 text-2xl font-black text-gray-900">
            {mainMetricValue(entry, "unitPrice")}
          </div>
          <div className="mt-1 text-sm font-bold text-green-700">
            {offer?.service ?? "サービス -"} / 報酬単価ランキング
          </div>
        </div>
        <div className="shrink-0 text-right text-xs font-bold text-gray-500">
          {formatOfferAge(offer?.createdAt)}
        </div>
      </div>

      <div className="mt-3 rounded-xl bg-white/80 px-3 py-2 text-sm font-bold text-gray-700">
        距離 {offer ? `${offer.distanceKm.toLocaleString()}km` : "-"}
        {entry.unitPrice > 0 && (
          <span className="ml-2 text-xs text-gray-500">
            / 参考 {formatCurrency(entry.unitPrice)}/km
          </span>
        )}
      </div>

      <div className="mt-2 flex min-w-0 items-center justify-between gap-2 text-xs font-bold text-gray-500">
        <span className="min-w-0 truncate">共有者: {entry.name}</span>
        {entry.area && <span className="shrink-0 truncate">{entry.area}</span>}
      </div>
    </button>
  );
}


