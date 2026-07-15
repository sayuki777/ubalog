"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import AppHeader from "@/components/AppHeader";
import BottomMenu from "@/components/BottomMenu";
import { recruitServices } from "@/lib/recruit";

const CHECKLIST_STORAGE_KEY = "ubalog-recruit-checklist";

const checklistItems = [
  "稼働できる曜日や時間を決める",
  "本人確認書類を準備する",
  "配達バッグやスマホホルダーを用意する",
  "安全に停まって確認できる場所を意識する",
  "売上をウバログに記録する準備をする",
];

const startSteps = [
  "配達サービスに登録する",
  "審査・必要書類を準備する",
  "配達バッグやスマホホルダーを用意する",
  "初日は短時間から始める",
  "ウバログで売上を記録する",
];

const nextActions = [
  { href: "/record", label: "記録タブへ" },
  { href: "/", label: "マイページへ" },
  { href: "/ranking", label: "ランキングを見る" },
  { href: "/realtime", label: "共有を見る" },
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
    <main className="mx-auto min-h-screen w-full max-w-[430px] overflow-x-hidden bg-gray-50 pb-24">
      <AppHeader title="配達員募集" />

      <div className="space-y-4 px-4 pb-[calc(8rem+env(safe-area-inset-bottom))] pt-4">
        <section className="rounded-2xl bg-white p-4 shadow-sm">
          <p className="text-xs font-black text-green-700">これから始める方向け</p>
          <h1 className="mt-1 text-2xl font-black tracking-tight text-gray-900">
            フードデリバリーを始めるなら
          </h1>
          <p className="mt-3 text-sm font-bold leading-6 text-gray-600">
            Uber Eats・ロケットナウ・menu・出前館など、配達を始めたい人向けに登録リンクをまとめています。
            まずは自分のエリアで使いやすいサービスから始めてみましょう。
          </p>
          <div className="mt-3 rounded-2xl bg-amber-50 px-3 py-3 text-xs font-bold leading-5 text-amber-800">
            収益はエリア・時間帯・稼働方法によって変わります。無理のない範囲で安全に稼働してください。
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="px-1 text-lg font-black text-gray-900">サービス別登録リンク</h2>
          {recruitServices.map((item) => (
            <article key={item.id} className="rounded-2xl bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-base font-black text-gray-900">{item.name}</h3>
                  <p className="mt-1 text-sm font-bold leading-6 text-gray-600">
                    {item.description}
                  </p>
                </div>
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

              <a
                href={item.url}
                className="mt-3 block rounded-xl bg-green-600 px-4 py-3 text-center text-sm font-black text-white active:scale-[0.99]"
                target="_blank"
                rel="noopener noreferrer"
              >
                {item.buttonLabel}
              </a>
            </article>
          ))}
        </section>

        <section className="rounded-2xl bg-white p-4 shadow-sm">
          <h2 className="text-lg font-black text-gray-900">はじめ方の流れ</h2>
          <div className="mt-3 space-y-2">
            {startSteps.map((item, index) => (
              <div
                key={item}
                className="flex gap-3 rounded-2xl bg-gray-50 px-3 py-3 text-sm font-bold text-gray-700"
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-green-600 text-xs font-black text-white">
                  {index + 1}
                </span>
                <span className="min-w-0 leading-6">{item}</span>
              </div>
            ))}
          </div>
          <p className="mt-3 rounded-2xl bg-blue-50 px-3 py-3 text-xs font-bold leading-5 text-blue-800">
            運転中のスマホ操作は避け、安全な場所に停まって確認しましょう。
          </p>
        </section>

        <section className="rounded-2xl bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-black text-gray-900">登録前チェック</h2>
              <p className="mt-1 text-xs font-bold text-gray-500">
                準備できたものをチェックできます
              </p>
            </div>
            {allChecked && (
              <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-black text-green-700">
                準備OK
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
                <span className="min-w-0 break-words">{item}</span>
              </label>
            ))}
          </div>
        </section>

        <section className="rounded-2xl bg-white p-4 shadow-sm">
          <h2 className="text-lg font-black text-gray-900">始めたら記録してみよう</h2>
          <p className="mt-2 text-sm font-bold leading-6 text-gray-600">
            初日の売上や件数を残しておくと、自分に合う時間帯を振り返りやすくなります。
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
