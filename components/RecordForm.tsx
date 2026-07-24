"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import AppHeader from "@/components/AppHeader";
import BottomMenu from "@/components/BottomMenu";
import OnboardingCard from "@/components/OnboardingCard";
import CongratsOverlay from "@/components/CongratsOverlay";
import SaveButton from "@/components/SaveButton";
import Toast from "@/components/Toast";
import RocketNowDailyScanGuide from "@/components/RocketNowDailyScanGuide";
import RocketNowBulkImportPanel from "@/components/RocketNowBulkImportPanel";
import RecordGoalCalendar from "@/components/RecordGoalCalendar";
import RecordStatsGoalsPanel from "@/components/RecordStatsGoalsPanel";
import { PREFECTURES } from "@/lib/areas";
import { getMonthlyGoal } from "@/lib/goals";
import { saveHighlightUpdate, type HighlightField } from "@/lib/highlights";
import {
  RECORD_GUIDE_DISMISSED_KEY,
  readStorageBoolean,
  writeStorageBoolean,
} from "@/lib/onboarding";
import {
  addBreakingRecordNews,
  addNewsForRecord,
  addTopUpdateNewsForRecord,
} from "@/lib/news";
import {
  createUserFromInput,
  ensureActiveUserFromProfile,
  getAnonymousDisplayName,
  isAnonymousDisplayName,
  setActiveUser,
} from "@/lib/users";
import { saveRecordWithSync } from "@/lib/sharedRecords";
import { buildRecordShareText, openXShare } from "@/lib/share";

const STORAGE_KEY = "ubalog-records";
const PROFILE_STORAGE_KEY = "ubalog-profile";
const LAST_WORK_TIME_STORAGE_KEY = "ubalog-last-work-time";
const BREAK_MINUTE_OPTIONS = Array.from({ length: 37 }, (_, index) => index * 5);
const MAX_AMOUNT = 300000;
const MAX_DELIVERIES = 500;
const MAX_WORK_MINUTES = 1440;
const MAX_COMMENT_LENGTH = 25;
const MAX_NAME_LENGTH = 20;

type CongratsState = {
  type: "daily" | "weekly" | "monthly";
  message: string;
} | null;

type StoredRecord = {
  date: string;
  userId?: string;
  name?: string;
  prefecture?: string;
  region?: string;
  area?: string;
  comment?: string;
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

type Profile = {
  displayName?: string;
  name?: string;
  realName?: string;
  nickname?: string;
  rankingName?: string;
  prefecture?: string;
  region?: string;
  area?: string;
  mainService?: string;
};

type LastWorkTime = {
  startTime: string;
  endTime: string;
  breakMinutes: number;
  updatedAt: string;
};

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
  window.dispatchEvent(new Event("ubalog-records-updated"));
}

function loadProfile(): Profile {
  if (typeof window === "undefined") return {};
  const raw = localStorage.getItem(PROFILE_STORAGE_KEY);
  if (!raw) return {};

  try {
    return JSON.parse(raw) as Profile;
  } catch {
    return {};
  }
}

function saveProfile(profile: Profile) {
  localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
  window.dispatchEvent(new Event("ubalog-profile-updated"));
}

function saveLastWorkTime(value: Omit<LastWorkTime, "updatedAt">) {
  localStorage.setItem(
    LAST_WORK_TIME_STORAGE_KEY,
    JSON.stringify({ ...value, updatedAt: new Date().toISOString() })
  );
}

function profileDisplayName(profile: Profile) {
  return (
    profile.displayName?.trim() ||
    profile.name?.trim() ||
    profile.rankingName?.trim() ||
    profile.nickname?.trim() ||
    getAnonymousDisplayName()
  );
}

function todayIsoDate() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function offsetIsoDate(offsetDays: number) {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return toIsoDate(date);
}

