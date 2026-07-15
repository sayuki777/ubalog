"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { enableAdminFromQuery, isAdminMode } from "@/lib/admin";
import {
  REALTIME_OFFERS_STORAGE_KEY,
  loadLocalRealtimeOffers,
  saveLocalRealtimeOffers,
  type SharedRealtimeOffer,
} from "@/lib/realtime";

const RECORDS_STORAGE_KEY = "ubalog-records";
const NEWS_STORAGE_KEY = "ubalog-news";

type ServiceKey = "uber" | "demae" | "menu" | "rocket" | "other";

type TestRecord = {
  isTestData: true;
  id: string;
  date: string;
  userId: string;
  deviceId: string;
  displayName: string;
  name: string;
  prefecture: string;
  region: string;
  area: string;
  total: number;
  ranking: boolean;
  hourly: number;
  workMinutes: number;
  startTime: string;
  endTime: string;
  breakMinutes: number;
  services: Record<ServiceKey, { amount: number; deliveries: number }>;
  createdAt: string;
  updatedAt: string;
};

type TestNewsItem = {
  isTestData: true;
  id: string;
  source: "personal";
  category: "record" | "ranking" | "breaking";
  title: string;
  message: string;
  iconType: "record" | "rank1" | "breaking";
  publishedAt: string;
  createdAt: string;
  recordDate?: string;
  offerId?: string;
  type?: "record_saved" | "ranking_top" | "breaking_realtime";
};

type PanelMessage = {
  tone: "success" | "info";
  text: string;
};

function readArrayStorage<T>(key: string): T[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(key) ?? "[]");
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

function writeArrayStorage<T>(key: string, items: T[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(items));
}

