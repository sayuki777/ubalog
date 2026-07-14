"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import AppHeader from "@/components/AppHeader";
import BottomMenu from "@/components/BottomMenu";
import { recruitServices } from "@/lib/recruit";

const CHECKLIST_STORAGE_KEY = "ubalog-recruit-checklist";

const preparationItems = [
  "スマホ",
  "本人確認書類",
  "銀行口座",
  "配達バッグ",
  "自転車・バイク・軽貨物など",
  "モバイルバッテリー",
  "雨具・防寒具",
];

const worryItems = [
  {
    title: "どのサービスから始めればいい？",
    body: "エリアや生活リズムに合うサービスから試すと始めやすいです。",
  },
  {
    title: "どのエリアが稼ぎやすい？",
    body: "曜日や時間で変わります。ウバログに記録すると傾向を見つけやすくなります。",
  },
  {
    title: "バイクと自転車どちらがいい？",
    body: "短距離中心なら自転車、広く動くならバイクや軽貨物が合う場合があります。",
  },
  {
    title: "副業でもできる？",
    body: "スキマ時間で始める人もいます。無理のない曜日と時間を決めておくと続けやすいです。",
  },
  {
    title: "確定申告は必要？",
    body: "働き方や収入で変わります。売上や稼働日を記録しておくと確認しやすくなります。",
  },
];

const checklistItems = [
  "稼働できる曜日がある",
  "スマホを持っている",
  "配達手段がある",
  "本人確認書類がある",
  "売上を記録する準備がある",
];

const nextActions = [
  { href: "/record", label: "記録タブへ" },
  { href: "/", label: "マイページへ" },
  { href: "/?tab=goal", label: "目標を作る" },
  { href: "/ranking", label: "ランキングを見る" },
];

function loadChecklist() {
  if (typeof window === "undefined") return [];

  const raw = localStorage.getItem(CHECKLIST_STORAGE_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as string[]) : [];
  } catch {
    return [];
  }
}

