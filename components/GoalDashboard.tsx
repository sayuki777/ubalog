"use client";

import { useEffect, useMemo, useState } from "react";
import { isHolidayOrWeekend } from "@/lib/japaneseHolidays";
import {
  createMonthlyGoalPlan,
  getMonthlyGoal,
  saveMonthlyGoal,
  updateDailyGoal,
  type DailyGoal,
  type MonthlyGoalPlan,
} from "@/lib/goals";

type ServiceKey = "uber" | "demae" | "menu" | "rocket" | "other";

type StoredRecord = {
  date: string;
  total: number;
  services: Record<ServiceKey, { amount: number; deliveries: number }>;
};

type CalendarCell = {
  iso: string | null;
  day: number | null;
};

type Props = {
  records: StoredRecord[];
  currentMonth: Date;
  onChangeMonth: (diff: number) => void;
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

function previousMonthKey(date: Date) {
  return monthKey(new Date(date.getFullYear(), date.getMonth() - 1, 1));
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

function parseAmount(value: string) {
  return parseInt(value.replace(/[^\d]/g, "") || "0", 10) || 0;
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

function goalMap(plan: MonthlyGoalPlan | null) {
  const map = new Map<string, DailyGoal>();
  for (const goal of plan?.dailyGoals ?? []) {
    map.set(goal.date, goal);
  }
  return map;
}

function recordMap(records: StoredRecord[]) {
  const map = new Map<string, StoredRecord>();
  for (const record of records) {
    map.set(record.date, record);
  }
  return map;
}

function percent(actual: number, target: number) {
  if (target <= 0) return "";
  return `${Math.floor((actual / target) * 100)}%`;
}

function sum(records: StoredRecord[]) {
  return records.reduce((total, record) => total + record.total, 0);
}

function weekRange(base: Date, offsetWeeks: number) {
  const date = new Date(base);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const start = new Date(date);
  start.setDate(date.getDate() + diff + offsetWeeks * 7);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return { start: toIsoDate(start), end: toIsoDate(end) };
}

function compareText(current: number, previous: number) {
  if (previous <= 0) return "-";
  const diff = current - previous;
  const rate = Math.round((diff / previous) * 100);
  const sign = diff >= 0 ? "+" : "";
  return `${sign}${rate}%（${sign}${formatCurrency(diff)}）`;
}

function daysLeftInMonth(month: string) {
  const today = todayIsoDate();
  const [year, monthNumber] = month.split("-").map(Number);
  const lastDay = new Date(year, monthNumber, 0).getDate();
  const days = Array.from({ length: lastDay }, (_, index) =>
    toIsoDate(new Date(year, monthNumber - 1, index + 1))
  );
  return days.filter((date) => date >= today).length;
}

export default function GoalDashboard({
  records,
  currentMonth,
  onChangeMonth,
}: Props) {
  const month = monthKey(currentMonth);
  const [plan, setPlan] = useState<MonthlyGoalPlan | null>(null);
  const [weekdayTarget, setWeekdayTarget] = useState("");
  const [holidayTarget, setHolidayTarget] = useState("");
  const [selectedDate, setSelectedDate] = useState(todayIsoDate());
  const [dailyTarget, setDailyTarget] = useState("");
  const [memo, setMemo] = useState("");
  const [savedMessage, setSavedMessage] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const current = getMonthlyGoal(month);
      setPlan(current);
      setWeekdayTarget(current?.weekdayTarget ? String(current.weekdayTarget) : "");
      setHolidayTarget(current?.holidayTarget ? String(current.holidayTarget) : "");
      setSelectedDate(`${month}-01`);
    }, 0);

    return () => window.clearTimeout(timer);
  }, [month]);

  const calendarDays = useMemo(() => buildCalendarDays(currentMonth), [currentMonth]);
  const monthRecords = useMemo(
    () => records.filter((record) => record.date.startsWith(month)),
    [month, records]
  );
  const recordsByDate = useMemo(() => recordMap(monthRecords), [monthRecords]);
  const goalsByDate = useMemo(() => goalMap(plan), [plan]);
  const selectedGoal = goalsByDate.get(selectedDate) ?? null;
  const selectedRecord = recordsByDate.get(selectedDate) ?? null;

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDailyTarget(selectedGoal?.targetAmount ? String(selectedGoal.targetAmount) : "");
      setMemo(selectedGoal?.memo ?? "");
    }, 0);

    return () => window.clearTimeout(timer);
  }, [selectedGoal, selectedDate]);

  const totalTarget =
    plan?.dailyGoals.reduce((total, goal) => total + goal.targetAmount, 0) ?? 0;
  const actualTotal = sum(monthRecords);
  const remainingTarget = Math.max(totalTarget - actualTotal, 0);
  const achievement = percent(actualTotal, totalTarget);
  const remainingDays = daysLeftInMonth(month);
  const neededPerDay =
    remainingTarget > 0 && remainingDays > 0
      ? Math.ceil(remainingTarget / remainingDays)
      : 0;

  const thisWeek = weekRange(new Date(), 0);
  const previousWeek = weekRange(new Date(), -1);
  const thisWeekTotal = sum(
    records.filter((record) => record.date >= thisWeek.start && record.date <= thisWeek.end)
  );
  const previousWeekTotal = sum(
    records.filter(
      (record) => record.date >= previousWeek.start && record.date <= previousWeek.end
    )
  );
  const previousMonthTotal = sum(
    records.filter((record) => record.date.startsWith(previousMonthKey(currentMonth)))
  );
  const today = todayIsoDate();
  const todayGoal = month === monthKey(new Date()) ? goalsByDate.get(today) : null;
  const todayActual =
    month === monthKey(new Date()) ? recordsByDate.get(today)?.total ?? 0 : 0;
  const todayTarget = todayGoal?.targetAmount ?? 0;
  const todayDiff = todayActual - todayTarget;

  const handleCreatePlan = () => {
    const next = createMonthlyGoalPlan(
      month,
      parseAmount(weekdayTarget),
      parseAmount(holidayTarget)
    );
    saveMonthlyGoal(next);
    setPlan(next);
    setSavedMessage("月間目標を作成しました");
  };

  const handleSaveDailyGoal = () => {
    updateDailyGoal(month, selectedDate, parseAmount(dailyTarget), memo);
    const next = getMonthlyGoal(month);
    setPlan(next);
    setSavedMessage("日別目標を保存しました");
  };

  return (
    <div className="space-y-4">
      <section className="rounded-2xl bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <button
            type="button"
            onClick={() => onChangeMonth(-1)}
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
            onClick={() => onChangeMonth(1)}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-green-200 text-lg font-bold text-green-700"
            aria-label="次月"
          >
            ＞
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <GoalStat title="月間目標" value={formatCurrency(totalTarget)} />
          <GoalStat title="現在の実績" value={formatCurrency(actualTotal)} />
          <GoalStat title="残り目標" value={formatCurrency(remainingTarget)} />
          <GoalStat title="達成率" value={achievement || "-"} />
          <GoalStat title="残り日数" value={`${remainingDays}日`} />
          <GoalStat title="1日あたり必要額" value={formatCurrency(neededPerDay)} />
        </div>

        {totalTarget === 0 && (
          <div className="mt-3 rounded-xl bg-green-50 px-3 py-2 text-xs font-bold text-green-700">
            平日目標と休日目標を入力してください
          </div>
        )}

        {todayTarget > 0 && (
          <div className="mt-3 rounded-2xl bg-green-50 px-3 py-3 text-xs font-bold text-green-800">
            {todayDiff >= 0 ? (
              <div>今日の目標達成！ +{formatCurrency(todayDiff)}</div>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <div className="text-green-700">今日の目標</div>
                  <div className="mt-1 text-gray-900">{formatCurrency(todayTarget)}</div>
                </div>
                <div>
                  <div className="text-green-700">現在</div>
                  <div className="mt-1 text-gray-900">{formatCurrency(todayActual)}</div>
                </div>
                <div>
                  <div className="text-green-700">あと</div>
                  <div className="mt-1 text-gray-900">
                    {formatCurrency(Math.abs(todayDiff))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      <section className="rounded-2xl bg-white p-4 shadow-sm">
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-xs font-bold text-gray-600">平日目標</span>
            <input
              type="text"
              inputMode="numeric"
              value={weekdayTarget}
              onChange={(event) => setWeekdayTarget(event.target.value.replace(/[^\d]/g, ""))}
              placeholder="平日目標"
              className="mt-2 h-11 w-full rounded-xl border border-gray-200 px-3 text-sm font-bold outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100"
            />
          </label>
          <label className="block">
            <span className="text-xs font-bold text-gray-600">休日目標</span>
            <input
              type="text"
              inputMode="numeric"
              value={holidayTarget}
              onChange={(event) => setHolidayTarget(event.target.value.replace(/[^\d]/g, ""))}
              placeholder="休日目標"
              className="mt-2 h-11 w-full rounded-xl border border-gray-200 px-3 text-sm font-bold outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100"
            />
          </label>
        </div>
        <button
          type="button"
          onClick={handleCreatePlan}
          className="mt-3 h-11 w-full rounded-xl bg-green-600 text-sm font-bold text-white"
        >
          月間目標を作成
        </button>
        {savedMessage && (
          <div className="mt-2 text-center text-xs font-bold text-green-700">
            {savedMessage}
          </div>
        )}
      </section>

      <section className="rounded-2xl bg-white p-4 shadow-sm">
        <div className="grid grid-cols-2 gap-3">
          <GoalStat title="前週比" value={compareText(thisWeekTotal, previousWeekTotal)} />
          <GoalStat title="前月比" value={compareText(actualTotal, previousMonthTotal)} />
        </div>
      </section>

      <section className="rounded-2xl bg-white p-4 shadow-sm">
        <div className="text-sm font-bold text-gray-900">目標カレンダー</div>
        <div className="mt-3 grid grid-cols-7 gap-1 text-center text-[11px] font-bold text-gray-400">
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
              return <div key={`empty-${index}`} className="h-20" />;
            }

            const goal = goalsByDate.get(cell.iso);
            const record = recordsByDate.get(cell.iso);
            const target = goal?.targetAmount ?? 0;
            const actual = record?.total ?? 0;
            const holiday = isHolidayOrWeekend(cell.iso);
            const selected = selectedDate === cell.iso;
            const achieved = target > 0 && actual >= target;

            return (
              <button
                key={cell.iso}
                type="button"
                onClick={() => setSelectedDate(cell.iso ?? todayIsoDate())}
                className={`flex h-20 flex-col rounded-lg border p-1 text-left text-[10px] transition active:scale-[0.98] ${
                  selected
                    ? "border-green-600 bg-green-100 ring-2 ring-green-100"
                    : holiday
                    ? "border-amber-100 bg-amber-50"
                    : "border-gray-200 bg-white"
                }`}
              >
                <span className={`font-bold ${holiday ? "text-amber-700" : "text-gray-800"}`}>
                  {cell.day}
                </span>
                {target > 0 && (
                  <span className="mt-1 truncate font-bold text-green-700">
                    目標 {formatCurrency(target)}
                  </span>
                )}
                {actual > 0 && (
                  <span className="truncate font-bold text-gray-700">
                    実績 {formatCurrency(actual)}
                  </span>
                )}
                {target > 0 && actual > 0 && (
                  <span
                    className={`mt-auto font-bold ${
                      achieved ? "text-green-700" : "text-gray-500"
                    }`}
                  >
                    {achieved ? "達成" : percent(actual, target)}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <DailyGoalEditor
          date={selectedDate}
          actual={selectedRecord?.total ?? 0}
          target={dailyTarget}
          memo={memo}
          onChangeTarget={setDailyTarget}
          onChangeMemo={setMemo}
          onSave={handleSaveDailyGoal}
        />
      </section>
    </div>
  );
}

function GoalStat({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-2xl bg-gray-50 px-3 py-3">
      <div className="text-xs font-bold text-gray-500">{title}</div>
      <div className="mt-2 text-lg font-black text-gray-900">{value}</div>
    </div>
  );
}

function DailyGoalEditor({
  date,
  actual,
  target,
  memo,
  onChangeTarget,
  onChangeMemo,
  onSave,
}: {
  date: string;
  actual: number;
  target: string;
  memo: string;
  onChangeTarget: (value: string) => void;
  onChangeMemo: (value: string) => void;
  onSave: () => void;
}) {
  const targetAmount = parseAmount(target);

  return (
    <div className="mt-4 rounded-2xl bg-gray-50 p-3">
      <div className="font-bold text-gray-900">{formatDate(date)} の目標</div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-xs font-bold">
        <div className="rounded-xl bg-white px-2 py-2">
          <div className="text-gray-500">目標</div>
          <div className="mt-1 text-gray-900">{formatCurrency(targetAmount)}</div>
        </div>
        <div className="rounded-xl bg-white px-2 py-2">
          <div className="text-gray-500">実績</div>
          <div className="mt-1 text-gray-900">{formatCurrency(actual)}</div>
        </div>
        <div className="rounded-xl bg-white px-2 py-2">
          <div className="text-gray-500">達成率</div>
          <div className="mt-1 text-gray-900">{percent(actual, targetAmount) || "-"}</div>
        </div>
      </div>

      <label className="mt-3 block">
        <span className="text-xs font-bold text-gray-600">目標金額</span>
        <input
          type="text"
          inputMode="numeric"
          value={target}
          onChange={(event) => onChangeTarget(event.target.value.replace(/[^\d]/g, ""))}
          className="mt-2 h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm font-bold outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100"
          placeholder="目標金額"
        />
      </label>

      <label className="mt-3 block">
        <span className="text-xs font-bold text-gray-600">メモ 任意</span>
        <input
          type="text"
          value={memo}
          maxLength={20}
          onChange={(event) => onChangeMemo(event.target.value.slice(0, 20))}
          className="mt-2 h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100"
          placeholder="メモ"
        />
      </label>

      <button
        type="button"
        onClick={onSave}
        className="mt-3 h-11 w-full rounded-xl bg-green-600 text-sm font-bold text-white"
      >
        保存
      </button>
    </div>
  );
}
