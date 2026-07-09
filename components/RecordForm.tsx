"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import AppHeader from "@/components/AppHeader";
import BottomMenu from "@/components/BottomMenu";
import SaveButton from "@/components/SaveButton";
import Toast from "@/components/Toast";

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

function todayIsoDate() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
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
  const [loaded, setLoaded] = useState(false);
  const [showToast, setShowToast] = useState(false);
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
      const current = records.find((item) => item.date === date);

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
      }

      setLoaded(true);
    }, 0);

    return () => window.clearTimeout(timer);
  }, [date]);

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

  const handleSave = () => {
    if (saving) return;

    const now = new Date().toISOString();
    const records = loadRecords();
    const existing = records.find((item) => item.date === date);

    const newRecord: StoredRecord = {
      date,
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
      <Toast message={isEditing ? "譖ｴ譁ｰ縺励∪縺励◆" : "菫晏ｭ倥＠縺ｾ縺励◆"} show={showToast} />

      <div className="sticky top-16 z-20 border-b bg-white px-4 pb-4 pt-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xl font-bold text-gray-900">險倬鹸繧偵▽縺代ｋ</div>
            <div className="mt-1 text-xs font-bold text-green-700">
              {isEditing ? `${date.replaceAll("-", "/")} 縺ｮ險倬鹸繧堤ｷｨ髮・ｸｭ` : "譁ｰ隕剰ｨ倬鹸"}
            </div>
          </div>

          <div
            className={`rounded-full px-3 py-1 text-xs font-bold ${
              isEditing
                ? "bg-green-50 text-green-700"
                : "bg-blue-50 text-blue-700"
            }`}
          >
            {isEditing ? "邱ｨ髮" : "譁ｰ隕"}
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-gray-700">
            <span>套</span>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="rounded-md border px-2 py-1"
            />
          </div>

          <div className="rounded-full bg-green-50 px-3 py-1 text-xs font-bold text-green-700">
            {date.replaceAll("-", "/")}
          </div>
        </div>

        <div className="mt-4 text-lg font-bold text-gray-900">
          蜷郁ｨ・・･{total.toLocaleString()}縲譎らｵｦ ・･{hourly.toLocaleString()}
        </div>
      </div>

      <div className="px-4 py-4 pb-32">
        <div className="rounded-2xl bg-white p-4 shadow-sm">
          <div className="text-base font-bold text-gray-900">遞ｼ蜒・{workText}</div>

          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-gray-700">
            <span>髢句ｧ</span>
            <input
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="rounded-md border px-2 py-1"
            />

            <span>邨ゆｺ</span>
            <input
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="rounded-md border px-2 py-1"
            />

            <span>莨第・</span>
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
            <Row company="蜃ｺ蜑埼､ｨ" value={demae} count={demaeCount} onChange={setDemae} onCountChange={setDemaeCount} />
            <Row company="menu" value={menu} count={menuCount} onChange={setMenu} onCountChange={setMenuCount} />
            <Row company="Rocket" value={rocket} count={rocketCount} onChange={setRocket} onCountChange={setRocketCount} />
            <Row company="縺昴・莉" value={other} count={otherCount} onChange={setOther} onCountChange={setOtherCount} />
          </div>

          <label className="mt-4 flex items-center gap-2 text-sm text-gray-800">
            <input
              type="checkbox"
              checked={ranking}
              onChange={(e) => setRanking(e.target.checked)}
              className="h-4 w-4"
            />
            繝ｩ繝ｳ繧ｭ繝ｳ繧ｰ縺ｫ蜿ょ刈縺吶ｋ
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
        <span className="mr-1 text-sm text-gray-500">・･</span>
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
        <span className="ml-1 text-sm text-gray-500">莉ｶ</span>
      </div>
    </div>
  );
}

