"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AppHeader from "@/components/AppHeader";
import AppInstallGuide from "@/components/AppInstallGuide";
import BeginnerGuide from "@/components/BeginnerGuide";
import BottomMenu from "@/components/BottomMenu";
import FooterLinks from "@/components/FooterLinks";
import FirstStepGuide from "@/components/FirstStepGuide";
import PersonalDashboard from "@/components/PersonalDashboard";
import PersonalNewsCard from "@/components/PersonalNewsCard";
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
import { buildUbalogShareText, openXShare } from "@/lib/share";
import {
  fetchSharedRecords,
  mergeRecords,
  type SharedRecord,
} from "@/lib/sharedRecords";

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
  hidden?: boolean;
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
    desc: "登録リンクを見る",
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

function dedupeRecords(records: StoredRecord[]) {
  return mergeRecords(records as SharedRecord[], []) as StoredRecord[];
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
        void fetchSharedRecords().then((remoteRecords) => {
          if (remoteRecords.length > 0) {
            setRecords(dedupeRecords(remoteRecords as StoredRecord[]));
          }
        });
        return;
      }
      try {
        const localRecords = JSON.parse(raw) as StoredRecord[];
        setRecords(dedupeRecords(localRecords));
        void fetchSharedRecords().then((remoteRecords) => {
          if (remoteRecords.length === 0) return;
          setRecords(
            mergeRecords(localRecords as SharedRecord[], remoteRecords) as StoredRecord[]
          );
        });
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
  const currentMonth = today.slice(0, 7);

  const todayRecord = useMemo(() => {
    return records.find((item) => item.date === today) ?? null;
  }, [records, today]);

  const todayTotal = useMemo(() => {
    return todayRecord?.total ?? 0;
  }, [todayRecord]);

  const todayDeliveries = useMemo(() => {
    return todayRecord ? totalDeliveries(todayRecord) : 0;
  }, [todayRecord]);

  const todayHourly = useMemo(() => {
    return todayRecord ? hourlyValue(todayRecord) : 0;
  }, [todayRecord]);

  const thisWeekTotal = useMemo(() => {
    return records
      .filter((item) => item.date >= thisWeek.start && item.date <= thisWeek.end)
      .reduce((sum, item) => sum + item.total, 0);
  }, [records, thisWeek.end, thisWeek.start]);

  const monthRecords = useMemo(() => {
    return records.filter((item) => item.date.startsWith(currentMonth));
  }, [currentMonth, records]);

  const monthTotal = useMemo(() => {
    return monthRecords.reduce((sum, item) => sum + item.total, 0);
  }, [monthRecords]);

  const monthActiveDays = useMemo(() => {
    return new Set(
      monthRecords
        .filter((item) => item.total > 0 || totalDeliveries(item) > 0)
        .map((item) => item.date)
    ).size;
  }, [monthRecords]);

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
    <main className="mx-auto min-h-screen w-full max-w-[430px] overflow-x-hidden bg-gray-50 pb-24">
      <AppHeader />

      <div className="px-4 pb-[calc(8rem+env(safe-area-inset-bottom))] pt-4">
        <PersonalNewsCard />

        <BeginnerGuide />

        <FirstStepGuide
          recordsCount={records.length}
          onboardingDismissed={onboardingDismissed}
          onDismissOnboarding={dismissOnboarding}
        />

        <TodaySummarySection
          todayTotal={todayTotal}
          todayDeliveries={todayDeliveries}
          todayHourly={todayHourly}
          todayGoal={todayGoal}
          todayHighlight={hasTodayHighlight}
          thisWeekTotal={thisWeekTotal}
          weeklyGoal={weeklyGoal}
          monthTotal={monthTotal}
          monthActiveDays={monthActiveDays}
        />

        {records.length === 0 && onboardingDismissed && <WelcomeGuideCard />}

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

        <section className="mt-4 rounded-2xl bg-white p-4 shadow-sm">
          <div className="text-sm font-black text-gray-900">よく使う</div>
          <div className="mt-3 grid grid-cols-2 gap-2">
          {menuCards.map((card) => (
            <Link
              key={card.href}
              href={card.href}
              className="min-w-0 rounded-xl bg-gray-50 p-3 active:bg-green-50"
            >
              <div className="flex min-w-0 items-center gap-2">
                <div className="text-lg">{card.icon}</div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs font-black text-gray-900">{card.title}</div>
                  <div className="mt-0.5 truncate text-[10px] font-bold text-gray-500">
                    {card.desc}
                  </div>
                </div>
              </div>
            </Link>
          ))}
          </div>
        </section>

        {showRecruitGuide && (
          <Link
            href="/recruit"
            className="mt-4 block rounded-2xl border border-green-100 bg-white p-4 shadow-sm active:bg-green-50"
          >
            <div className="text-sm font-black text-gray-900">
              これから配達を始める方へ
            </div>
            <div className="mt-1 text-xs font-bold leading-5 text-gray-500">
              配達員登録リンクをまとめています。
            </div>
            <div className="mt-2 inline-flex rounded-full bg-green-50 px-3 py-1.5 text-xs font-black text-green-700">
              配達を始める
            </div>
          </Link>
        )}

        <AppInstallGuide />

        <section className="mt-4 rounded-2xl bg-white p-4 shadow-sm">
          <div className="flex min-w-0 items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-sm font-black text-gray-900">ウバログを紹介</div>
              <div className="mt-1 truncate text-xs font-bold text-gray-500">
                配達員向けの記録アプリをシェアできます
              </div>
            </div>
            <button
              type="button"
              onClick={() => openXShare(buildUbalogShareText())}
              className="shrink-0 rounded-full border border-green-200 bg-green-50 px-3 py-2 text-xs font-black text-green-700 active:bg-green-100"
            >
              シェア
            </button>
          </div>
        </section>

        <FooterLinks />
      </div>

      <BottomMenu />
    </main>
  );
}

