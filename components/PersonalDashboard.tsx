"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import GoalDashboard from "@/components/GoalDashboard";
import { isHolidayOrWeekend } from "@/lib/japaneseHolidays";
import {
  ensureActiveUserFromProfile,
  getActiveUser,
  type UbalogUser,
} from "@/lib/users";

const RECORDS_STORAGE_KEY = "ubalog-records";
const PROFILE_STORAGE_KEY = "ubalog-profile";

type ServiceKey = "uber" | "demae" | "menu" | "rocket" | "other";

type Profile = {
  name?: string;
  nickname?: string;
  rankingName?: string;
  prefecture?: string;
  area?: string;
};

type StoredRecord = {
  date: string;
  userId?: string;
  name?: string;
  comment?: string;
  total: number;
  hourly: number;
  workMinutes: number;
  services: Record<ServiceKey, { amount: number; deliveries: number }>;
};

type CalendarCell = {
  iso: string | null;
  day: number | null;
};

function toIsoDate(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function todayIsoDate() {
  return toIsoDate(new Date());
}

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function formatMonthLabel(date: Date) {
  return `${date.getFullYear()}年${date.getMonth() + 1}月`;
}

function formatDate(iso: string) {
  return iso.replaceAll("-", "/");
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

function buildCalendarDays(baseDate: Date): CalendarCell[] {
  const year = baseDate.getFullYear();
  const month = baseDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const cells: CalendarCell[] = [];

  for (let i = 0; i < firstDay.getDay(); i += 1) {
    cells.push({ iso: null, day: null });
  }

  for (let day = 1; day <= lastDay.getDate(); day += 1) {
    cells.push({ iso: toIsoDate(new Date(year, month, day)), day });
  }

  while (cells.length % 7 !== 0) {
    cells.push({ iso: null, day: null });
  }

  return cells;
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

function recordBelongsToUser(record: StoredRecord, user: UbalogUser | null) {
  if (!user) return false;
  if (record.userId) return record.userId === user.id;
  return record.name?.trim() === user.name;
}

function average(records: StoredRecord[]) {
  if (records.length === 0) return 0;
  return Math.floor(
    records.reduce((sum, record) => sum + record.total, 0) / records.length
  );
}

function nextMonthDate(base: Date, diff: number) {
  return new Date(base.getFullYear(), base.getMonth() + diff, 1);
}

export default function PersonalDashboard() {
  const [records, setRecords] = useState<StoredRecord[]>([]);
  const [activeUser, setActiveUser] = useState<UbalogUser | null>(null);
  const [currentMonth, setCurrentMonth] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState(todayIsoDate());
  const [activeTab, setActiveTab] = useState<"score" | "goal">("score");

  useEffect(() => {
    const load = () => {
      const profile = loadProfile();
      ensureActiveUserFromProfile(profile);
      setActiveUser(getActiveUser());
      setRecords(loadRecords());
    };

    const timer = window.setTimeout(load, 0);
    window.addEventListener("focus", load);
    window.addEventListener("ubalog-profile-updated", load);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("focus", load);
      window.removeEventListener("ubalog-profile-updated", load);
    };
  }, []);

  const personalRecords = useMemo(() => {
    if (!activeUser) return [];
    return records.filter((record) => recordBelongsToUser(record, activeUser));
  }, [activeUser, records]);

  const monthPrefix = monthKey(currentMonth);
  const monthRecords = useMemo(
    () =>
      personalRecords
        .filter((record) => record.date.startsWith(monthPrefix))
        .sort((a, b) => (a.date < b.date ? 1 : -1)),
    [monthPrefix, personalRecords]
  );

  const monthMap = useMemo(() => {
    const map = new Map<string, StoredRecord>();
    for (const record of monthRecords) map.set(record.date, record);
    return map;
  }, [monthRecords]);

  const calendarDays = useMemo(() => buildCalendarDays(currentMonth), [currentMonth]);
  const selectedRecord = monthMap.get(selectedDate) ?? null;
  const monthTotal = monthRecords.reduce((sum, record) => sum + record.total, 0);
  const monthWorkMinutes = monthRecords.reduce(
    (sum, record) => sum + record.workMinutes,
    0
  );
  const monthDeliveries = monthRecords.reduce(
    (sum, record) => sum + totalDeliveries(record),
    0
  );
  const activeDays = monthRecords.length;
  const monthHourly =
    monthWorkMinutes > 0 ? Math.floor(monthTotal / (monthWorkMinutes / 60)) : 0;
  const weekdayAverage = average(
    monthRecords.filter((record) => !isHolidayOrWeekend(record.date))
  );
  const holidayAverage = average(
    monthRecords.filter((record) => isHolidayOrWeekend(record.date))
  );
  const bestRecord = [...monthRecords].sort((a, b) => b.total - a.total)[0] ?? null;
  const best3 = [...monthRecords].sort((a, b) => b.total - a.total).slice(0, 3);
  const averageDaily = average(monthRecords);

  const changeMonth = (diff: number) => {
    const next = nextMonthDate(currentMonth, diff);
    setCurrentMonth(next);
    setSelectedDate(toIsoDate(next));
  };

  return (
    <div className="mt-4 space-y-4">
      <section className="rounded-2xl bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="mt-1 text-xs font-bold text-green-700">
              {activeUser?.name ?? "表示名を入力してください"}
            </p>
          </div>
          <div className="text-sm font-bold text-gray-900">
            {formatMonthLabel(currentMonth)}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 rounded-2xl bg-gray-100 p-1">
          <button
            type="button"
            onClick={() => setActiveTab("score")}
            className={`h-11 rounded-xl text-sm font-bold ${
              activeTab === "score"
                ? "bg-green-600 text-white shadow-sm"
                : "text-gray-600"
            }`}
          >
            成績
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("goal")}
            className={`h-11 rounded-xl text-sm font-bold ${
              activeTab === "goal"
                ? "bg-green-600 text-white shadow-sm"
                : "text-gray-600"
            }`}
          >
            目標
          </button>
        </div>
      </section>

      {activeTab === "score" ? (
        <>
          <section className="rounded-2xl bg-white p-4 shadow-sm">
            <div className="grid grid-cols-2 gap-3">
              <StatCard title="今月の合計売上" value={formatCurrency(monthTotal)} />
              <StatCard title="今月の稼働日数" value={`${activeDays}日`} />
              <StatCard title="今月の平均時給" value={formatCurrency(monthHourly)} />
              <StatCard title="今月の合計件数" value={`${monthDeliveries}件`} />
              <StatCard title="平日平均売上" value={formatCurrency(weekdayAverage)} />
              <StatCard title="休日平均売上" value={formatCurrency(holidayAverage)} />
              <StatCard
                title="最高売上日"
                value={bestRecord ? formatCurrency(bestRecord.total) : "￥0"}
              />
              <StatCard title="平均日給" value={formatCurrency(averageDaily)} />
            </div>

            {bestRecord && (
              <div className="mt-3 rounded-xl bg-green-50 px-3 py-2 text-xs font-bold text-green-700">
                最高売上日: {formatDate(bestRecord.date)} /{" "}
                {formatCurrency(bestRecord.total)}
              </div>
            )}

            {best3.length > 0 && (
              <div className="mt-4 rounded-2xl bg-green-50 p-3">
                <div className="text-sm font-bold text-green-800">今月ベスト3日</div>
                <div className="mt-2 space-y-2">
                  {best3.map((record, index) => (
                    <div
                      key={record.date}
                      className="flex items-center justify-between rounded-xl bg-white px-3 py-2 text-sm"
                    >
                      <div className="font-bold text-gray-800">
                        {index + 1}位 {formatDate(record.date)}
                      </div>
                      <div className="font-bold text-green-700">
                        {formatCurrency(record.total)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>

          <section className="rounded-2xl bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <button
            type="button"
            onClick={() => changeMonth(-1)}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-green-200 text-lg font-bold text-green-700"
            aria-label="前月"
          >
            ＜
          </button>
          <div className="text-sm font-bold text-gray-900">
            {formatMonthLabel(currentMonth)}
          </div>
          <button
            type="button"
            onClick={() => changeMonth(1)}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-green-200 text-lg font-bold text-green-700"
            aria-label="次月"
          >
            ＞
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
              return <div key={`empty-${index}`} className="h-16" />;
            }
            const record = monthMap.get(cell.iso);
            const holiday = isHolidayOrWeekend(cell.iso);
            const today = cell.iso === todayIsoDate();
            const highSales =
              Boolean(record) && Boolean(bestRecord) && record?.date === bestRecord?.date;

            return (
              <button
                key={cell.iso}
                type="button"
                onClick={() => setSelectedDate(cell.iso ?? todayIsoDate())}
                className={`flex h-16 flex-col rounded-lg border p-1 text-left transition active:scale-[0.98] ${
                  selectedDate === cell.iso
                    ? "border-green-600 bg-green-100 ring-2 ring-green-100"
                    : highSales
                    ? "border-green-300 bg-emerald-50"
                    : record
                    ? "border-green-200 bg-green-50"
                    : holiday
                    ? "border-amber-100 bg-amber-50"
                    : "border-gray-200 bg-white"
                }`}
              >
                <span
                  className={`flex h-5 min-w-5 items-center justify-center rounded-full text-[11px] font-bold ${
                    today
                      ? "bg-green-600 text-white"
                      : holiday
                      ? "text-amber-700"
                      : "text-gray-800"
                  }`}
                >
                  {cell.day}
                </span>
                <span className="mt-auto truncate text-center text-[10px] font-bold text-green-700">
                  {record ? formatCurrency(record.total) : ""}
                </span>
              </button>
            );
          })}
        </div>

        <DayDetailCard date={selectedDate} record={selectedRecord} />
      </section>

          <MonthlyTable records={monthRecords} onSelectDate={setSelectedDate} />
        </>
      ) : (
        <GoalDashboard
          records={personalRecords}
          currentMonth={currentMonth}
          onChangeMonth={changeMonth}
        />
      )}
    </div>
  );
}

function StatCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-2xl bg-gray-50 px-3 py-3">
      <div className="text-xs font-bold text-gray-500">{title}</div>
      <div className="mt-2 text-lg font-black text-gray-900">{value}</div>
    </div>
  );
}

function DayDetailCard({
  date,
  record,
}: {
  date: string;
  record: StoredRecord | null;
}) {
  return (
    <div className="mt-4 rounded-2xl bg-gray-50 p-3 text-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-bold text-gray-900">{formatDate(date)} の記録</div>
          {!record && (
            <div className="mt-1 text-xs font-bold text-gray-500">
              この日付で新しく記録できます
            </div>
          )}
        </div>
        <Link
          href={`/record?date=${date}`}
          className="shrink-0 rounded-full bg-green-600 px-3 py-2 text-xs font-bold text-white"
        >
          {record ? "この日を編集" : "この日を記録"}
        </Link>
      </div>

      {record ? (
        <>
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs font-bold text-gray-600">
            <DetailItem label="合計売上" value={formatCurrency(record.total)} />
            <DetailItem label="時給" value={formatCurrency(record.hourly)} />
            <DetailItem label="稼働時間" value={formatMinutes(record.workMinutes)} />
            <DetailItem label="件数" value={`${totalDeliveries(record)}件`} />
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2 text-xs font-bold text-gray-600">
            <DetailItem label="Uber" value={formatCurrency(record.services.uber.amount)} />
            <DetailItem label="出前館" value={formatCurrency(record.services.demae.amount)} />
            <DetailItem label="menu" value={formatCurrency(record.services.menu.amount)} />
            <DetailItem label="Rocket" value={formatCurrency(record.services.rocket.amount)} />
            <DetailItem label="その他" value={formatCurrency(record.services.other.amount)} />
          </div>

          {record.comment?.trim() && (
            <div className="mt-3 rounded-xl bg-white px-3 py-2 text-xs font-bold text-gray-700">
              {record.comment.trim()}
            </div>
          )}
        </>
      ) : (
        <div className="mt-3 rounded-xl bg-white px-3 py-3 text-xs font-bold text-gray-600">
          日付を選んだ状態で記録画面を開きます
        </div>
      )}
    </div>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white px-3 py-2">
      <div className="text-[11px] text-gray-500">{label}</div>
      <div className="mt-1 text-sm font-black text-gray-900">{value}</div>
    </div>
  );
}

function MonthlyTable({
  records,
  onSelectDate,
}: {
  records: StoredRecord[];
  onSelectDate: (date: string) => void;
}) {
  return (
    <section className="rounded-2xl bg-white p-4 shadow-sm">
      <div className="text-lg font-bold text-gray-900">月間テーブル</div>
      {records.length === 0 ? (
        <div className="mt-3 rounded-xl bg-gray-50 px-4 py-8 text-center text-sm text-gray-500">
          この月の記録はありません
        </div>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-[1040px] text-sm">
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
                <th className="px-2 py-2">コメント</th>
              </tr>
            </thead>
            <tbody>
              {records.map((record) => (
                <tr
                  key={record.date}
                  className="cursor-pointer border-b last:border-b-0 hover:bg-green-50"
                  onClick={() => onSelectDate(record.date)}
                >
                  <td className="whitespace-nowrap px-2 py-3">
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        onSelectDate(record.date);
                      }}
                      className="font-bold text-green-700 underline-offset-2"
                    >
                      {formatDate(record.date)}
                    </button>
                  </td>
                  <td className="whitespace-nowrap px-2 py-3 text-right font-bold">
                    {formatCurrency(record.total)}
                  </td>
                  <td className="whitespace-nowrap px-2 py-3 text-right">
                    {formatCurrency(record.hourly)}
                  </td>
                  <td className="whitespace-nowrap px-2 py-3 text-right">
                    {formatMinutes(record.workMinutes)}
                  </td>
                  <td className="whitespace-nowrap px-2 py-3 text-right">
                    {formatCurrency(record.services.uber.amount)}
                  </td>
                  <td className="whitespace-nowrap px-2 py-3 text-right">
                    {formatCurrency(record.services.demae.amount)}
                  </td>
                  <td className="whitespace-nowrap px-2 py-3 text-right">
                    {formatCurrency(record.services.menu.amount)}
                  </td>
                  <td className="whitespace-nowrap px-2 py-3 text-right">
                    {formatCurrency(record.services.rocket.amount)}
                  </td>
                  <td className="whitespace-nowrap px-2 py-3 text-right">
                    {formatCurrency(record.services.other.amount)}
                  </td>
                  <td className="max-w-[180px] truncate px-2 py-3">
                    {record.comment?.trim() || ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