function toIsoDate(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function offsetIsoDate(offsetDays: number) {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return toIsoDate(date);
}

function testServices(main: ServiceKey, amount: number, deliveries: number) {
  const blank = { amount: 0, deliveries: 0 };
  return {
    uber: main === "uber" ? { amount, deliveries } : blank,
    demae: main === "demae" ? { amount, deliveries } : blank,
    menu: main === "menu" ? { amount, deliveries } : blank,
    rocket: main === "rocket" ? { amount, deliveries } : blank,
    other: main === "other" ? { amount, deliveries } : blank,
  };
}

function buildTestRecords(now = new Date()): TestRecord[] {
  const createdAt = now.toISOString();
  const monthDate = offsetIsoDate(-7);
  const rows = [
    {
      id: "test-record-1",
      date: toIsoDate(now),
      name: "テスト配達員1",
      total: 12400,
      deliveries: 18,
      workMinutes: 300,
      service: "uber" as const,
      area: "新宿",
    },
    {
      id: "test-record-2",
      date: toIsoDate(now),
      name: "テスト配達員2",
      total: 9800,
      deliveries: 12,
      workMinutes: 180,
      service: "rocket" as const,
      area: "渋谷",
    },
    {
      id: "test-record-3",
      date: offsetIsoDate(-1),
      name: "テスト配達員3",
      total: 15600,
      deliveries: 22,
      workMinutes: 360,
      service: "menu" as const,
      area: "池袋",
    },
    {
      id: "test-record-4",
      date: monthDate,
      name: "テスト配達員4",
      total: 8800,
      deliveries: 10,
      workMinutes: 240,
      service: "demae" as const,
      area: "品川",
    },
  ];

  return rows.map((row, index) => ({
    isTestData: true,
    id: row.id,
    date: row.date,
    userId: `test-user-${index + 1}`,
    deviceId: `test-device-${index + 1}`,
    displayName: row.name,
    name: row.name,
    prefecture: "東京都",
    region: "東日本",
    area: row.area,
    total: row.total,
    ranking: true,
    hourly: Math.floor(row.total / (row.workMinutes / 60)),
    workMinutes: row.workMinutes,
    startTime: "10:00",
    endTime: "15:00",
    breakMinutes: 0,
    services: testServices(row.service, row.total, row.deliveries),
    createdAt,
    updatedAt: createdAt,
  }));
}

function buildTestOffers(now = new Date()): SharedRealtimeOffer[] {
  const createdAt = now.toISOString();
  const rows = [
    {
      id: "test-offer-1",
      name: "テスト配達員1",
      service: "Uber",
      amount: 1200,
      distanceKm: 2,
      rank: "A",
      lat: 35.6812,
      lng: 139.7671,
    },
    {
      id: "test-offer-2",
      name: "テスト配達員2",
      service: "ロケナウ",
      amount: 900,
      distanceKm: 3,
      rank: "B",
      lat: 35.6896,
      lng: 139.7006,
    },
    {
      id: "test-offer-3",
      name: "テスト配達員3",
      service: "menu",
      amount: 650,
      distanceKm: 1,
      rank: "S",
      lat: 35.6586,
      lng: 139.7454,
    },
    {
      id: "test-offer-4",
      name: "テスト配達員4",
      service: "出前館",
      amount: 1800,
      distanceKm: 5,
      rank: "C",
      lat: 35.7101,
      lng: 139.8107,
    },
  ];

  return rows.map((row, index) => ({
    isTestData: true,
    id: row.id,
    createdAt,
    name: row.name,
    userName: row.name,
    displayName: row.name,
    deviceId: `test-device-${index + 1}`,
    area: "東京都内",
    service: row.service,
    amount: row.amount,
    distanceKm: row.distanceKm,
    unitPrice: Math.floor(row.amount / row.distanceKm),
    rank: row.rank,
    comment: "",
    lat: row.lat,
    lng: row.lng,
  }));
}

function buildTestNews(now = new Date()): TestNewsItem[] {
  const createdAt = now.toISOString();
  return [
    {
      isTestData: true,
      id: "test-news-record",
      source: "personal",
      category: "record",
      type: "record_saved",
      title: "テスト配達員1が今日の記録を保存しました",
      message: "売上と件数のニュース表示を確認できます。",
      iconType: "record",
      recordDate: toIsoDate(now),
      publishedAt: createdAt,
      createdAt,
    },
    {
      isTestData: true,
      id: "test-news-ranking",
      source: "personal",
      category: "ranking",
      type: "ranking_top",
      title: "ランキング更新の表示確認",
      message: "ランキング系ニュースの見え方を確認できます。",
      iconType: "rank1",
      recordDate: toIsoDate(now),
      publishedAt: createdAt,
      createdAt,
    },
    {
      isTestData: true,
      id: "test-news-realtime",
      source: "personal",
      category: "breaking",
      type: "breaking_realtime",
      title: "リアルタイム共有の表示確認",
      message: "共有投稿ニュースから地図へ移動できます。",
      iconType: "breaking",
      offerId: "test-offer-1",
      publishedAt: createdAt,
      createdAt,
    },
  ];
}

function isTestData(item: unknown) {
  return typeof item === "object" && item !== null && (item as { isTestData?: unknown }).isTestData === true;
}

export default function AdminTestDataPanel() {
  const [admin, setAdmin] = useState(false);
  const [message, setMessage] = useState<PanelMessage | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setAdmin(enableAdminFromQuery() || isAdminMode());
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const linkItems = useMemo(
    () => [
      { href: "/ranking", label: "ランキングを見る" },
      { href: "/ranking?tab=unitPrice", label: "単価ランキングを見る" },
      { href: "/realtime", label: "リアルタイム共有を見る" },
      { href: "/news", label: "ニュースを見る" },
    ],
    []
  );

  if (!admin) return null;

  const addRecordData = () => {
    const current = readArrayStorage<unknown>(RECORDS_STORAGE_KEY);
    const production = current.filter((item) => !isTestData(item));
    writeArrayStorage(RECORDS_STORAGE_KEY, [...production, ...buildTestRecords()]);
    window.dispatchEvent(new Event("ubalog-records-updated"));
    setConfirmDelete(false);
    setMessage({ tone: "success", text: "ランキング確認データを追加しました" });
  };

  const addOfferData = () => {
    const production = loadLocalRealtimeOffers().filter((item) => !isTestData(item));
    saveLocalRealtimeOffers([...production, ...buildTestOffers()]);
    window.dispatchEvent(new Event("ubalog-realtime-offers-updated"));
    setConfirmDelete(false);
    setMessage({ tone: "success", text: "単価ランキング確認データを追加しました" });
  };

  const addNewsData = () => {
    const current = readArrayStorage<unknown>(NEWS_STORAGE_KEY);
    const production = current.filter((item) => !isTestData(item));
    writeArrayStorage(NEWS_STORAGE_KEY, [...buildTestNews(), ...production]);
    window.dispatchEvent(new Event("ubalog-news-updated"));
    setConfirmDelete(false);
    setMessage({ tone: "success", text: "ニュース確認データを追加しました" });
  };

  const deleteTestData = () => {
    const records = readArrayStorage<unknown>(RECORDS_STORAGE_KEY).filter((item) => !isTestData(item));
    const offers = readArrayStorage<unknown>(REALTIME_OFFERS_STORAGE_KEY).filter(
      (item) => !isTestData(item)
    );
    const news = readArrayStorage<unknown>(NEWS_STORAGE_KEY).filter((item) => !isTestData(item));

    writeArrayStorage(RECORDS_STORAGE_KEY, records);
    writeArrayStorage(REALTIME_OFFERS_STORAGE_KEY, offers);
    writeArrayStorage(NEWS_STORAGE_KEY, news);
    window.dispatchEvent(new Event("ubalog-records-updated"));
    window.dispatchEvent(new Event("ubalog-realtime-offers-updated"));
    window.dispatchEvent(new Event("ubalog-news-updated"));
    setConfirmDelete(false);
    setMessage({ tone: "success", text: "テストデータを削除しました" });
  };

  return (
    <section className="rounded-2xl border border-green-100 bg-white p-4 shadow-sm">
      <div className="text-xs font-black text-green-700">管理者モード</div>
      <h2 className="mt-1 text-lg font-black text-gray-900">表示確認用データ</h2>
      <p className="mt-2 text-sm font-bold leading-6 text-gray-600">
        ランキングやリアルタイム共有の見え方を確認するためのテストデータを作成できます。
      </p>

      <div className="mt-4 grid gap-2">
        <button
          type="button"
          onClick={addRecordData}
          className="rounded-xl bg-green-600 px-3 py-3 text-sm font-black text-white active:bg-green-700"
        >
          ランキング確認データを追加
        </button>
        <button
          type="button"
          onClick={addOfferData}
          className="rounded-xl bg-green-50 px-3 py-3 text-sm font-black text-green-700 active:bg-green-100"
        >
          単価ランキング確認データを追加
        </button>
        <button
          type="button"
          onClick={addNewsData}
          className="rounded-xl bg-green-50 px-3 py-3 text-sm font-black text-green-700 active:bg-green-100"
        >
          ニュース確認データを追加
        </button>
      </div>

      {message && (
        <div
          className={`mt-3 rounded-xl px-3 py-2 text-xs font-black ${
            message.tone === "success"
              ? "bg-green-50 text-green-700"
              : "bg-gray-50 text-gray-700"
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        {linkItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="rounded-full bg-gray-100 px-3 py-2 text-xs font-black text-gray-700 active:bg-gray-200"
          >
            {item.label}
          </Link>
        ))}
      </div>

      <div className="mt-4 rounded-2xl bg-orange-50 p-3">
        <button
          type="button"
          onClick={() => setConfirmDelete(true)}
          className="w-full rounded-xl bg-white px-3 py-2.5 text-sm font-black text-orange-700 active:bg-orange-100"
        >
          テストデータを削除
        </button>
        {confirmDelete && (
          <div className="mt-3">
            <p className="text-sm font-black text-orange-900">
              表示確認用のテストデータだけ削除しますか？
            </p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={deleteTestData}
                className="rounded-xl bg-orange-500 px-3 py-2 text-xs font-black text-white active:bg-orange-600"
              >
                削除する
              </button>
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="rounded-xl bg-white px-3 py-2 text-xs font-black text-orange-700 active:bg-orange-100"
              >
                やめる
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
