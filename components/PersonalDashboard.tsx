"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import GoalDashboard from "@/components/GoalDashboard";
import RocketNowStatsCard from "@/components/RocketNowStatsCard";
import { isHolidayOrWeekend } from "@/lib/japaneseHolidays";
import type { UbalogStoredRecord } from "@/lib/records";
import {
  ensureActiveUserFromProfile,
  getActiveUser,
  getDisplayNameFromProfileOrUser,
  type UbalogUser,
} from "@/lib/users";
import { fetchSharedRecords, mergeRecords } from "@/lib/sharedRecords";

const RECORDS_STORAGE_KEY = "ubalog-records";
const PROFILE_STORAGE_KEY = "ubalog-profile";

type ServiceKey = "uber" | "demae" | "menu" | "rocket" | "other";

type Profile = {
  displayName?: string;
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
  services?: Partial<Record<ServiceKey, { amount?: number; deliveries?: number }>>;
  hidden?: boolean;
  updatedAt?: string;
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

function shortDate(iso: string) {
  const [, month, day] = iso.split("-");
  return `${Number(month)}/${Number(day)}`;
}

function formatCurrency(amount: number) {
  return `¥${Math.max(0, Math.floor(amount)).toLocaleString()}`;
}

function formatCalendarAmount(amount: number) {
  if (amount >= 100000) return "10万+";
  return Math.floor(amount).toLocaleString();
}

function formatMinutes(minutes: number) {
  const safeMinutes = Math.max(0, Math.floor(minutes));
  const h = Math.floor(safeMinutes / 60);
  const m = safeMinutes % 60;
  return `${h}:${String(m).padStart(2, "0")}`;
}

function safeNumber(value: unknown) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) && numberValue > 0 ? numberValue : 0;
}

function safeServiceAmount(record: StoredRecord, key: ServiceKey) {
  return safeNumber(record.services?.[key]?.amount);
}

function safeServiceDeliveries(record: StoredRecord, key: ServiceKey) {
  return safeNumber(record.services?.[key]?.deliveries);
}

function totalDeliveries(record: StoredRecord) {
  const keys: ServiceKey[] = ["uber", "demae", "menu", "rocket", "other"];
  return keys.reduce((sum, key) => sum + safeServiceDeliveries(record, key), 0);
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
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as StoredRecord[]) : [];
  } catch {
    return [];
  }
}

function recordBelongsToUser(record: StoredRecord, user: UbalogUser | null) {
  if (!user) return false;
  if (record.userId) return record.userId === user.id;
  return record.name?.trim() === user.name;
}

function nextMonthDate(base: Date, diff: number) {
  return new Date(base.getFullYear(), base.getMonth() + diff, 1);
}

function monthRange(base: Date, diffMonths: number) {
  const target = new Date(base.getFullYear(), base.getMonth() + diffMonths, 1);
  return {
    key: monthKey(target),
    label: diffMonths === 0 ? "今月" : diffMonths === -1 ? "前月" : "前々月",
  };
}

function previousMonthKeyFrom(base: Date) {
  return monthKey(new Date(base.getFullYear(), base.getMonth() - 1, 1));
}

function dedupeRecords(records: StoredRecord[]) {
  const map = new Map<string, StoredRecord>();

  for (const record of records) {
    if (record.hidden === true) continue;
    const current = map.get(record.date);
    if (!current) {
      map.set(record.date, record);
      continue;
    }

    const currentTime = new Date(current.updatedAt ?? "").getTime();
    const nextTime = new Date(record.updatedAt ?? "").getTime();
    if (
      nextTime > currentTime ||
      (nextTime === currentTime && safeNumber(record.total) > safeNumber(current.total))
    ) {
      map.set(record.date, record);
    }
  }

  return [...map.values()];
}

function monthSales(records: StoredRecord[], key: string) {
  return records
    .filter((record) => record.hidden !== true && record.date.startsWith(key))
    .reduce((sum, record) => sum + safeNumber(record.total), 0);
}

function serviceSales(records: StoredRecord[]) {
  const items: { key: ServiceKey; label: string; amount: number }[] = [
    { key: "uber", label: "Uber", amount: 0 },
    { key: "demae", label: "出前館", amount: 0 },
    { key: "rocket", label: "ロケナウ", amount: 0 },
    { key: "menu", label: "menu", amount: 0 },
    { key: "other", label: "その他", amount: 0 },
  ];

  return items
    .map((item) => ({
      ...item,
      amount: records.reduce((sum, record) => sum + safeServiceAmount(record, item.key), 0),
    }))
    .sort((a, b) => b.amount - a.amount);
}

