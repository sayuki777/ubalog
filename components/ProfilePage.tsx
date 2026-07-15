"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import AppHeader from "@/components/AppHeader";
import BottomMenu from "@/components/BottomMenu";
import DataBackupPanel from "@/components/DataBackupPanel";
import FooterLinks from "@/components/FooterLinks";
import Toast from "@/components/Toast";
import { getRegionByPrefecture, PREFECTURES } from "@/lib/areas";
import { PROFILE_GUIDE_DISMISSED_KEY, writeStorageBoolean } from "@/lib/onboarding";
import { createUserFromInput, setActiveUser } from "@/lib/users";

const STORAGE_KEY = "ubalog-profile";
const RECORDS_STORAGE_KEY = "ubalog-records";
const serviceOptions = ["", "Uber", "出前館", "menu", "Rocket", "その他"];
const workStyleOptions = ["", "本業", "副業"];
const vehicleTypeOptions = ["", "バイク", "自転車", "軽貨物", "徒歩"];

type Profile = {
  displayName: string;
  name: string;
  realName: string;
  nickname: string;
  prefecture: string;
  region: string;
  area: string;
  mainService: string;
  subService: string;
  subSubService: string;
  subSubSubService: string;
  workStyle: string;
  vehicleType: string;
  rankingName: string;
  xAccount: string;
  openChatName: string;
};

const initialProfile: Profile = {
  displayName: "",
  name: "",
  realName: "",
  nickname: "",
  prefecture: "",
  region: "",
  area: "",
  mainService: "",
  subService: "",
  subSubService: "",
  subSubSubService: "",
  workStyle: "",
  vehicleType: "",
  rankingName: "",
  xAccount: "",
  openChatName: "",
};

function loadProfile(): Profile {
  if (typeof window === "undefined") return initialProfile;

  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return initialProfile;

  try {
    const parsed = { ...initialProfile, ...JSON.parse(raw) } as Profile;
    const displayName =
      parsed.displayName || parsed.name || parsed.rankingName || parsed.nickname || "";
    return { ...parsed, displayName, name: displayName };
  } catch {
    return initialProfile;
  }
}

