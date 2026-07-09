"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AppHeader from "@/components/AppHeader";
import BottomMenu from "@/components/BottomMenu";

type StoredRecord = {
  date: string;
  total: number;
  ranking: boolean;
  hourly: number;
};

const STORAGE_KEY = "ubalog-records";

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

function currentMonthPrefix() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function nicknameFromIndex(index: number) {
  if (index === 0) return "デリバリーマン";
  if (index === 1) return "ウーバー太郎";
  if (index === 2) return "出前の達人";
  return `参加者${index + 1}`;
}

export default function HomeDashboard() {
  const [records, setRecords] = useState<StoredRecord[]>([]);

  useEffect(() => {
    const load = () => {
      const raw = localStorage.getItem(STORAGE_KEY);
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

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("focus", load);
    };
  }, []);

  const today = todayIsoDate();
  const yesterday = yesterdayIsoDate();
  const monthPrefix = currentMonthPrefix();

  const todayTotal = useMemo(() => {
    const record = records.find((item) => item.date === today);
    return record?.total ?? 0;
  }, [records, today]);

  const monthTotal = useMemo(() => {
    return records
      .filter((item) => item.date.startsWith(monthPrefix))
      .reduce((sum, item) => sum + item.total, 0);
  }, [records, monthPrefix]);

  const yesterdayTop3 = useMemo(() => {
    return records
      .filter((item) => item.date === yesterday && item.ranking)
      .sort((a, b) => {
        if (b.total !== a.total) return b.total - a.total;
        return b.hourly - a.hourly;
      })
      .slice(0, 3)
      .map((item, index) => ({
        rank: index + 1,
        name: nicknameFromIndex(index),
        amount: item.total,
      }));
  }, [records, yesterday]);

  return (
    <main className="mx-auto min-h-screen w-full max-w-[430px] bg-gray-50 pb-24">
      <AppHeader />

      <div className="px-4 pt-4">
        <section className="rounded-2xl bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="text-base font-bold text-gray-900">今日のサマリー</div>
            <div className="rounded-full bg-green-50 px-3 py-1 text-xs font-bold text-green-700">
              {today.replaceAll("-", "/")}
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <StatCard title="今日の売上" value={`￥${todayTotal.toLocaleString()}`} />
            <StatCard title="今月の売上" value={`￥${monthTotal.toLocaleString()}`} />
          </div>
        </section>

        <section className="mt-4 rounded-2xl bg-white p-4 shadow-sm">
          <div className="text-base font-bold text-gray-900">前日のランキング TOP3</div>

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
                    ￥{item.amount.toLocaleString()}
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
      </div>

      <BottomMenu />
    </main>
  );
}

function StatCard({
  title,
  value,
}: {
  title: string;
  value: string;
}) {
  return (
    <div className="rounded-xl bg-gray-50 px-4 py-4">
      <div className="text-xs font-semibold text-gray-500">{title}</div>
      <div className="mt-2 text-2xl font-bold text-gray-900">{value}</div>
    </div>
  );
}
