"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
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

type CalendarCell = {
  iso: string | null;
  day: number | null;
};

function formatCurrency(amount: number) {
  return `￥${amount.toLocaleString()}`;
}

function formatDate(dateStr: string) {
  return dateStr.replaceAll("-", "/");
}

function formatMinutes(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}:${String(m).padStart(2, "0")}`;
}

function loadRecords(): StoredRecord[] {
  if (typeof window === "undefined") return [];

  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];

  try {
    return JSON.parse(raw) as StoredRecord[];
  } catch {
    return [];
  }
}

function saveRecords(records: StoredRecord[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

function monthKey(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function formatMonthLabel(date: Date) {
  return `${date.getFullYear()}年${date.getMonth() + 1}月`;
}

function toIsoDate(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function buildCalendarDays(baseDate: Date): CalendarCell[] {
  const year = baseDate.getFullYear();
  const month = baseDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const cells: CalendarCell[] = [];

  for (let i = 0; i < firstDay.getDay(); i++) {
    cells.push({ iso: null, day: null });
  }

  for (let day = 1; day <= lastDay.getDate(); day++) {
    const current = new Date(year, month, day);
    cells.push({
      iso: toIsoDate(current),
      day,
    });
  }

  while (cells.length % 7 !== 0) {
    cells.push({ iso: null, day: null });
  }

  return cells;
}

export default function HistoryList() {
  const [records, setRecords] = useState<StoredRecord[]>([]);
  const [deletingDate, setDeletingDate] = useState<string | null>(null);
  const [currentMonth, setCurrentMonth] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setRecords(loadRecords());
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);


  const sortedRecords = useMemo(() => {
    return [...records].sort((a, b) => (a.date < b.date ? 1 : -1));
  }, [records]);


  const monthRecordsMap = useMemo(() => {
    const map = new Map<string, StoredRecord>();

    for (const record of records) {
      if (record.date.startsWith(monthKey(currentMonth))) {
        map.set(record.date, record);
      }
    }

    return map;
  }, [records, currentMonth]);

  const calendarDays = useMemo(
    () => buildCalendarDays(currentMonth),
    [currentMonth]
  );

  const handleDelete = (date: string) => {
    const ok = window.confirm(`${formatDate(date)} の記録を削除しますか？`);
    if (!ok) return;

    setDeletingDate(date);

    const next = records.filter((item) => item.date !== date);
    saveRecords(next);
    setRecords(next);

    window.setTimeout(() => {
      setDeletingDate(null);
    }, 300);
  };

  return (
    <main className="mx-auto min-h-screen w-full max-w-[430px] bg-gray-50 pb-24">
      <AppHeader />

      <div className="px-4 pt-4">
        <section className="rounded-2xl bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold text-gray-900">記録一覧</h2>
              <p className="mt-1 text-sm text-gray-500">
                カレンダーから記録を確認できます
              </p>
            </div>

            <Link
              href="/record"
              className="shrink-0 rounded-xl bg-green-600 px-4 py-2 text-sm font-bold text-white"
            >
              新規記録
            </Link>
          </div>

          <div className="mt-5">
            <div className="mb-3 flex items-center justify-between">
              <button
                type="button"
                onClick={() =>
                  setCurrentMonth(
                    (prev) =>
                      new Date(prev.getFullYear(), prev.getMonth() - 1, 1)
                  )
                }
                className="rounded-lg border border-green-200 px-3 py-1 text-sm font-bold text-green-700 active:bg-green-50"
                aria-label="前の月"
              >
                前月
              </button>

              <div className="text-sm font-bold text-gray-900">
                {formatMonthLabel(currentMonth)}
              </div>

              <button
                type="button"
                onClick={() =>
                  setCurrentMonth(
                    (prev) =>
                      new Date(prev.getFullYear(), prev.getMonth() + 1, 1)
                  )
                }
                className="rounded-lg border border-green-200 px-3 py-1 text-sm font-bold text-green-700 active:bg-green-50"
                aria-label="次の月"
              >
                翌月
              </button>
            </div>

            <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-bold text-gray-400">
              <div>日</div>
              <div>月</div>
              <div>火</div>
              <div>水</div>
              <div>木</div>
              <div>金</div>
              <div>土</div>
            </div>

            <div className="mt-2 grid grid-cols-7 gap-1">
              {calendarDays.map((cell, index) => {
                if (!cell.iso || !cell.day) {
                  return (
                    <div
                      key={`empty-${index}`}
                      className="h-16 rounded-lg bg-transparent"
                    />
                  );
                }

                const record = monthRecordsMap.get(cell.iso);

                return (
                  <Link
                    key={cell.iso}
                    href={`/record?date=${cell.iso}`}
                    className={`flex h-16 flex-col rounded-lg border p-1 transition active:scale-[0.98] ${
                      record
                        ? "border-green-300 bg-green-50"
                        : "border-gray-200 bg-white"
                    }`}
                  >
                    <div className="text-[11px] font-bold text-gray-800">
                      {cell.day}
                    </div>
                    <div
                      className={`mt-auto truncate text-center text-[10px] font-bold ${
                        record ? "text-green-700" : "text-gray-300"
                      }`}
                    >
                      {record ? formatCurrency(record.total) : "記録なし"}
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>

        </section>

        <section className="mt-4 rounded-2xl bg-white p-4 shadow-sm">
          <div className="mb-3 text-base font-bold text-gray-900">
            記録テーブル
          </div>

          {sortedRecords.length === 0 ? (
            <div className="rounded-2xl px-4 py-8 text-center text-sm text-gray-500">
              まだ記録がありません
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-[980px] text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-gray-500">
                    <th className="px-2 py-2">日付</th>
                    <th className="px-2 py-2 text-right">合計</th>
                    <th className="px-2 py-2 text-right">時給</th>
                    <th className="px-2 py-2 text-right">稼働</th>
                    <th className="px-2 py-2 text-right">Uber</th>
                    <th className="px-2 py-2 text-right">出前館</th>
                    <th className="px-2 py-2 text-right">menu</th>
                    <th className="px-2 py-2 text-right">Rocket</th>
                    <th className="px-2 py-2 text-right">その他</th>
                    <th className="px-2 py-2 text-center">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedRecords.map((item) => (
                    <tr
                      key={item.date}
                      className={`border-b last:border-b-0 ${
                        deletingDate === item.date ? "opacity-50" : ""
                      }`}
                    >
                      <td className="whitespace-nowrap px-2 py-3 font-semibold text-gray-900">
                        <Link
                          href={`/record?date=${item.date}`}
                          className="text-green-700 underline-offset-2 hover:underline"
                        >
                          {formatDate(item.date)}
                        </Link>
                      </td>
                      <td className="whitespace-nowrap px-2 py-3 text-right font-bold text-gray-900">
                        {formatCurrency(item.total)}
                      </td>
                      <td className="whitespace-nowrap px-2 py-3 text-right text-gray-700">
                        {formatCurrency(item.hourly)}
                      </td>
                      <td className="whitespace-nowrap px-2 py-3 text-right text-gray-700">
                        {formatMinutes(item.workMinutes)}
                      </td>
                      <td className="whitespace-nowrap px-2 py-3 text-right text-gray-700">
                        {formatCurrency(item.services.uber.amount)}
                      </td>
                      <td className="whitespace-nowrap px-2 py-3 text-right text-gray-700">
                        {formatCurrency(item.services.demae.amount)}
                      </td>
                      <td className="whitespace-nowrap px-2 py-3 text-right text-gray-700">
                        {formatCurrency(item.services.menu.amount)}
                      </td>
                      <td className="whitespace-nowrap px-2 py-3 text-right text-gray-700">
                        {formatCurrency(item.services.rocket.amount)}
                      </td>
                      <td className="whitespace-nowrap px-2 py-3 text-right text-gray-700">
                        {formatCurrency(item.services.other.amount)}
                      </td>
                      <td className="whitespace-nowrap px-2 py-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleDelete(item.date)}
                          disabled={deletingDate === item.date}
                          className="rounded-lg border border-red-200 px-2 py-1 text-xs font-bold text-red-600 active:bg-red-50 disabled:opacity-60"
                        >
                          削除
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      <BottomMenu />
    </main>
  );
}





