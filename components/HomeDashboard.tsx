"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AppHeader from "@/components/AppHeader";
import BottomMenu from "@/components/BottomMenu";
import FirstStepGuide from "@/components/FirstStepGuide";
import PersonalDashboard from "@/components/PersonalDashboard";
import PersonalNewsCard from "@/components/PersonalNewsCard";
import RocketNowStatsCard from "@/components/RocketNowStatsCard";
import {
  getHighlightUpdate,
  hasHighlight,
  type HighlightUpdate,
} from "@/lib/highlights";
import { getMonthlyGoal } from "@/lib/goals";
import {
  ONBOARDING_DISMISSED_KEY,
  readStorageBoolean,
  writeStorageBoolean,
} from "@/lib/onboarding";
import {
  ensureActiveUserFromProfile,
  getActiveUser,
  getDisplayNameFromProfileOrUser,
} from "@/lib/users";

type Profile = {
  displayName?: string;
  name?: string;
  nickname: string;
  area: string;
  mainService: string;
  rankingName: string;
};

type StoredRecord = {
  date: string;
  displayName?: string;
  name?: string;
  rankingName?: string;
  nickname?: string;
  total: number;
  ranking?: boolean;
  hourly?: number;
  workMinutes?: number;
  services?: Partial<Record<ServiceKey, { amount?: number; deliveries?: number }>>;
};

type ServiceKey = "uber" | "demae" | "menu" | "rocket" | "other";
type RankingTab = "sales" | "hourly" | "deliveries";

const RECORDS_STORAGE_KEY = "ubalog-records";
const PROFILE_STORAGE_KEY = "ubalog-profile";
const rankingTabs: { key: RankingTab; label: string }[] = [
  { key: "sales", label: "売上" },
  { key: "hourly", label: "時給" },
  { key: "deliveries", label: "件数" },
];

const menuCards = [
  {
    href: "/record",
    title: "記録",
    desc: "毎日の売上を記録する",
    icon: "📝",
  },
  {
    href: "/history",
    title: "記録一覧",
    desc: "保存した記録を一覧で確認できます",
    icon: "📅",
  },
  {
    href: "/ranking",
    title: "ランキング",
    desc: "ランキングを見る",
    icon: "🏆",
  },
  {
    href: "/realtime",
    title: "リアルタイム共有",
    desc: "今の配達状況を確認する",
    icon: "📡",
  },
  {
    href: "/recruit",
    title: "配達員募集",
    desc: "特典やキャンペーンを見る",
    icon: "🎁",
  },
  {
    href: "/news",
    title: "ニュース",
    desc: "最新情報をチェック",
    icon: "📰",
  },
  {
    href: "/game",
    title: "ゲーム",
    desc: "息抜きコンテンツ",
    icon: "🎮",
  },
];

