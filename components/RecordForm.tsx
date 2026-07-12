"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import AppHeader from "@/components/AppHeader";
import BottomMenu from "@/components/BottomMenu";
import SaveButton from "@/components/SaveButton";
import Toast from "@/components/Toast";
import { PREFECTURES } from "@/lib/areas";
import { getMonthlyGoal } from "@/lib/goals";
import {
  createUserFromInput,
  ensureActiveUserFromProfile,
  setActiveUser,
} from "@/lib/users";

const STORAGE_KEY = "ubalog-records";
const PROFILE_STORAGE_KEY = "ubalog-profile";

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
  name?: string;
  nickname?: string;
  rankingName?: string;
  prefecture?: string;
  region?: string;
  area?: string;
  mainService?: string;
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

function profileDisplayName(profile: Profile) {
  return (
    profile.name?.trim() ||
    profile.rankingName?.trim() ||
    profile.nickname?.trim() ||
    "匿名配達員"
  );
}

function todayIsoDate() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function monthKeyFromDate(iso: string) {
  return iso.slice(0, 7);
}

function formatCurrency(amount: number) {
  return `￥${amount.toLocaleString()}`;
}

export default function RecordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [date, setDate] = useState(todayIsoDate());
  const [startTime, setStartTime] = useState("10:30");
  const [endTime, setEndTime] = useState("20:30");
  const [breakTime, setBreakTime] = useState("60");

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
  const [isEditing, setIsEditing] = useState(false);

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
      setProfileName(
        activeUser?.name ?? profile.name ?? profile.rankingName ?? profile.nickname ?? ""
      );
      setPrefecture(activeUser?.prefecture ?? profile.prefecture ?? "");
      setProfileArea(activeUser?.area ?? profile.area ?? "");

      if (current) {
        setIsEditing(true);

        setStartTime(current.startTime);
        setEndTime(current.endTime);
        setBreakTime(String(current.breakMinutes));

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

        setStartTime("10:30");
        setEndTime("20:30");
        setBreakTime("60");

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

  const saveUserInfo = (nextName: string, nextPrefecture: string, nextArea: string) => {
    const user = createUserFromInput({
      name: nextName,
      prefecture: nextPrefecture,
      area: nextArea,
    });
    const currentProfile = loadProfile();
    const nextProfile: Profile = {
      ...currentProfile,
      name: user.name,
      prefecture: user.prefecture,
      region: user.region,
      area: user.area,
    };
    saveProfile(nextProfile);
    setActiveUser(user);
  };

  const handleNameChange = (value: string) => {
    const next = value.slice(0, 10);
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
      (parseInt(uber || "0", 10) || 0) +
      (parseInt(demae || "0", 10) || 0) +
      (parseInt(menu || "0", 10) || 0) +
      (parseInt(rocket || "0", 10) || 0) +
      (parseInt(other || "0", 10) || 0)
    );
  }, [uber, demae, menu, rocket, other]);

  const workMinutes = useMemo(() => {
    const [sh, sm] = startTime.split(":").map(Number);
    const [eh, em] = endTime.split(":").map(Number);
    const start = sh * 60 + sm;
    const end = eh * 60 + em;
    const rest = parseInt(breakTime || "0", 10) || 0;
    return Math.max(end - start - rest, 0);
  }, [startTime, endTime, breakTime]);

  const hourly = useMemo(() => {
    if (workMinutes === 0) return 0;
    return Math.floor(total / (workMinutes / 60));
  }, [total, workMinutes]);

  const workText = useMemo(() => {
    const h = Math.floor(workMinutes / 60);
    const m = workMinutes % 60;
    return `${h}:${String(m).padStart(2, "0")}`;
  }, [workMinutes]);

  const dailyGoalAmount = useMemo(() => {
    if (typeof window === "undefined") return 0;
    const plan = getMonthlyGoal(monthKeyFromDate(date));
    return plan?.dailyGoals.find((goal) => goal.date === date)?.targetAmount ?? 0;
  }, [date]);

  const goalDiff = total - dailyGoalAmount;
  const goalMessage =
    dailyGoalAmount > 0
      ? goalDiff >= 0
        ? `目標達成！ +${formatCurrency(goalDiff)}`
        : `あと ${formatCurrency(Math.abs(goalDiff))}`
      : "";

  const handleSave = () => {
    if (saving) return;

    const now = new Date().toISOString();
    const records = loadRecords();
    const existing = records.find((item) => item.date === date);
    const currentProfile = loadProfile();
    const activeUser = createUserFromInput({
      name: profileName,
      prefecture,
      area: profileArea,
    });
    setActiveUser(activeUser);
    const nextProfile: Profile = {
      ...currentProfile,
      name: activeUser.name,
      prefecture: activeUser.prefecture,
      region: activeUser.region,
      area: activeUser.area,
    };
    saveProfile(nextProfile);

    const newRecord: StoredRecord = {
      date,
      userId: activeUser.id,
      name: profileDisplayName(nextProfile),
      prefecture: nextProfile.prefecture,
      region: nextProfile.region,
      area: nextProfile.area,
      comment: comment.trim(),
      startTime,
      endTime,
      breakMinutes: parseInt(breakTime || "0", 10) || 0,
      services: {
        uber: {
          amount: parseInt(uber || "0", 10) || 0,
          deliveries: parseInt(uberCount || "0", 10) || 0,
        },
        demae: {
          amount: parseInt(demae || "0", 10) || 0,
          deliveries: parseInt(demaeCount || "0", 10) || 0,
        },
        menu: {
          amount: parseInt(menu || "0", 10) || 0,
          deliveries: parseInt(menuCount || "0", 10) || 0,
        },
        rocket: {
          amount: parseInt(rocket || "0", 10) || 0,
          deliveries: parseInt(rocketCount || "0", 10) || 0,
        },
        other: {
          amount: parseInt(other || "0", 10) || 0,
          deliveries: parseInt(otherCount || "0", 10) || 0,
        },
      },
      total,
      workMinutes,
      hourly,
      ranking,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };

    const filtered = records.filter((item) => item.date !== date);
    const next = [newRecord, ...filtered].sort((a, b) =>
      a.date < b.date ? 1 : -1
    );

    saveRecords(next);

    if (dailyGoalAmount > 0) {
      setToastMessage(
        goalDiff >= 0
          ? "記録しました。今日の目標達成！"
          : `記録しました。目標まであと ${formatCurrency(Math.abs(goalDiff))}`
      );
    } else {
      setToastMessage(isEditing ? "更新しました" : "保存しました");
    }
    setSaving(true);
    setShowToast(true);

    setTimeout(() => {
      router.push("/");
      router.refresh();
    }, 900);
  };

  if (!loaded) return null;

  return (
    <main className="mx-auto min-h-screen w-full max-w-[430px] bg-gray-50 pb-24">
      <AppHeader />
      <Toast
        message={toastMessage || (isEditing ? "更新しました" : "保存しました")}
        show={showToast}
      />

      <div className="sticky top-16 z-20 border-b bg-white px-4 pb-3 pt-3">
        <div className="grid grid-cols-[1fr_1fr_1fr] gap-2">
          <input
            type="text"
            value={profileName}
            maxLength={10}
            onChange={(e) => handleNameChange(e.target.value)}
            className="h-10 min-w-0 rounded-xl border border-gray-200 bg-gray-50 px-2 text-sm font-bold outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100"
            placeholder="表示名"
            aria-label="表示名"
          />
          <select
            value={prefecture}
            onChange={(e) => handlePrefectureChange(e.target.value)}
            className="h-10 min-w-0 rounded-xl border border-gray-200 bg-gray-50 px-2 text-sm font-bold outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100"
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
            className="h-10 min-w-0 rounded-xl border border-gray-200 bg-gray-50 px-2 text-sm font-bold outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100"
            placeholder="エリア"
            aria-label="エリア"
          />
        </div>

        <div className="mt-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm text-gray-700">
            <span>日付</span>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="rounded-md border px-2 py-1"
            />
          </div>

          <div className="shrink-0 rounded-full bg-green-50 px-3 py-1 text-xs font-bold text-green-700">
            {date.replaceAll("-", "/")}
          </div>
        </div>

        <div className="mt-3 rounded-2xl bg-green-50 px-3 py-2">
          <div className="flex items-end justify-between gap-3">
            <div>
              <div className="text-[11px] font-bold text-green-700">合計</div>
              <div className="text-xl font-black text-gray-900">
                ￥{total.toLocaleString()}
              </div>
            </div>
            <div className="text-right">
              <div className="text-[11px] font-bold text-green-700">時給</div>
              <div className="text-xl font-black text-gray-900">
                ￥{hourly.toLocaleString()}
              </div>
            </div>
            <div className="shrink-0 text-right">
              <div className="text-[11px] font-bold text-gray-500">稼働</div>
              <div className="text-sm font-black text-gray-700">{workText}</div>
            </div>
          </div>
          {dailyGoalAmount > 0 && (
            <div className="mt-2 flex items-center justify-between rounded-xl bg-white px-3 py-2 text-xs font-bold">
              <div className="text-gray-600">
                今日の目標 {formatCurrency(dailyGoalAmount)}
              </div>
              <div className={goalDiff >= 0 ? "text-green-700" : "text-gray-700"}>
                {goalMessage}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="px-4 py-4 pb-32">
        <div className="rounded-2xl bg-white p-4 shadow-sm">
          <div className="text-base font-bold text-gray-900">稼働 {workText}</div>

          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-gray-700">
            <span>開始</span>
            <input
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="rounded-md border px-2 py-1"
            />

            <span>終了</span>
            <input
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="rounded-md border px-2 py-1"
            />

            <span>休憩</span>
            <select
              value={breakTime}
              onChange={(e) => setBreakTime(e.target.value)}
              className="rounded-md border px-2 py-1"
            >
              <option value="0">0:00</option>
              <option value="15">0:15</option>
              <option value="30">0:30</option>
              <option value="45">0:45</option>
              <option value="60">1:00</option>
              <option value="75">1:15</option>
              <option value="90">1:30</option>
            </select>
          </div>

          <div className="mt-4 space-y-3">
            <Row company="Uber" value={uber} count={uberCount} onChange={setUber} onCountChange={setUberCount} />
            <Row company="出前館" value={demae} count={demaeCount} onChange={setDemae} onCountChange={setDemaeCount} />
            <Row company="menu" value={menu} count={menuCount} onChange={setMenu} onCountChange={setMenuCount} />
            <Row company="Rocket" value={rocket} count={rocketCount} onChange={setRocket} onCountChange={setRocketCount} />
            <Row company="その他" value={other} count={otherCount} onChange={setOther} onCountChange={setOtherCount} />
          </div>

          <label className="mt-4 block text-sm text-gray-800">
            <span className="font-bold">一言コメント 任意</span>
            <input
              type="text"
              value={comment}
              maxLength={15}
              onChange={(e) => setComment(e.target.value.slice(0, 15))}
              className="mt-2 h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100"
              placeholder="例: 雨で単価高め"
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
      </div>

      <SaveButton onClick={handleSave} />
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
}: {
  company: string;
  value: string;
  count: string;
  onChange: (value: string) => void;
  onCountChange: (value: string) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="w-20 shrink-0 text-sm font-semibold text-gray-800">
        {company}
      </div>

      <div className="flex items-center rounded-lg border border-gray-200 bg-white px-2 py-2 focus-within:border-green-500 focus-within:ring-2 focus-within:ring-green-100">
        <span className="mr-1 text-sm text-gray-500">￥</span>
        <input
          type="text"
          inputMode="numeric"
          value={value}
          placeholder="0"
          onChange={(e) => onChange(e.target.value.replace(/[^\d]/g, ""))}
          className="w-24 border-none bg-transparent text-right text-sm outline-none"
        />
      </div>

      <div className="flex items-center rounded-lg border border-gray-200 bg-white px-2 py-2 focus-within:border-green-500 focus-within:ring-2 focus-within:ring-green-100">
        <input
          type="text"
          inputMode="numeric"
          value={count}
          placeholder="0"
          onChange={(e) => onCountChange(e.target.value.replace(/[^\d]/g, ""))}
          className="w-10 border-none bg-transparent text-right text-sm outline-none"
        />
        <span className="ml-1 text-sm text-gray-500">件</span>
      </div>
    </div>
  );
}


