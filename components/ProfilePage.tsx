"use client";

import { useEffect, useState } from "react";
import AppHeader from "@/components/AppHeader";
import BottomMenu from "@/components/BottomMenu";
import DataBackupPanel from "@/components/DataBackupPanel";
import Toast from "@/components/Toast";
import { getRegionByPrefecture, PREFECTURES } from "@/lib/areas";
import { createUserFromInput, setActiveUser } from "@/lib/users";

const STORAGE_KEY = "ubalog-profile";
const services = ["Uber", "出前館", "menu", "Rocket", "その他"];

type Profile = {
  name: string;
  nickname: string;
  prefecture: string;
  region: string;
  area: string;
  mainService: string;
  rankingName: string;
};

const initialProfile: Profile = {
  name: "",
  nickname: "",
  prefecture: "",
  region: "",
  area: "",
  mainService: "Uber",
  rankingName: "",
};

function loadProfile(): Profile {
  if (typeof window === "undefined") return initialProfile;

  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return initialProfile;

  try {
    return { ...initialProfile, ...JSON.parse(raw) };
  } catch {
    return initialProfile;
  }
}

function saveProfile(profile: Profile) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
  window.dispatchEvent(new Event("ubalog-profile-updated"));
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile>(initialProfile);
  const [loaded, setLoaded] = useState(false);
  const [showToast, setShowToast] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setProfile(loadProfile());
      setLoaded(true);
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  const updateField = (key: keyof Profile, value: string) => {
    setProfile((current) => {
      if (key === "prefecture") {
        return {
          ...current,
          prefecture: value,
          region: getRegionByPrefecture(value),
        };
      }

      return { ...current, [key]: value };
    });
  };

  const handleSave = () => {
    const nextProfile = {
      ...profile,
      region: getRegionByPrefecture(profile.prefecture),
    };
    saveProfile(nextProfile);
    setActiveUser(
      createUserFromInput({
        name: nextProfile.name || nextProfile.rankingName || nextProfile.nickname,
        prefecture: nextProfile.prefecture,
        area: nextProfile.area,
      })
    );
    setShowToast(true);

    window.setTimeout(() => {
      setShowToast(false);
    }, 1600);
  };

  if (!loaded) return null;

  return (
    <main className="mx-auto min-h-screen w-full max-w-[430px] bg-gray-50 pb-24">
      <AppHeader title="プロフィール" />
      <Toast message="保存しました" show={showToast} />

      <div className="px-4 pt-4">
        <section className="rounded-2xl bg-white p-4 shadow-sm">
          <div>
            <h2 className="text-xl font-bold text-gray-900">プロフィール</h2>
            <p className="mt-1 text-sm text-gray-500">プロフィールを設定できます</p>
          </div>

          <div className="mt-5 space-y-4">
            <Field label="名前">
              <input
                type="text"
                value={profile.name}
                onChange={(e) => updateField("name", e.target.value)}
                className="h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100"
                placeholder="例: 山田太郎"
              />
            </Field>

            <Field label="ニックネーム">
              <input
                type="text"
                value={profile.nickname}
                onChange={(e) => updateField("nickname", e.target.value)}
                className="h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100"
                placeholder="例: ウバログ太郎"
              />
            </Field>

            <Field label="都道府県">
              <select
                value={profile.prefecture}
                onChange={(e) => updateField("prefecture", e.target.value)}
                className="h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100"
              >
                <option value="">選択してください</option>
                {PREFECTURES.map((prefecture) => (
                  <option key={prefecture} value={prefecture}>
                    {prefecture}
                  </option>
                ))}
              </select>
              {profile.region && (
                <div className="mt-2 text-xs font-bold text-green-700">
                  地域区分: {profile.region}
                </div>
              )}
            </Field>

            <Field label="主な稼働エリア">
              <input
                type="text"
                value={profile.area}
                onChange={(e) => updateField("area", e.target.value)}
                className="h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100"
                placeholder="例: 新宿・渋谷"
              />
            </Field>

            <Field label="メイン配達サービス">
              <select
                value={profile.mainService}
                onChange={(e) => updateField("mainService", e.target.value)}
                className="h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100"
              >
                {services.map((service) => (
                  <option key={service} value={service}>
                    {service}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="ランキング表示名">
              <input
                type="text"
                value={profile.rankingName}
                onChange={(e) => updateField("rankingName", e.target.value)}
                className="h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100"
                placeholder="例: 配達マスター"
              />
            </Field>
          </div>
        </section>

        <DataBackupPanel />
      </div>

      <div className="fixed bottom-16 left-0 right-0 z-40 bg-gradient-to-t from-gray-50 via-gray-50 to-transparent px-4 pb-3 pt-3">
        <div className="mx-auto w-full max-w-[430px]">
          <button
            type="button"
            onClick={handleSave}
            className="h-12 w-full rounded-xl bg-green-600 text-base font-bold text-white shadow-sm active:scale-[0.99]"
          >
            保存する
          </button>
        </div>
      </div>

      <BottomMenu />
    </main>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-sm font-bold text-gray-800">{label}</span>
      <div className="mt-2">{children}</div>
    </label>
  );
}