function todayIsoDate() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function yesterdayIsoDate() {
  const now = new Date();
  now.setDate(now.getDate() - 1);
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function toIsoDate(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function startOfWeek(date: Date) {
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const start = new Date(date);
  start.setDate(date.getDate() + diff);
  return start;
}

function weekRange(diffWeeks: number) {
  const base = startOfWeek(new Date());
  base.setDate(base.getDate() + diffWeeks * 7);
  const end = new Date(base);
  end.setDate(base.getDate() + 6);
  return { start: toIsoDate(base), end: toIsoDate(end) };
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

function displayNameFromProfile(profile: Profile | null) {
  return getDisplayNameFromProfileOrUser(profile, getActiveUser());
}

function totalDeliveries(record: StoredRecord) {
  return (Object.keys(record.services ?? {}) as ServiceKey[]).reduce(
    (sum, key) => sum + (record.services?.[key]?.deliveries ?? 0),
    0
  );
}

function hourlyValue(record: StoredRecord) {
  if (typeof record.hourly === "number" && record.hourly > 0) return record.hourly;
  if (!record.workMinutes) return 0;
  return Math.floor(record.total / (record.workMinutes / 60));
}

function rankingValue(record: StoredRecord, tab: RankingTab) {
  if (tab === "hourly") return hourlyValue(record);
  if (tab === "deliveries") return totalDeliveries(record);
  return record.total;
}

function formatRankingValue(value: number, tab: RankingTab) {
  if (tab === "deliveries") return `${value.toLocaleString()}件`;
  return `￥${value.toLocaleString()}`;
}

export default function HomeDashboard() {
  const [records, setRecords] = useState<StoredRecord[]>([]);
  const [displayName, setDisplayName] = useState("匿名配達員");
  const [highlight, setHighlight] = useState<HighlightUpdate | null>(null);
  const [weeklyGoal, setWeeklyGoal] = useState(0);
  const [todayGoal, setTodayGoal] = useState(0);
  const [mainService, setMainService] = useState("");
  const [onboardingDismissed, setOnboardingDismissed] = useState(false);
  const [rankingTab, setRankingTab] = useState<RankingTab>("sales");

  useEffect(() => {
    const load = () => {
      const profile = loadProfile();
      ensureActiveUserFromProfile(profile);
      setDisplayName(displayNameFromProfile(profile));
      setMainService(profile?.mainService?.trim() ?? "");
      setOnboardingDismissed(readStorageBoolean(ONBOARDING_DISMISSED_KEY));
      setHighlight(getHighlightUpdate());
      const plan = getMonthlyGoal(todayIsoDate().slice(0, 7));
      const thisWeekRange = weekRange(0);
      setWeeklyGoal(
        plan?.dailyGoals
          .filter((goal) => goal.date >= thisWeekRange.start && goal.date <= thisWeekRange.end)
          .reduce((sum, goal) => sum + goal.targetAmount, 0) ?? 0
      );
      setTodayGoal(plan?.dailyGoals.find((goal) => goal.date === todayIsoDate())?.targetAmount ?? 0);

      const raw = localStorage.getItem(RECORDS_STORAGE_KEY);
      if (!raw) {
        setRecords([]);
        return;
      }
      try {
        setRecords(JSON.parse(raw));
      } catch {
        setRecords([]);
      }
    };

    const timer = window.setTimeout(load, 0);
    window.addEventListener("focus", load);
    window.addEventListener("ubalog-profile-updated", load);
    window.addEventListener("ubalog-highlight-updated", load);
    window.addEventListener("ubalog-goals-updated", load);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("focus", load);
      window.removeEventListener("ubalog-profile-updated", load);
      window.removeEventListener("ubalog-highlight-updated", load);
      window.removeEventListener("ubalog-goals-updated", load);
    };
  }, []);

  const today = todayIsoDate();
  const yesterday = yesterdayIsoDate();
  const thisWeek = weekRange(0);
  const lastWeek = weekRange(-1);

  const todayTotal = useMemo(() => {
    const record = records.find((item) => item.date === today);
    return record?.total ?? 0;
  }, [records, today]);

  const thisWeekTotal = useMemo(() => {
    return records
      .filter((item) => item.date >= thisWeek.start && item.date <= thisWeek.end)
      .reduce((sum, item) => sum + item.total, 0);
  }, [records, thisWeek.end, thisWeek.start]);

  const lastWeekTotal = useMemo(() => {
    return records
      .filter((item) => item.date >= lastWeek.start && item.date <= lastWeek.end)
      .reduce((sum, item) => sum + item.total, 0);
  }, [lastWeek.end, lastWeek.start, records]);

  const yesterdayTotal = useMemo(() => {
    const record = records.find((item) => item.date === yesterday);
    return record?.total ?? 0;
  }, [records, yesterday]);

  const yesterdayTop3 = useMemo(() => {
    return records
      .filter(
        (item) =>
          item.date === yesterday &&
          item.ranking !== false &&
          item.total > 0 &&
          rankingValue(item, rankingTab) > 0
      )
      .sort((a, b) => {
        const diff = rankingValue(b, rankingTab) - rankingValue(a, rankingTab);
        if (diff !== 0) return diff;
        if (b.total !== a.total) return b.total - a.total;
        return (b.hourly ?? 0) - (a.hourly ?? 0);
      })
      .slice(0, 3)
      .map((item, index) => ({
        rank: index + 1,
        name:
          item.displayName?.trim() ||
          item.name?.trim() ||
          item.rankingName?.trim() ||
          item.nickname?.trim() ||
          displayName,
        value: rankingValue(item, rankingTab),
      }));
  }, [displayName, rankingTab, records, yesterday]);

  const hasTodayHighlight =
    highlight?.recordDate === today && hasHighlight("today", highlight);
  const showRecruitGuide = records.length === 0 || !mainService;

  const dismissOnboarding = () => {
    writeStorageBoolean(ONBOARDING_DISMISSED_KEY, true);
    setOnboardingDismissed(true);
  };

  return (
    <main className="mx-auto min-h-screen w-full max-w-[430px] bg-gray-50 pb-24">
      <AppHeader />

      <div className="px-4 pb-[calc(8rem+env(safe-area-inset-bottom))] pt-4">
        <PersonalNewsCard />

        <section className="rounded-2xl bg-white p-4 shadow-sm">
          <div className="grid grid-cols-2 gap-3">
            <SummaryCard
              title="先週"
              value={lastWeekTotal}
              subTitle="今週"
              subValue={thisWeekTotal}
              goal={weeklyGoal}
              highlight={hasHighlight("lastWeek", highlight)}
            />
            <SummaryCard
              title="前日"
              value={yesterdayTotal}
              subTitle="今日"
              subValue={todayTotal}
              goal={todayGoal}
              highlight={hasHighlight("yesterday", highlight)}
              subHighlight={hasTodayHighlight}
            />
          </div>
        </section>

        {records.length === 0 && <WelcomeGuideCard />}

        <FirstStepGuide
          recordsCount={records.length}
          onboardingDismissed={onboardingDismissed}
          onDismissOnboarding={dismissOnboarding}
        />

        <RocketNowStatsCard />

        <section className="mt-4 rounded-2xl bg-white p-4 shadow-sm">
          <div className="text-base font-bold text-gray-900">前日のランキング TOP3</div>
          <div className="mt-3 grid grid-cols-3 gap-1 rounded-2xl bg-gray-100 p-1">
            {rankingTabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setRankingTab(tab.key)}
                className={`h-8 rounded-xl text-xs font-black ${
                  rankingTab === tab.key
                    ? "bg-green-600 text-white shadow-sm"
                    : "text-gray-600"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="mt-3 space-y-3">
            {yesterdayTop3.length === 0 ? (
              <div className="rounded-xl bg-gray-50 px-3 py-6 text-center text-sm text-gray-500">
                前日のランキング参加者はいません
              </div>
            ) : (
              yesterdayTop3.map((item) => (
                <div
                  key={item.rank}
                  className="flex items-center justify-between rounded-xl bg-gray-50 px-3 py-3"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold text-white ${
                        item.rank === 1
                          ? "bg-yellow-500"
                          : item.rank === 2
                          ? "bg-gray-400"
                          : "bg-amber-700"
                      }`}
                    >
                      {item.rank}
                    </div>
                    <div className="text-sm font-semibold text-gray-800">{item.name}</div>
                  </div>

                  <div className="text-sm font-bold text-gray-900">
                    {formatRankingValue(item.value, rankingTab)}
                  </div>
                </div>
              ))
            )}
          </div>

          <Link
            href="/ranking"
            className="mt-4 block rounded-xl border border-green-600 px-4 py-3 text-center text-sm font-bold text-green-700"
          >
            ランキングを見る
          </Link>
        </section>

        <PersonalDashboard />

        <section className="mt-4 space-y-3">
          {menuCards.map((card) => (
            <Link
              key={card.href}
              href={card.href}
              className="block rounded-2xl bg-white p-4 shadow-sm"
            >
              <div className="flex items-center gap-3">
                <div className="text-2xl">{card.icon}</div>
                <div className="flex-1">
                  <div className="font-bold text-gray-900">{card.title}</div>
                  <div className="mt-1 text-sm text-gray-500">{card.desc}</div>
                </div>
                <div className="text-gray-400">›</div>
              </div>
            </Link>
          ))}
        </section>

        {showRecruitGuide && (
          <Link
            href="/recruit"
            className="mt-4 block rounded-2xl border border-green-100 bg-white p-4 shadow-sm active:bg-green-50"
          >
            <div className="text-sm font-black text-gray-900">
              配達を始めたい人はこちら
            </div>
            <div className="mt-1 text-xs font-bold text-green-700">
              配達員募集を見る
            </div>
          </Link>
        )}
      </div>

      <BottomMenu />
    </main>
  );
}

