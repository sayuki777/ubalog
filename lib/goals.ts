import { isHolidayOrWeekend } from "@/lib/japaneseHolidays";

const GOALS_STORAGE_KEY = "ubalog-goals";

export type DailyGoal = {
  date: string;
  targetAmount: number;
  memo?: string;
  updatedAt: string;
};

export type MonthlyGoalPlan = {
  month: string;
  weekdayTarget: number;
  holidayTarget: number;
  dailyGoals: DailyGoal[];
  updatedAt: string;
};

function readPlans(): MonthlyGoalPlan[] {
  if (typeof window === "undefined") return [];

  const raw = localStorage.getItem(GOALS_STORAGE_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as MonthlyGoalPlan[]) : [];
  } catch {
    return [];
  }
}

function writePlans(plans: MonthlyGoalPlan[]) {
  localStorage.setItem(GOALS_STORAGE_KEY, JSON.stringify(plans));
}

function toIsoDate(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function datesInMonth(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  const lastDay = new Date(year, monthNumber, 0).getDate();

  return Array.from({ length: lastDay }, (_, index) =>
    toIsoDate(new Date(year, monthNumber - 1, index + 1))
  );
}

export function getMonthlyGoal(month: string): MonthlyGoalPlan | null {
  return readPlans().find((plan) => plan.month === month) ?? null;
}

export function saveMonthlyGoal(plan: MonthlyGoalPlan) {
  const plans = readPlans();
  const next = [plan, ...plans.filter((item) => item.month !== plan.month)];
  writePlans(next);
}

export function createMonthlyGoalPlan(
  month: string,
  weekdayTarget: number,
  holidayTarget: number
): MonthlyGoalPlan {
  const now = new Date().toISOString();

  return {
    month,
    weekdayTarget,
    holidayTarget,
    dailyGoals: datesInMonth(month).map((date) => ({
      date,
      targetAmount: isHolidayOrWeekend(date) ? holidayTarget : weekdayTarget,
      updatedAt: now,
    })),
    updatedAt: now,
  };
}

export function updateDailyGoal(
  month: string,
  date: string,
  targetAmount: number,
  memo?: string
) {
  const current = getMonthlyGoal(month);
  const now = new Date().toISOString();
  const base =
    current ??
    ({
      month,
      weekdayTarget: 0,
      holidayTarget: 0,
      dailyGoals: [],
      updatedAt: now,
    } satisfies MonthlyGoalPlan);

  const dailyGoals = [
    {
      date,
      targetAmount,
      memo: memo?.trim() || undefined,
      updatedAt: now,
    },
    ...base.dailyGoals.filter((goal) => goal.date !== date),
  ].sort((a, b) => (a.date > b.date ? 1 : -1));

  saveMonthlyGoal({
    ...base,
    dailyGoals,
    updatedAt: now,
  });
}