function compareText(current: number, previous: number) {
  const diff = current - previous;
  if (previous <= 0) {
    return {
      main: "前月比 -",
      sub: current > 0 ? `前月より +${formatCurrency(diff)}` : "前月データなし",
      positive: current > 0,
    };
  }

  const percent = Math.round((diff / previous) * 100);
  return {
    main: `前月比 ${percent >= 0 ? "+" : ""}${percent}%`,
    sub: `${diff >= 0 ? "前月より +" : "前月より -"}${formatCurrency(Math.abs(diff))}`,
    positive: diff >= 0,
  };
}

export default function PersonalDashboard() {
  const [records, setRecords] = useState<StoredRecord[]>([]);
  const [activeUser, setActiveUser] = useState<UbalogUser | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [currentMonth, setCurrentMonth] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState(todayIsoDate());
  const [activeTab, setActiveTab] = useState<"score" | "goal">("score");

  useEffect(() => {
    const load = () => {
      const profile = loadProfile();
      ensureActiveUserFromProfile(profile);
      const user = getActiveUser();
      setActiveUser(user);
      setDisplayName(getDisplayNameFromProfileOrUser(profile, user));
      const localRecords = loadRecords();
      setRecords(localRecords);
      void fetchSharedRecords()
        .then((remoteRecords) => {
          if (remoteRecords.length === 0) return;
          const merged = mergeRecords(
            localRecords as unknown as Parameters<typeof mergeRecords>[0],
            remoteRecords
          );
          setRecords(merged as StoredRecord[]);
        })
        .catch(() => {
          setRecords(localRecords);
        });
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
    const ownRecords = activeUser
      ? records.filter((record) => recordBelongsToUser(record, activeUser))
      : [];
    return dedupeRecords(ownRecords);
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
  const bestRecord = [...monthRecords].sort((a, b) => safeNumber(b.total) - safeNumber(a.total))[0] ?? null;
  const monthlySales = useMemo(
    () =>
      [0, -1, -2].map((diff) => {
        const range = monthRange(currentMonth, diff);
        return {
          label: range.label,
          amount: monthSales(personalRecords, range.key),
        };
      }),
    [currentMonth, personalRecords]
  );
  const monthTotal = monthSales(personalRecords, monthPrefix);
  const previousMonthTotal = monthSales(personalRecords, previousMonthKeyFrom(currentMonth));
  const monthCompare = compareText(monthTotal, previousMonthTotal);
  const activeDays = monthRecords.filter(
    (record) => safeNumber(record.total) > 0 || safeNumber(record.workMinutes) > 0
  ).length;
  const dailyAverage = activeDays > 0 ? Math.floor(monthTotal / activeDays) : 0;
  const services = serviceSales(monthRecords);

  const changeMonth = (diff: number) => {
    const next = nextMonthDate(currentMonth, diff);
    setCurrentMonth(next);
    setSelectedDate(toIsoDate(next));
  };

  return (
    <div className="mt-4 space-y-3">
      <section className="rounded-2xl bg-white p-3 shadow-sm">
        <div className="grid grid-cols-2 gap-2 rounded-2xl bg-gray-100 p-1">
          <button
            type="button"
            onClick={() => setActiveTab("score")}
            className={`h-9 rounded-xl text-sm font-bold ${
              activeTab === "score" ? "bg-green-600 text-white shadow-sm" : "text-gray-600"
            }`}
          >
            個人成績
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("goal")}
            className={`h-9 rounded-xl text-sm font-bold ${
              activeTab === "goal" ? "bg-green-600 text-white shadow-sm" : "text-gray-600"
            }`}
          >
            目標
          </button>
        </div>
      </section>

      {activeTab === "score" ? (
        <>
          <MonthSummaryCard
            currentMonth={currentMonth}
            total={monthTotal}
            activeDays={activeDays}
            dailyAverage={dailyAverage}
            onChangeMonth={changeMonth}
          />

          {personalRecords.length === 0 && <EmptyPerformanceCard />}

          <MonthCompareCard
            previousTotal={previousMonthTotal}
            main={monthCompare.main}
            sub={monthCompare.sub}
            positive={monthCompare.positive}
          />

          <BestDayCard record={bestRecord} />
          <ServiceSalesCard services={services} monthTotal={monthTotal} />

          <section className="rounded-2xl bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <button
                type="button"
                onClick={() => changeMonth(-1)}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-green-200 text-lg font-bold text-green-700"
                aria-label="前月"
              >
                ‹
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
                ›
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
                  return <div key={`empty-${index}`} className="h-[68px]" />;
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
                    className={`flex h-[68px] flex-col rounded-lg border px-0.5 py-1 text-left transition active:scale-[0.98] ${
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
                    <span className="mt-auto w-full text-center text-[9px] font-black leading-tight text-green-700">
                      {record ? formatCalendarAmount(safeNumber(record.total)) : ""}
                    </span>
                  </button>
                );
              })}
            </div>

            <DayDetailCard date={selectedDate} record={selectedRecord} />
          </section>

          <MonthlyTable records={monthRecords} onSelectDate={setSelectedDate} />
          <MonthlySalesSummary items={monthlySales} />
          <RocketNowStatsCard records={personalRecords as UbalogStoredRecord[]} />
        </>
      ) : (
        <GoalDashboard
          records={personalRecords as UbalogStoredRecord[]}
          currentMonth={currentMonth}
          onChangeMonth={changeMonth}
          displayName={displayName}
        />
      )}
    </div>
  );
}

function MonthSummaryCard({
  currentMonth,
  total,
  activeDays,
  dailyAverage,
  onChangeMonth,
}: {
  currentMonth: Date;
  total: number;
  activeDays: number;
  dailyAverage: number;
  onChangeMonth: (diff: number) => void;
}) {
  return (
    <section className="rounded-2xl bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <button
          type="button"
          onClick={() => onChangeMonth(-1)}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-green-200 text-lg font-bold text-green-700"
          aria-label="前月"
        >
          ‹
        </button>
        <div className="text-sm font-black text-gray-900">{formatMonthLabel(currentMonth)}</div>
        <button
          type="button"
          onClick={() => onChangeMonth(1)}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-green-200 text-lg font-bold text-green-700"
          aria-label="次月"
        >
          ›
        </button>
      </div>

      <div className="rounded-2xl bg-green-50 px-3 py-3">
        <div className="text-xs font-bold text-green-700">今月の売上</div>
        <div className="mt-1 text-3xl font-black leading-tight text-gray-950">
          {formatCurrency(total)}
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <MiniInfo label="稼働日数" value={`${activeDays.toLocaleString()}日`} />
        <MiniInfo label="日給平均" value={activeDays > 0 ? formatCurrency(dailyAverage) : "¥0"} />
      </div>
    </section>
  );
}

function EmptyPerformanceCard() {
  return (
    <section className="rounded-2xl bg-white p-4 text-center shadow-sm">
      <div className="text-sm font-black text-gray-900">まだ記録がありません</div>
      <div className="mt-1 text-xs font-bold leading-5 text-gray-500">
        今日の売上を記録して、成績を見てみましょう。
      </div>
      <Link
        href="/record"
        className="mt-3 inline-flex h-10 items-center justify-center rounded-xl bg-green-600 px-4 text-sm font-black text-white"
      >
        記録する
      </Link>
    </section>
  );
}

function MonthCompareCard({
  previousTotal,
  main,
  sub,
  positive,
}: {
  previousTotal: number;
  main: string;
  sub: string;
  positive: boolean;
}) {
  return (
    <section className="rounded-2xl bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-black text-gray-900">前月比</div>
          <div className="mt-1 text-xs font-bold text-gray-500">
            前月の売上 {formatCurrency(previousTotal)}
          </div>
        </div>
        <div
          className={`rounded-full px-3 py-1.5 text-xs font-black ${
            positive ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-600"
          }`}
        >
          {main}
        </div>
      </div>
      <div className="mt-3 rounded-xl bg-gray-50 px-3 py-2 text-sm font-bold text-gray-700">
        {sub}
      </div>
    </section>
  );
}

function BestDayCard({ record }: { record: StoredRecord | null }) {
  return (
    <section className="rounded-2xl bg-white p-4 shadow-sm">
      <div className="text-sm font-black text-gray-900">今月の最高日</div>
      {record ? (
        <div className="mt-3 flex items-center justify-between rounded-2xl bg-amber-50 px-3 py-3">
          <div>
            <div className="text-lg font-black text-gray-950">{shortDate(record.date)}</div>
            <div className="mt-1 text-xs font-bold text-amber-700">
              {totalDeliveries(record).toLocaleString()}件
            </div>
          </div>
          <div className="text-xl font-black text-gray-950">{formatCurrency(safeNumber(record.total))}</div>
        </div>
      ) : (
        <div className="mt-3 rounded-xl bg-gray-50 px-3 py-3 text-xs font-bold text-gray-500">
          まだ記録がありません
        </div>
      )}
    </section>
  );
}

function ServiceSalesCard({
  services,
  monthTotal,
}: {
  services: { key: ServiceKey; label: string; amount: number }[];
  monthTotal: number;
}) {
  const maxAmount = Math.max(...services.map((service) => service.amount), 1);

  return (
    <section className="rounded-2xl bg-white p-4 shadow-sm">
      <div className="text-sm font-black text-gray-900">サービス別売上</div>
      <div className="mt-3 space-y-2">
        {services.map((service) => (
          <div key={service.key} className="min-w-0">
            <div className="flex items-center justify-between gap-3 text-xs font-bold">
              <span className="text-gray-600">{service.label}</span>
              <span className={service.amount > 0 ? "text-gray-900" : "text-gray-400"}>
                {formatCurrency(service.amount)}
              </span>
            </div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-gray-100">
              <div
                className="h-full rounded-full bg-green-500"
                style={{ width: `${Math.round((service.amount / maxAmount) * 100)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
      <div className="mt-3 text-right text-[11px] font-bold text-gray-400">
        合計 {formatCurrency(monthTotal)}
      </div>
    </section>
  );
}

function MiniInfo({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-2xl bg-gray-50 px-3 py-3">
      <div className="truncate text-xs font-bold text-gray-500">{label}</div>
      <div className="mt-1 break-words text-lg font-black leading-tight text-gray-900">
        {value}
      </div>
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
            <DetailItem label="合計売上" value={formatCurrency(safeNumber(record.total))} />
            <DetailItem label="時給" value={formatCurrency(safeNumber(record.hourly))} />
            <DetailItem label="稼働時間" value={formatMinutes(safeNumber(record.workMinutes))} />
            <DetailItem label="件数" value={`${totalDeliveries(record).toLocaleString()}件`} />
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2 text-xs font-bold text-gray-600">
            <DetailItem label="Uber" value={formatCurrency(safeServiceAmount(record, "uber"))} />
            <DetailItem label="出前館" value={formatCurrency(safeServiceAmount(record, "demae"))} />
            <DetailItem label="menu" value={formatCurrency(safeServiceAmount(record, "menu"))} />
            <DetailItem label="ロケナウ" value={formatCurrency(safeServiceAmount(record, "rocket"))} />
            <DetailItem label="その他" value={formatCurrency(safeServiceAmount(record, "other"))} />
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
      <div className="text-lg font-bold text-gray-900">月間売上メモ</div>
      {records.length === 0 ? (
        <div className="mt-3 rounded-xl bg-gray-50 px-4 py-8 text-center text-sm text-gray-500">
          この月の記録はありません
        </div>
      ) : (
        <div className="mt-3 space-y-2">
          {records.map((record) => (
            <button
              key={record.date}
              type="button"
              onClick={() => onSelectDate(record.date)}
              className="w-full rounded-2xl border border-gray-100 bg-gray-50 px-3 py-3 text-left active:bg-green-50"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-black text-gray-900">{shortDate(record.date)}</div>
                  <div className="mt-1 text-xs font-bold text-gray-500">
                    {totalDeliveries(record).toLocaleString()}件 / 稼働 {formatMinutes(safeNumber(record.workMinutes))}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-base font-black text-gray-950">
                    {formatCurrency(safeNumber(record.total))}
                  </div>
                  <div className="mt-1 text-[11px] font-bold text-gray-500">
                    時給 {formatCurrency(safeNumber(record.hourly))}
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

function MonthlySalesSummary({
  items,
}: {
  items: { label: string; amount: number }[];
}) {
  return (
    <section className="rounded-2xl bg-white p-4 shadow-sm">
      <div className="text-lg font-bold text-gray-900">月間売上</div>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {items.map((item) => (
          <div key={item.label} className="min-w-0 rounded-2xl bg-gray-50 px-2 py-3 text-center">
            <div className="text-xs font-bold text-gray-500">{item.label}</div>
            <div className="mt-1 truncate text-sm font-black text-gray-900">
              {formatCurrency(item.amount)}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