function WelcomeGuideCard() {
  return (
    <section className="mt-4 rounded-2xl border border-green-100 bg-white p-4 shadow-sm">
      <div className="text-base font-black text-gray-900">ウバログへようこそ</div>
      <p className="mt-1 text-sm font-bold leading-6 text-gray-600">
        配達の売上を記録して、ランキングやニュースで振り返れます。
      </p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Link
          href="/record"
          className="rounded-xl bg-green-600 px-3 py-2.5 text-center text-xs font-black text-white active:bg-green-700"
        >
          今日の記録をする
        </Link>
        <Link
          href="/recruit"
          className="rounded-xl border border-green-200 bg-green-50 px-3 py-2.5 text-center text-xs font-black text-green-700 active:bg-green-100"
        >
          配達員募集を見る
        </Link>
      </div>
    </section>
  );
}

function NewBadge() {
  return (
    <span className="rounded-full bg-pink-100 px-1.5 py-0.5 text-[9px] font-black text-pink-600">
      NEW! ✨
    </span>
  );
}

function SummaryCard({
  title,
  value,
  subTitle,
  subValue,
  goal,
  highlight,
  subHighlight,
}: {
  title: string;
  value: number;
  subTitle: string;
  subValue: number;
  goal: number;
  highlight: boolean;
  subHighlight?: boolean;
}) {
  return (
    <div className="rounded-2xl bg-gray-50 px-3 py-3">
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs font-bold text-gray-500">{title}</div>
        {highlight && <NewBadge />}
      </div>
      <div className="mt-1 text-2xl font-black text-gray-900">￥{value.toLocaleString()}</div>
      <div className="mt-2 flex items-center justify-between gap-2 text-[11px] font-bold text-gray-500">
        <span>{subTitle}</span>
        <span className="flex min-w-0 items-center justify-end gap-1">
          <span>￥{subValue.toLocaleString()}</span>
          {subHighlight && <NewBadge />}
        </span>
      </div>
      {goal > 0 && (
        <div className="mt-1 flex items-center justify-between text-[10px] font-bold text-green-700">
          <span>目標</span>
          <span>￥{goal.toLocaleString()}</span>
        </div>
      )}
    </div>
  );
}
