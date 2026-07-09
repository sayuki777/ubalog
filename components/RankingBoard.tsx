"use client";

import { useEffect, useMemo, useState } from "react";
import AppHeader from "@/components/AppHeader";
import BottomMenu from "@/components/BottomMenu";

const STORAGE_KEY = "ubalog-records";

type StoredRecord = {
  date: string;
  total: number;
  ranking: boolean;
  hourly: number;
  workMinutes: number;
  startTime: string;
  endTime: string;
  breakMinutes: number;
  services: {
    uber: { amount: number; deliveries: number };
    demae: { amount: number; deliveries: number };
    menu: { amount: number; deliveries: number };
    rocket: { amount: number; deliveries: number };
    other: { amount: number; deliveries: number };
  };
  createdAt: string;
  updatedAt: string;
};

function yesterdayIsoDate() {
  const now = new Date();
  now.setDate(now.getDate() - 1);
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function shiftIsoDate(iso: string, diffDays: number) {
  const d = new Date(iso);
  d.setDate(d.getDate() + diffDays);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatDate(iso: string) {
  return iso.replaceAll("-", "/");
}

function formatMinutes(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}:${String(m).padStart(2, "0")}`;
}

function nicknameFromRecord(index: number, record: StoredRecord) {
  if (record.createdAt) {
    return `参加者${index + 1}`;
  }
  return `ユーザー${index + 1}`;
}

export default function RankingBoard() {
  const [records, setRecords] = useState<StoredRecord[]>([]);
  const [targetDate, setTargetDate] = useState(yesterdayIsoDate());

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

    load();
    window.addEventListener("focus", load);
    return () => window.removeEventListener("focus", load);
  }, []);

  const rankingList = useMemo(() => {
    const filtered = records
      .filter((item) => item.date === targetDate && item.ranking)
      .sort((a, b) => {
        if (b.total !== a.total) return b.total - a.total;
        return b.hourly - a.hourly;
      });

    return filtered.map((item, index) => ({
      rank: index + 1,
      name: nicknameFromRecord(index, item),
      total: item.total,
      hourly: item.hourly,
      workMinutes: item.workMinutes,
      record: item,
    }));
  }, [records, targetDate]);

  const top3 = rankingList.slice(0, 3);
  const others = rankingList.slice(3);
  const myRecord = rankingList[0] ?? null;

  return (
    <main className="mx-auto min-h-screen w-full max-w-[430px] bg-gray-50 pb-24">
      <AppHeader />

      <div className="px-4 pt-4">
        <section className="rounded-2xl bg-white p-4 shadow-sm">
          <div className="text-xl font-bold text-gray-900">ランキング</div>
          <p className="mt-1 text-sm text-gray-500">
            ランキング参加をONにして保存した記録だけ表示されます
          </p>

          <div className="mt-4 flex items-center justify-between rounded-xl border bg-gray-50 px-3 py-3">
            <button
              type="button"
              onClick={() => setTargetDate((prev) => shiftIsoDate(prev, -1))}
              className="text-xl font-bold text-green-700"
            >
              ‹
            </button>

            <div className="text-sm font-bold text-green-700">
              {formatDate(targetDate)}
            </div>

            <button
              type="button"
              onClick={() => setTargetDate((prev) => shiftIsoDate(prev, 1))}
              className="text-xl font-bold text-green-700"
            >
              ›
            </button>
          </div>
        </section>

        <section className="mt-4 rounded-2xl bg-white p-4 shadow-sm">
          <div className="text-base font-bold text-gray-900">TOP 3</div>

          {top3.length === 0 ? (
            <div className="mt-4 rounded-xl bg-gray-50 px-4 py-8 text-center text-sm text-gray-500">
              この日のランキング参加者はいません
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              {top3.map((item) => (
                <div
                  key={item.rank}
                  className="flex items-center justify-between rounded-xl border bg-white px-3 py-3"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold text-white ${
                        item.rank === 1
                          ? "bg-yellow-500"
                          : item.rank === 2
                          ? "bg-gray-400"
                          : "bg-amber-700"
                      }`}
                    >
                      {item.rank}
                    </div>

                    <div>
                      <div className="text-sm font-semibold text-gray-900">
                        {item.name}
                      </div>
                      <div className="text-xs text-gray-500">
                        時給 ￥{item.hourly.toLocaleString()}
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-sm font-bold text-gray-900">
                      ￥{item.total.toLocaleString()}
                    </div>
                    <div className="text-xs text-gray-500">
                      稼働 {formatMinutes(item.workMinutes)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {myRecord && (
          <section className="mt-4 rounded-2xl bg-white p-4 shadow-sm">
            <div className="text-base font-bold text-gray-900">この日のトップ記録</div>

            <div className="mt-4 rounded-xl bg-green-50 px-4 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-green-700">1位</div>
                  <div className="mt-1 text-sm font-semibold text-gray-900">
                    {myRecord.name}
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-lg font-bold text-gray-900">
                    ￥{myRecord.total.toLocaleString()}
                  </div>
                  <div className="text-xs text-gray-600">
                    時給 ￥{myRecord.hourly.toLocaleString()}
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {others.length > 0 && (
          <section className="mt-4 rounded-2xl bg-white p-4 shadow-sm">
            <div className="text-base font-bold text-gray-900">4位以下</div>

            <div className="mt-4 space-y-3">
              {others.map((item) => (
                <div
                  key={item.rank}
                  className="flex items-center justify-between rounded-xl bg-gray-50 px-3 py-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-300 text-sm font-bold text-white">
                      {item.rank}
                    </div>

                    <div>
                      <div className="text-sm font-semibold text-gray-900">
                        {item.name}
                      </div>
                      <div className="text-xs text-gray-500">
                        時給 ￥{item.hourly.toLocaleString()}
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-sm font-bold text-gray-900">
                      ￥{item.total.toLocaleString()}
                    </div>
                    <div className="text-xs text-gray-500">
                      稼働 {formatMinutes(item.workMinutes)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>

      <BottomMenu />
    </main>
  );
}