function monthKeyFromDate(iso: string) {
  return iso.slice(0, 7);
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

function isInRange(value: string, start: string, end: string) {
  return value >= start && value <= end;
}

function totalDeliveries(record: StoredRecord) {
  return Object.values(record.services).reduce((sum, service) => sum + service.deliveries, 0);
}

function unitPrice(record: StoredRecord) {
  const deliveries = totalDeliveries(record);
  return deliveries > 0 ? Math.floor(record.total / deliveries) : 0;
}

function buildHighlightFields(record: StoredRecord, records: StoredRecord[]) {
  const fields = new Set<HighlightField>();
  const today = new Date();
  const todayIso = toIsoDate(today);
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const yesterdayIso = toIsoDate(yesterday);
  const thisWeekStart = toIsoDate(startOfWeek(today));
  const thisWeekEndDate = new Date(thisWeekStart);
  thisWeekEndDate.setDate(thisWeekEndDate.getDate() + 6);
  const thisWeekEnd = toIsoDate(thisWeekEndDate);
  const lastWeekStartDate = new Date(thisWeekStart);
  lastWeekStartDate.setDate(lastWeekStartDate.getDate() - 7);
  const lastWeekStart = toIsoDate(lastWeekStartDate);
  const lastWeekEndDate = new Date(lastWeekStart);
  lastWeekEndDate.setDate(lastWeekEndDate.getDate() + 6);
  const lastWeekEnd = toIsoDate(lastWeekEndDate);

  if (record.date === todayIso) fields.add("today");
  if (record.date === yesterdayIso) fields.add("yesterday");
  if (isInRange(record.date, thisWeekStart, thisWeekEnd)) fields.add("thisWeek");
  if (isInRange(record.date, lastWeekStart, lastWeekEnd)) fields.add("lastWeek");

  const monthRecords = records.filter((item) => item.date.startsWith(monthKeyFromDate(record.date)));
  const maxTotal = Math.max(0, ...monthRecords.map((item) => item.total));
  const maxUnitPrice = Math.max(0, ...monthRecords.map(unitPrice));
  if (record.total > 0 && record.total >= maxTotal) fields.add("monthlyBest");
  if (unitPrice(record) > 0 && unitPrice(record) >= maxUnitPrice) fields.add("bestUnitPrice");

  return [...fields];
}

function getWeekRange(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  const base = new Date(year, month - 1, day);
  const start = startOfWeek(base);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return { start: toIsoDate(start), end: toIsoDate(end) };
}

function sumRecords(records: StoredRecord[]) {
  return records.reduce((sum, record) => sum + record.total, 0);
}

function formatCurrency(amount: number) {
  return `￥${amount.toLocaleString()}`;
}

function clampNumber(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.min(Math.max(Math.floor(value), min), max);
}

function numericInputValue(value: string, max: number) {
  const digits = value.replace(/[^\d]/g, "");
  if (!digits) return "";
  return String(clampNumber(Number(digits), 0, max));
}

function amountFromInput(value: string) {
  return clampNumber(parseInt(value || "0", 10) || 0, 0, MAX_AMOUNT);
}

function deliveriesFromInput(value: string) {
  return clampNumber(parseInt(value || "0", 10) || 0, 0, MAX_DELIVERIES);
}

function cleanText(value: string, maxLength: number) {
  return value.replace(/[\u0000-\u001F\u007F]/g, "").trim().slice(0, maxLength);
}

function formatBreakMinutes(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}:${String(m).padStart(2, "0")}`;
}

function rankingUrlForDate(value: string) {
  const today = todayIsoDate();
  const yesterday = offsetIsoDate(-1);
  const params = new URLSearchParams({ focus: "me", date: value });

  if (value === today) {
    params.set("period", "today");
  } else if (value === yesterday) {
    params.set("period", "yesterday");
  } else {
    params.set("period", "date");
  }

  return `/ranking?${params.toString()}`;
}

function roundTimeToFiveMinutes(value: string) {
  const [hour, minute] = value.split(":").map(Number);
  if (Number.isNaN(hour) || Number.isNaN(minute)) return value;

  const roundedMinute = Math.round(minute / 5) * 5;
  const nextHour = (hour + Math.floor(roundedMinute / 60)) % 24;
  const nextMinute = roundedMinute % 60;

  return `${String(nextHour).padStart(2, "0")}:${String(nextMinute).padStart(2, "0")}`;
}

export default function RecordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rocketBulkPanelRef = useRef<HTMLDivElement | null>(null);

  const [date, setDate] = useState(todayIsoDate());
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [breakTime, setBreakTime] = useState("");

  const [uber, setUber] = useState("");
  const [demae, setDemae] = useState("");
  const [menu, setMenu] = useState("");
  const [rocket, setRocket] = useState("");
  const [other, setOther] = useState("");

  const [uberCount, setUberCount] = useState("");
  const [demaeCount, setDemaeCount] = useState("");
  const [menuCount, setMenuCount] = useState("");
  const [rocketCount, setRocketCount] = useState("");
  const [otherCount, setOtherCount] = useState("");

  const [ranking, setRanking] = useState(true);
  const [profileName, setProfileName] = useState("");
  const [prefecture, setPrefecture] = useState("");
  const [profileArea, setProfileArea] = useState("");
  const [comment, setComment] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [congrats, setCongrats] = useState<CongratsState>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [recordCount, setRecordCount] = useState(0);
  const [recordGuideDismissed, setRecordGuideDismissed] = useState(false);
  const [showAfterSaveActions, setShowAfterSaveActions] = useState(false);
  const [afterSaveMessage, setAfterSaveMessage] = useState("");
  const [lastSavedRecord, setLastSavedRecord] = useState<StoredRecord | null>(null);
  const [rocketBulkLaunchToken, setRocketBulkLaunchToken] = useState(0);

  useEffect(() => {
    const queryDate = searchParams.get("date");
    if (!queryDate) return;

    const timer = window.setTimeout(() => {
      setDate(queryDate);
    }, 0);

    return () => window.clearTimeout(timer);
  }, [searchParams]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const records = loadRecords();
      const profile = loadProfile();
      const activeUser = ensureActiveUserFromProfile(profile);
      const current = records.find((item) => item.date === date);
      setRecordCount(records.length);
      setRecordGuideDismissed(readStorageBoolean(RECORD_GUIDE_DISMISSED_KEY));
      const storedName =
        profile.displayName ??
        profile.name ??
        profile.rankingName ??
        profile.nickname ??
        activeUser?.name ??
        "";
      setProfileName(isAnonymousDisplayName(storedName) ? "" : storedName);
      setPrefecture(activeUser?.prefecture ?? profile.prefecture ?? "");
      setProfileArea(activeUser?.area ?? profile.area ?? "");

      if (current) {
        setIsEditing(true);

        setStartTime(current.startTime ?? "");
        setEndTime(current.endTime ?? "");
        setBreakTime(
          typeof current.breakMinutes === "number" ? String(current.breakMinutes) : ""
        );

        setUber(current.services.uber.amount > 0 ? String(current.services.uber.amount) : "");
        setDemae(current.services.demae.amount > 0 ? String(current.services.demae.amount) : "");
        setMenu(current.services.menu.amount > 0 ? String(current.services.menu.amount) : "");
        setRocket(current.services.rocket.amount > 0 ? String(current.services.rocket.amount) : "");
        setOther(current.services.other.amount > 0 ? String(current.services.other.amount) : "");

        setUberCount(current.services.uber.deliveries > 0 ? String(current.services.uber.deliveries) : "");
        setDemaeCount(current.services.demae.deliveries > 0 ? String(current.services.demae.deliveries) : "");
        setMenuCount(current.services.menu.deliveries > 0 ? String(current.services.menu.deliveries) : "");
        setRocketCount(current.services.rocket.deliveries > 0 ? String(current.services.rocket.deliveries) : "");
        setOtherCount(current.services.other.deliveries > 0 ? String(current.services.other.deliveries) : "");

        setRanking(current.ranking);
        setComment(current.comment ?? "");
      } else {
        setIsEditing(false);

        setStartTime("");
        setEndTime("");
        setBreakTime("");

        setUber("");
        setDemae("");
        setMenu("");
        setRocket("");
        setOther("");

        setUberCount("");
        setDemaeCount("");
        setMenuCount("");
        setRocketCount("");
        setOtherCount("");

        setRanking(true);
        setComment("");
      }

      setLoaded(true);
    }, 0);

    return () => window.clearTimeout(timer);
  }, [date]);

  useEffect(() => {
    const syncProfileName = () => {
      const profile = loadProfile();
      const storedName =
        profile.displayName ??
        profile.name ??
        profile.rankingName ??
        profile.nickname ??
        "";
      setProfileName(isAnonymousDisplayName(storedName) ? "" : storedName);
      setPrefecture(profile.prefecture ?? "");
      setProfileArea(profile.area ?? "");
    };

    window.addEventListener("ubalog-profile-updated", syncProfileName);
    window.addEventListener("focus", syncProfileName);

    return () => {
      window.removeEventListener("ubalog-profile-updated", syncProfileName);
      window.removeEventListener("focus", syncProfileName);
    };
  }, []);

  const saveUserInfo = (nextName: string, nextPrefecture: string, nextArea: string) => {
    const user = createUserFromInput({
      name: nextName,
      prefecture: nextPrefecture,
      area: nextArea,
    });
    const currentProfile = loadProfile();
    const nextProfile: Profile = {
      ...currentProfile,
      displayName: nextName.trim(),
      name: nextName.trim(),
      prefecture: user.prefecture,
      region: user.region,
      area: user.area,
    };
    saveProfile(nextProfile);
    setActiveUser(user);
  };

  const handleNameChange = (value: string) => {
    const next = cleanText(value, MAX_NAME_LENGTH);
    setProfileName(next);
    saveUserInfo(next, prefecture, profileArea);
  };

  const handlePrefectureChange = (value: string) => {
    setPrefecture(value);
    saveUserInfo(profileName, value, profileArea);
  };

  const handleAreaChange = (value: string) => {
    setProfileArea(value);
    saveUserInfo(profileName, prefecture, value);
  };

  const total = useMemo(() => {
    return (
      amountFromInput(uber) +
      amountFromInput(demae) +
      amountFromInput(menu) +
      amountFromInput(rocket) +
      amountFromInput(other)
    );
  }, [uber, demae, menu, rocket, other]);

  const workMinutes = useMemo(() => {
    if (!startTime || !endTime) return 0;
    const [sh, sm] = startTime.split(":").map(Number);
    const [eh, em] = endTime.split(":").map(Number);
    if ([sh, sm, eh, em].some((value) => Number.isNaN(value))) return 0;
    const start = sh * 60 + sm;
    const end = eh * 60 + em;
    const rest = clampNumber(parseInt(breakTime || "0", 10) || 0, 0, MAX_WORK_MINUTES);
    return clampNumber(end - start - rest, 0, MAX_WORK_MINUTES);
  }, [startTime, endTime, breakTime]);

  const workText = useMemo(() => {
    if (!startTime || !endTime || workMinutes === 0) return "-";
    const h = Math.floor(workMinutes / 60);
    const m = workMinutes % 60;
    return `${h}:${String(m).padStart(2, "0")}`;
  }, [endTime, startTime, workMinutes]);

  const dailyGoalAmount = useMemo(() => {
    if (typeof window === "undefined") return 0;
    const plan = getMonthlyGoal(monthKeyFromDate(date));
    return plan?.dailyGoals.find((goal) => goal.date === date)?.targetAmount ?? 0;
  }, [date]);

  const goalDiff = total - dailyGoalAmount;
  const showRecordGuide = !recordGuideDismissed && !isEditing && recordCount < 3;
  const dismissRecordGuide = () => {
    writeStorageBoolean(RECORD_GUIDE_DISMISSED_KEY, true);
    setRecordGuideDismissed(true);
  };

  const openRocketBulkImport = () => {
    setRocketBulkLaunchToken(Date.now());
  };

  const totalDeliveriesInput =
    deliveriesFromInput(uberCount) +
    deliveriesFromInput(demaeCount) +
    deliveriesFromInput(menuCount) +
    deliveriesFromInput(rocketCount) +
    deliveriesFromInput(otherCount);
  const savePreview =
    total > 0
      ? `保存内容 ${formatCurrency(total)} / ${totalDeliveriesInput.toLocaleString()}件 / 稼働${workText}`
      : "売上を入力してください";

  const handleSave = () => {
    if (saving) return;

    const now = new Date().toISOString();
    const records = loadRecords();
    const existing = records.find((item) => item.date === date);
    const isFirstRecordSave = records.length === 0 && !existing;
    const currentProfile = loadProfile();
    const safeName = cleanText(profileName, MAX_NAME_LENGTH);
    const safeComment = cleanText(comment, MAX_COMMENT_LENGTH);
    const safeBreakMinutes = clampNumber(parseInt(breakTime || "0", 10) || 0, 0, MAX_WORK_MINUTES);
    const safeWorkMinutes = clampNumber(workMinutes, 0, MAX_WORK_MINUTES);
    const safeServices = {
      uber: {
        amount: amountFromInput(uber),
        deliveries: deliveriesFromInput(uberCount),
      },
      demae: {
        amount: amountFromInput(demae),
        deliveries: deliveriesFromInput(demaeCount),
      },
      menu: {
        amount: amountFromInput(menu),
        deliveries: deliveriesFromInput(menuCount),
      },
      rocket: {
        amount: amountFromInput(rocket),
        deliveries: deliveriesFromInput(rocketCount),
      },
      other: {
        amount: amountFromInput(other),
        deliveries: deliveriesFromInput(otherCount),
      },
    };
    const safeTotal = Object.values(safeServices).reduce((sum, service) => sum + service.amount, 0);
    const safeHourly = safeWorkMinutes > 0 ? Math.floor(safeTotal / (safeWorkMinutes / 60)) : 0;
    const activeUser = createUserFromInput({
      name: safeName,
      prefecture,
      area: profileArea,
    });
    setActiveUser(activeUser);
    const nextProfile: Profile = {
      ...currentProfile,
      displayName: safeName,
      name: safeName,
      prefecture: activeUser.prefecture,
      region: activeUser.region,
      area: activeUser.area,
    };
    saveProfile(nextProfile);

    const newRecord: StoredRecord = {
      date,
      userId: activeUser.id,
      name: safeName || activeUser.name || profileDisplayName(nextProfile),
      prefecture: nextProfile.prefecture,
      region: nextProfile.region,
      area: nextProfile.area,
      comment: safeComment,
      startTime,
      endTime,
      breakMinutes: safeBreakMinutes,
      services: safeServices,
      total: safeTotal,
      workMinutes: safeWorkMinutes,
      hourly: safeHourly,
      ranking,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };

    const filtered = records.filter((item) => item.date !== date);
    const next = [newRecord, ...filtered].sort((a, b) =>
      a.date < b.date ? 1 : -1
    );

    saveRecords(next);
    void saveRecordWithSync(newRecord);
    if (startTime && endTime) {
      saveLastWorkTime({
        startTime,
        endTime,
        breakMinutes: safeBreakMinutes,
      });
    }
    addNewsForRecord(newRecord, next);
    addTopUpdateNewsForRecord(newRecord, next);
    addBreakingRecordNews(newRecord);
    saveHighlightUpdate({
      recordDate: newRecord.date,
      fields: buildHighlightFields(newRecord, next),
      createdAt: now,
    });

    const plan = getMonthlyGoal(monthKeyFromDate(newRecord.date));
    const week = getWeekRange(newRecord.date);
    const weeklyTarget =
      plan?.dailyGoals
        .filter((goal) => goal.date >= week.start && goal.date <= week.end)
        .reduce((sum, goal) => sum + goal.targetAmount, 0) ?? 0;
    const weeklyActual = sumRecords(
      next.filter((record) => record.date >= week.start && record.date <= week.end)
    );
    const monthlyTarget = plan?.dailyGoals.reduce((sum, goal) => sum + goal.targetAmount, 0) ?? 0;
    const monthlyActual = sumRecords(
      next.filter((record) => record.date.startsWith(monthKeyFromDate(newRecord.date)))
    );

    const nextCongrats: CongratsState =
      monthlyTarget > 0 && monthlyActual >= monthlyTarget
        ? {
        type: "monthly",
        message: "月間目標達成！！本当にすごい！！！",
          }
        : weeklyTarget > 0 && weeklyActual >= weeklyTarget
        ? {
        type: "weekly",
        message: "週間目標達成！すごい！",
          }
        : dailyGoalAmount > 0 && goalDiff >= 0
        ? {
        type: "daily",
        message: "ナイス達成！",
          }
        : null;

    if (nextCongrats) setCongrats(nextCongrats);

    if (dailyGoalAmount > 0) {
      setToastMessage(
        goalDiff >= 0
          ? "記録しました。今日の目標達成！"
          : `記録しました。目標まであと ${formatCurrency(Math.abs(goalDiff))}`
      );
    } else {
      setToastMessage(isEditing ? "更新しました" : "保存しました");
    }
    setAfterSaveMessage(isFirstRecordSave ? "記録しました！" : "記録しました");
    setLastSavedRecord(newRecord);
    setShowAfterSaveActions(true);
    setSaving(true);
    setShowToast(true);

    setTimeout(() => {
      router.push(rankingUrlForDate(newRecord.date));
      router.refresh();
    }, nextCongrats ? 2600 : 1000);
  };

  if (!loaded) return null;

  return (
    <main className="mx-auto min-h-screen w-full max-w-[430px] overflow-x-hidden bg-gray-50 pb-24">
      <AppHeader />
      <Toast
        message={toastMessage || (isEditing ? "更新しました" : "保存しました")}
        show={showToast}
      />
      {congrats && (
        <CongratsOverlay
          type={congrats.type}
          message={congrats.message}
          onClose={() => setCongrats(null)}
        />
      )}

      <div className="sticky top-16 z-20 border-b bg-white px-4 pb-3 pt-3">
        <div className="grid grid-cols-[1.45fr_1fr_1fr] gap-2">
          <input
            type="text"
            value={profileName}
            maxLength={MAX_NAME_LENGTH}
            onChange={(e) => handleNameChange(e.target.value)}
            className="h-10 min-w-0 rounded-xl border border-yellow-200 bg-yellow-50 px-2 text-[13px] font-bold outline-none placeholder:text-yellow-500/60 focus:border-green-500 focus:ring-2 focus:ring-green-100"
            placeholder="表示名入力"
            aria-label="表示名入力"
          />
          <select
            value={prefecture}
            onChange={(e) => handlePrefectureChange(e.target.value)}
            className="h-10 min-w-0 rounded-xl border border-gray-200 bg-gray-50 px-1.5 text-xs font-bold outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100"
            aria-label="都道府県"
          >
            <option value="">都道府県</option>
            {PREFECTURES.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
          <input
            type="text"
            value={profileArea}
            onChange={(e) => handleAreaChange(e.target.value)}
            className="h-10 min-w-0 rounded-xl border border-gray-200 bg-gray-50 px-2 text-xs font-bold outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100"
            placeholder="エリア"
            aria-label="エリア"
          />
        </div>

        <RecordGoalCalendar selectedDate={date} onSelectDate={setDate} />
      </div>

      <div className="px-4 py-4 pb-[calc(14rem+env(safe-area-inset-bottom))]">
        {showRecordGuide && (
          <div className="mb-4">
            <OnboardingCard
              title="金額だけでもOK"
              body="件数や稼働時間を入れると、時給や1件単価も見られます"
              onSecondary={dismissRecordGuide}
              secondaryLabel="閉じる"
              tone="blue"
            />
          </div>
        )}

        <div className="mb-3 rounded-2xl bg-white p-3 shadow-sm">
          <div className="flex items-center gap-2">
            <div className="shrink-0 text-sm font-bold text-gray-700">日付</div>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="h-10 min-w-0 flex-1 rounded-xl border border-gray-200 bg-gray-50 px-2 text-sm font-bold outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100"
            />
            <button
              type="button"
              onClick={() => setDate(todayIsoDate())}
              className="h-9 shrink-0 rounded-full bg-green-600 px-3 text-xs font-bold text-white active:bg-green-700"
            >
              今日
            </button>
            <button
              type="button"
              onClick={() => setDate(offsetIsoDate(-1))}
              className="h-9 shrink-0 rounded-full bg-gray-100 px-3 text-xs font-bold text-gray-700 active:bg-gray-200"
            >
              昨日
            </button>
          </div>
        </div>

        <div className="rounded-2xl bg-white p-4 shadow-sm">

          <div className="flex flex-wrap items-center gap-2 text-sm text-gray-700">
            <span>開始</span>
            <input
              type="time"
              value={startTime}
              step={300}
              onChange={(e) => setStartTime(roundTimeToFiveMinutes(e.target.value))}
              placeholder="--:--"
              className={`rounded-md border px-2 py-1 ${startTime ? "" : "text-gray-400"}`}
            />

            <span>終了</span>
            <input
              type="time"
              value={endTime}
              step={300}
              onChange={(e) => setEndTime(roundTimeToFiveMinutes(e.target.value))}
              placeholder="--:--"
              className={`rounded-md border px-2 py-1 ${endTime ? "" : "text-gray-400"}`}
            />

            <span>休憩</span>
            <select
              value={breakTime}
              onChange={(e) => setBreakTime(e.target.value)}
              className={`rounded-md border px-2 py-1 ${breakTime ? "" : "text-gray-400"}`}
            >
              <option value="">0:00</option>
              {breakTime &&
                !BREAK_MINUTE_OPTIONS.includes(parseInt(breakTime, 10)) && (
                  <option value={breakTime}>
                    {formatBreakMinutes(parseInt(breakTime, 10))}
                  </option>
                )}
              {BREAK_MINUTE_OPTIONS.map((minutes) => (
                <option key={minutes} value={String(minutes)}>
                  {formatBreakMinutes(minutes)}
                </option>
              ))}
            </select>
          </div>

          <div className="mt-4 space-y-3">
            <Row company="Uber" value={uber} count={uberCount} onChange={setUber} onCountChange={setUberCount} />
            <Row company="出前館" value={demae} count={demaeCount} onChange={setDemae} onCountChange={setDemaeCount} />
            <Row company="menu" value={menu} count={menuCount} onChange={setMenu} onCountChange={setMenuCount} />
            <Row
              company="Rocket"
              value={rocket}
              count={rocketCount}
              onChange={setRocket}
              onCountChange={setRocketCount}
              scanControl={
                <button
                  type="button"
                  title="ロケナウスキャン"
                  aria-label="ロケナウスキャン"
                  onClick={openRocketBulkImport}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-green-200 bg-green-50 text-lg font-black text-green-700 active:bg-green-100"
                >
                  📷
                </button>
              }
            />
            <Row company="その他" value={other} count={otherCount} onChange={setOther} onCountChange={setOtherCount} />
          </div>

          <label className="mt-4 block text-sm text-gray-800">
            <span className="font-bold">一言コメント 任意</span>
            <input
              type="text"
              value={comment}
              maxLength={MAX_COMMENT_LENGTH}
              onChange={(e) => setComment(cleanText(e.target.value, MAX_COMMENT_LENGTH))}
              className="mt-2 h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100"
              placeholder="最大25文字"
            />
          </label>

          <label className="mt-4 flex items-center gap-2 text-sm text-gray-800">
            <input
              type="checkbox"
              checked={ranking}
              onChange={(e) => setRanking(e.target.checked)}
              className="h-4 w-4"
            />
            ランキングに参加する
          </label>
        </div>

        {showAfterSaveActions && (
          <section className="mt-4 rounded-2xl border border-green-100 bg-white p-4 shadow-sm">
            <div className="text-sm font-black text-gray-900">{afterSaveMessage}</div>
            {lastSavedRecord && (
              <div className="mt-2 rounded-xl bg-green-50 px-3 py-2 text-xs font-black text-green-800">
                売上 {formatCurrency(lastSavedRecord.total)} / {totalDeliveries(lastSavedRecord)}件
              </div>
            )}
            <div className="mt-2 text-xs font-bold text-gray-500">
              ランキングへ移動します
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => {
                  if (lastSavedRecord) openXShare(buildRecordShareText(lastSavedRecord));
                }}
                className="rounded-xl border border-green-200 bg-green-50 px-2 py-2 text-center text-xs font-black text-green-700 active:bg-green-100"
              >
                Xでシェア
              </button>
              <Link
                href={lastSavedRecord ? rankingUrlForDate(lastSavedRecord.date) : "/ranking"}
                className="rounded-xl bg-green-600 px-3 py-2 text-center text-xs font-black text-white"
              >
                ランキングを見る
              </Link>
              <Link
                href="/mypage"
                className="rounded-xl border border-green-200 px-2 py-2 text-center text-xs font-black text-green-700"
              >
                マイページ
              </Link>
            </div>
          </section>
        )}

        <div className="mt-4 space-y-3">
          <RocketNowDailyScanGuide />
          <div ref={rocketBulkPanelRef}>
            <RocketNowBulkImportPanel
              selectedDate={date}
              profile={{
                name: profileName.trim() || getAnonymousDisplayName(),
                prefecture,
                area: profileArea,
              }}
              onCurrentDateImported={({ amount, deliveries }) => {
                setRocket(String(amount));
                setRocketCount(String(deliveries));
              }}
              onSelectDate={setDate}
              launchToken={rocketBulkLaunchToken}
            />
          </div>
          <RocketNowDisplayResetButton />
        </div>

        <RecordStatsGoalsPanel />
      </div>

      <SaveButton onClick={handleSave} preview={savePreview} disabled={saving} />
      <BottomMenu />
    </main>
  );
}

function Row({
  company,
  value,
  count,
  onChange,
  onCountChange,
  scanControl,
  status,
}: {
  company: string;
  value: string;
  count: string;
  onChange: (value: string) => void;
  onCountChange: (value: string) => void;
  scanControl?: ReactNode;
  status?: ReactNode;
}) {
  return (
    <div className="min-w-0 space-y-1">
      <div className="flex min-w-0 items-center justify-between gap-2">
        <div className="w-16 shrink-0 text-sm font-semibold text-gray-800 sm:w-20">
          {company}
        </div>

        {scanControl}

        <div className="flex min-w-0 flex-1 items-center rounded-lg border border-gray-200 bg-white px-2 py-2 focus-within:border-green-500 focus-within:ring-2 focus-within:ring-green-100">
          <span className="mr-1 text-sm text-gray-500">{"\uffe5"}</span>
          <input
            type="text"
            inputMode="numeric"
            value={value}
            placeholder="0"
            onChange={(e) => onChange(numericInputValue(e.target.value, MAX_AMOUNT))}
            className="w-full min-w-0 border-none bg-transparent text-right text-sm outline-none"
          />
        </div>

        <div className="flex w-[4.5rem] shrink-0 items-center rounded-lg border border-gray-200 bg-white px-2 py-2 focus-within:border-green-500 focus-within:ring-2 focus-within:ring-green-100">
          <input
            type="text"
            inputMode="numeric"
            value={count}
            placeholder="0"
            onChange={(e) => onCountChange(numericInputValue(e.target.value, MAX_DELIVERIES))}
            className="w-full min-w-0 border-none bg-transparent text-right text-sm outline-none"
          />
          <span className="ml-1 shrink-0 text-sm text-gray-500">{"\u4ef6"}</span>
        </div>
      </div>
      {status && (
        <div className="min-w-0 pl-[4.5rem] sm:pl-[5.5rem]">
          {status}
        </div>
      )}
    </div>
  );
}

function RocketNowDisplayResetButton() {
  const resetDisplay = () => {
    [
      "ubalog-rocketnow-guide-open",
      "ubalog-rocketnow-bulk-panel-open",
      "ubalog-rocketnow-accuracy-panel-open",
      "ubalog-rocketnow-history-panel-open",
    ].forEach((key) => localStorage.removeItem(key));
    window.location.reload();
  };

  return (
    <div className="flex justify-center">
      <button
        type="button"
        onClick={resetDisplay}
        className="rounded-full bg-gray-100 px-3 py-1.5 text-[11px] font-bold text-gray-500 active:bg-gray-200"
      >
        表示を整える
      </button>
    </div>
  );
}