function TodaySummarySection({
  todayTotal,
  todayDeliveries,
  todayHourly,
  todayGoal,
  todayHighlight,
  thisWeekTotal,
  weeklyGoal,
  monthTotal,
  monthActiveDays,
}: {
  todayTotal: number;
  todayDeliveries: number;
  todayHourly: number;
  todayGoal: number;
  todayHighlight: boolean;
  thisWeekTotal: number;
  weeklyGoal: number;
  monthTotal: number;
  monthActiveDays: number;
}) {
  const hasTodayRecord = todayTotal > 0 || todayDeliveries > 0 || todayHourly > 0;

  return (
    <section className="mt-4 rounded-2xl bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="text-base font-black text-gray-900">今日のサマリー</div>
          <div className="mt-0.5 text-xs font-bold text-gray-500">
            記録するとランキングや月間集計に反映されます
          </div>
        </div>
        {todayHighlight && <NewBadge />}
      </div>

      {hasTodayRecord ? (
        <>
          <div className="mt-3 grid grid-cols-3 gap-2">
            <MiniMetric label="売上" value={`￥${todayTotal.toLocaleString()}`} />
            <MiniMetric label="件数" value={`${todayDeliveries.toLocaleString()}件`} />
            <MiniMetric
              label="時給"
              value={todayHourly > 0 ? `￥${todayHourly.toLocaleString()}` : "-"}
            />
          </div>
          {todayGoal > 0 && (
            <div className="mt-3 flex items-center justify-between rounded-xl bg-green-50 px-3 py-2 text-xs font-black text-green-700">
              <span>今日の目標</span>
              <span>￥{todayGoal.toLocaleString()}</span>
            </div>
          )}
        </>
      ) : (
        <div className="mt-3 rounded-2xl bg-green-50 px-3 py-3">
          <div className="text-sm font-black text-green-800">まずは今日の記録から</div>
          <div className="mt-1 text-xs font-bold leading-5 text-green-700">
            金額だけでも保存できます。件数や稼働時間を入れると振り返りやすくなります。
          </div>
          <Link
            href="/record"
            className="mt-3 inline-flex rounded-full bg-green-600 px-4 py-2 text-xs font-black text-white active:bg-green-700"
          >
            今日の記録をする
          </Link>
        </div>
      )}

      <div className="mt-3 grid grid-cols-2 gap-2">
        <MiniMetric
          label="今週"
          value={`￥${thisWeekTotal.toLocaleString()}`}
          note={weeklyGoal > 0 ? `目標 ￥${weeklyGoal.toLocaleString()}` : undefined}
        />
        <MiniMetric
          label="今月"
          value={`￥${monthTotal.toLocaleString()}`}
          note={`${monthActiveDays.toLocaleString()}日記録`}
        />
      </div>
    </section>
  );
}

function MiniMetric({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note?: string;
}) {
  return (
    <div className="min-w-0 rounded-2xl bg-gray-50 px-3 py-3">
      <div className="truncate text-[11px] font-black text-gray-500">{label}</div>
      <div className="mt-1 truncate text-lg font-black text-gray-900">{value}</div>
      {note && <div className="mt-1 truncate text-[10px] font-bold text-green-700">{note}</div>}
    </div>
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