export default function RecruitPage() {
  const [checkedItems, setCheckedItems] = useState<string[]>([]);
  const [copiedServiceId, setCopiedServiceId] = useState("");
  const [fallbackCode, setFallbackCode] = useState("");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setCheckedItems(loadChecklist());
      setLoaded(true);
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  const toggleItem = (item: string) => {
    setCheckedItems((current) => {
      const next = current.includes(item)
        ? current.filter((value) => value !== item)
        : [...current, item];
      localStorage.setItem(CHECKLIST_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  };

  const copyReferralCode = async (serviceId: string, code: string) => {
    setFallbackCode("");

    try {
      if (!navigator.clipboard) {
        setFallbackCode(code);
        setCopiedServiceId(serviceId);
        return;
      }

      await navigator.clipboard.writeText(code);
      setCopiedServiceId(serviceId);
    } catch {
      setFallbackCode(code);
      setCopiedServiceId(serviceId);
    }
  };

  const allChecked = loaded && checkedItems.length === checklistItems.length;

  return (
    <main className="mx-auto min-h-screen w-full max-w-[430px] bg-gray-50 pb-24">
      <AppHeader title="配達員募集" />

      <div className="space-y-4 px-4 pb-[calc(8rem+env(safe-area-inset-bottom))] pt-4">
        <section className="rounded-2xl bg-gradient-to-br from-green-600 to-emerald-500 p-4 text-white shadow-sm">
          <div className="text-xs font-black text-green-100">ウバログで始める</div>
          <h1 className="mt-1 text-2xl font-black tracking-tight">配達員募集</h1>
          <p className="mt-2 text-sm font-bold text-green-50">
            はじめての配達をわかりやすくサポート
          </p>
          <div className="mt-4 grid grid-cols-2 gap-2 text-xs font-bold">
            <div className="rounded-xl bg-white/15 px-3 py-2">スキマ時間で稼働できる</div>
            <div className="rounded-xl bg-white/15 px-3 py-2">売上はウバログで記録できる</div>
          </div>
        </section>

        <section className="rounded-2xl bg-white p-4 shadow-sm">
          <h2 className="text-lg font-black text-gray-900">はじめての人へ</h2>
          <p className="mt-2 text-sm font-bold leading-6 text-gray-600">
            サービスやエリアによって働き方は変わります。必要なものをそろえて、記録しながら自分に合う形を探していきましょう。
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="px-1 text-lg font-black text-gray-900">サービス別登録</h2>
          {recruitServices.map((item) => (
            <article key={item.id} className="rounded-2xl bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-base font-black text-gray-900">{item.name}</h3>
                  <p className="mt-1 text-sm font-bold text-gray-600">{item.description}</p>
                </div>
                <span className="rounded-full bg-green-50 px-2 py-1 text-[10px] font-black text-green-700">
                  登録案内
                </span>
              </div>
              <div className="mt-3 rounded-xl bg-gray-50 px-3 py-2 text-xs font-bold leading-5 text-gray-600">
                {item.point}
              </div>

              {item.referralCode && item.referralType === "copy" && (
                <div className="mt-3 rounded-xl border border-green-100 bg-green-50 px-3 py-2">
                  <div className="text-[11px] font-bold text-green-700">招待コード</div>
                  <div className="mt-1 flex items-center justify-between gap-3">
                    <div className="text-lg font-black tracking-wide text-gray-900">
                      {item.referralCode}
                    </div>
                    {item.copyButtonLabel && (
                      <button
                        type="button"
                        onClick={() => {
                          void copyReferralCode(item.id, item.referralCode ?? "");
                        }}
                        className="shrink-0 rounded-full bg-white px-3 py-2 text-xs font-black text-green-700 shadow-sm active:scale-[0.98]"
                      >
                        {item.copyButtonLabel}
                      </button>
                    )}
                  </div>
                  {item.note && (
                    <div className="mt-2 text-xs font-bold leading-5 text-green-800">
                      {item.note}
                    </div>
                  )}
                  {copiedServiceId === item.id && (
                    <div className="mt-2 rounded-lg bg-white px-2 py-1 text-xs font-black text-green-700">
                      {item.copiedLabel ?? "コピーしました"}
                    </div>
                  )}
                  {copiedServiceId === item.id && fallbackCode && (
                    <input
                      value={fallbackCode}
                      readOnly
                      className="mt-2 h-9 w-full rounded-lg border border-green-100 bg-white px-2 text-sm font-black text-gray-900 outline-none"
                      aria-label="コピー用招待コード"
                    />
                  )}
                </div>
              )}

              {item.url ? (
                <Link
                  href={item.url}
                  className="mt-3 block rounded-xl bg-green-600 px-4 py-3 text-center text-sm font-black text-white active:scale-[0.99]"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {item.buttonLabel}
                </Link>
              ) : (
                <button
                  type="button"
                  className="mt-3 h-11 w-full rounded-xl border border-green-600 bg-white text-sm font-black text-green-700"
                >
                  {item.buttonLabel}
                </button>
              )}
            </article>
          ))}
        </section>

        <section className="rounded-2xl bg-white p-4 shadow-sm">
          <h2 className="text-lg font-black text-gray-900">配達を始める前に必要なもの</h2>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {preparationItems.map((item) => (
              <div
                key={item}
                className="flex min-h-10 items-center gap-2 rounded-xl bg-gray-50 px-3 py-2 text-xs font-bold text-gray-700"
              >
                <span className="text-green-600">✓</span>
                <span>{item}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl bg-white p-4 shadow-sm">
          <h2 className="text-lg font-black text-gray-900">はじめる前の不安</h2>
          <div className="mt-3 space-y-2">
            {worryItems.map((item) => (
              <details key={item.title} className="rounded-xl bg-gray-50 px-3 py-2">
                <summary className="cursor-pointer text-sm font-black text-gray-800">
                  {item.title}
                </summary>
                <p className="mt-2 text-xs font-bold leading-5 text-gray-600">{item.body}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="rounded-2xl bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-black text-gray-900">登録前チェック</h2>
              <p className="mt-1 text-xs font-bold text-gray-500">準備できたものをチェック</p>
            </div>
            {allChecked && (
              <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-black text-green-700">
                準備OK！
              </span>
            )}
          </div>
          <div className="mt-3 space-y-2">
            {checklistItems.map((item) => (
              <label
                key={item}
                className="flex min-h-11 items-center gap-3 rounded-xl bg-gray-50 px-3 py-2 text-sm font-bold text-gray-700"
              >
                <input
                  type="checkbox"
                  checked={checkedItems.includes(item)}
                  onChange={() => toggleItem(item)}
                  className="h-4 w-4 rounded border-gray-300 text-green-600"
                />
                {item}
              </label>
            ))}
          </div>
        </section>

        <section className="rounded-2xl bg-white p-4 shadow-sm">
          <h2 className="text-lg font-black text-gray-900">登録したら次は記録しよう</h2>
          <p className="mt-2 text-sm font-bold text-gray-600">
            稼働した日は、売上・件数・時間を残すと振り返りやすくなります。
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {nextActions.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className="rounded-xl border border-green-200 px-3 py-3 text-center text-xs font-black text-green-700 active:bg-green-50"
              >
                {item.label}
              </Link>
            ))}
          </div>
        </section>
      </div>

      <BottomMenu />
    </main>
  );
}