function loadRecordCount() {
  if (typeof window === "undefined") return 0;

  const raw = localStorage.getItem(RECORDS_STORAGE_KEY);
  if (!raw) return 0;

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.length : 0;
  } catch {
    return 0;
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
  const [recordCount, setRecordCount] = useState(0);
  const [feedbackCopyMessage, setFeedbackCopyMessage] = useState("");
  const [feedbackFallbackText, setFeedbackFallbackText] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setProfile(loadProfile());
      setRecordCount(loadRecordCount());
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
    const displayName = profile.displayName.trim();
    const nextProfile = {
      ...profile,
      displayName,
      name: displayName,
      realName: profile.realName.trim(),
      workStyle: profile.workStyle.trim(),
      vehicleType: profile.vehicleType.trim(),
      xAccount: profile.xAccount.trim(),
      openChatName: profile.openChatName.trim(),
      region: getRegionByPrefecture(profile.prefecture),
    };
    saveProfile(nextProfile);
    if (displayName) {
      writeStorageBoolean(PROFILE_GUIDE_DISMISSED_KEY, true);
    }
    setActiveUser(
      createUserFromInput({
        name: nextProfile.displayName || nextProfile.name || nextProfile.rankingName || nextProfile.nickname,
        prefecture: nextProfile.prefecture,
        area: nextProfile.area,
      })
    );
    setShowToast(true);

    window.setTimeout(() => {
      setShowToast(false);
    }, 1600);
  };

  const copyFeedbackText = async () => {
    const text = [
      "ウバログを使ってみました。",
      "気づいたこと：",
      "機種：",
      "画面：",
    ].join("\n");

    try {
      await navigator.clipboard.writeText(text);
      setFeedbackCopyMessage("コピーしました");
      setFeedbackFallbackText("");
    } catch {
      setFeedbackCopyMessage("文章を表示しました");
      setFeedbackFallbackText(text);
    }
  };

  if (!loaded) return null;

  const showRecruitLink = recordCount === 0 || !profile.mainService.trim();

  return (
    <main className="mx-auto min-h-screen w-full max-w-[430px] bg-gray-50 pb-24">
      <AppHeader title="プロフィール" />
      <Toast message="保存しました" show={showToast} />

      <div className="px-4 pb-32 pt-4">
        <section className="rounded-2xl bg-white p-4 shadow-sm">
          <div className="space-y-3">
            <Field label="表示名（ニックネーム）">
              <input
                type="text"
                value={profile.displayName}
                onChange={(e) => updateField("displayName", e.target.value)}
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
                {serviceOptions.map((service) => (
                  <option key={service || "empty-main"} value={service}>
                    {service || "未選択"}
                  </option>
                ))}
              </select>
            </Field>

            <ServiceField
              label="サブ配達サービス"
              value={profile.subService}
              onChange={(value) => updateField("subService", value)}
            />

            <Field label="本業/副業">
              <select
                value={profile.workStyle}
                onChange={(e) => updateField("workStyle", e.target.value)}
                className="h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100"
              >
                {workStyleOptions.map((item) => (
                  <option key={`work-style-${item || "empty"}`} value={item}>
                    {item || "未選択"}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="乗り物">
              <select
                value={profile.vehicleType}
                onChange={(e) => updateField("vehicleType", e.target.value)}
                className="h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100"
              >
                {vehicleTypeOptions.map((item) => (
                  <option key={`vehicle-type-${item || "empty"}`} value={item}>
                    {item || "未選択"}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Xアカウント">
              <input
                type="text"
                value={profile.xAccount}
                onChange={(e) => updateField("xAccount", e.target.value)}
                className="h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100"
                placeholder="@example"
              />
            </Field>

            <Field label="オプチャ/オプチャ名">
              <input
                type="text"
                value={profile.openChatName}
                onChange={(e) => updateField("openChatName", e.target.value)}
                className="h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100"
                placeholder="オプチャ名"
              />
            </Field>
          </div>
        </section>

        <DataBackupPanel />

        <section className="mt-4 rounded-2xl bg-white p-4 shadow-sm">
          <div className="text-sm font-black text-gray-900">
            不具合・感想を送る
          </div>
          <p className="mt-1 text-xs font-bold leading-5 text-gray-500">
            気づいたことを送るときの文章をコピーできます。
          </p>
          <button
            type="button"
            onClick={() => void copyFeedbackText()}
            className="mt-3 h-10 w-full rounded-xl border border-green-200 bg-green-50 text-sm font-black text-green-700 active:bg-green-100"
          >
            コピーする
          </button>
          {feedbackCopyMessage && (
            <div className="mt-2 text-xs font-bold text-green-700">
              {feedbackCopyMessage}
            </div>
          )}
          {feedbackFallbackText && (
            <textarea
              value={feedbackFallbackText}
              readOnly
              className="mt-2 max-h-32 w-full resize-none rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-700 outline-none"
            />
          )}
        </section>

        {showRecruitLink && (
          <Link
            href="/recruit"
            className="mt-4 block rounded-2xl border border-green-100 bg-white p-4 shadow-sm active:bg-green-50"
          >
            <div className="text-sm font-black text-gray-900">
              配達を始めたい人はこちら
            </div>
            <div className="mt-1 text-xs font-bold text-gray-500">
              Uber Eats・ロケナウ・menuなどの登録導線をまとめています。
            </div>
            <div className="mt-2 text-xs font-bold text-green-700">
              配達員募集を見る
            </div>
          </Link>
        )}

        <FooterLinks />
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

function ServiceField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <Field label={label}>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100"
      >
        {serviceOptions.map((service) => (
          <option key={`${label}-${service || "empty"}`} value={service}>
            {service || "未選択"}
          </option>
        ))}
      </select>
    </Field>
  );
}
