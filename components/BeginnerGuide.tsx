"use client";

import Link from "next/link";
import { useState } from "react";

export const BEGINNER_GUIDE_CLOSED_KEY = "ubalog-beginner-guide-closed";

const steps = [
  {
    title: "記録する",
    body: "今日の売上・件数・稼働時間を入力します。",
    icon: "📝",
  },
  {
    title: "ランキングを見る",
    body: "売上・時給・件数・単価ランキングを確認できます。",
    icon: "🏆",
  },
  {
    title: "リアルタイム共有を見る",
    body: "高単価案件やエリアの目安をみんなで共有できます。",
    icon: "📡",
  },
  {
    title: "ホーム画面に追加",
    body: "スマホのホーム画面に置くと、アプリみたいにすぐ開けます。",
    icon: "📱",
  },
];

export default function BeginnerGuide() {
  const [closed, setClosed] = useState(() => {
    if (typeof window === "undefined") return true;
    return localStorage.getItem(BEGINNER_GUIDE_CLOSED_KEY) === "true";
  });
  const [open, setOpen] = useState(false);

  if (closed) return null;

  const closeGuide = () => {
    localStorage.setItem(BEGINNER_GUIDE_CLOSED_KEY, "true");
    setClosed(true);
    setOpen(false);
  };

  return (
    <section className="mt-4 overflow-hidden rounded-2xl border border-green-100 bg-white p-4 shadow-sm">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-base font-black text-gray-900">
            はじめてのウバログ 🚀
          </div>
          <p className="mt-1 text-sm font-bold leading-6 text-gray-600">
            まずは今日の売上を記録して、ランキングやリアルタイム共有を見てみましょう。
          </p>
        </div>
        <button
          type="button"
          onClick={closeGuide}
          className="shrink-0 rounded-full bg-gray-100 px-3 py-1.5 text-xs font-black text-gray-600 active:bg-gray-200"
        >
          閉じる
        </button>
      </div>

      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="mt-3 h-10 w-full rounded-xl bg-green-600 text-sm font-black text-white active:bg-green-700"
      >
        {open ? "使い方を閉じる" : "使い方を見る"}
      </button>

      {open && (
        <div className="mt-3 space-y-3">
          <div className="grid gap-2">
            {steps.map((step, index) => (
              <div key={step.title} className="rounded-2xl bg-green-50 px-3 py-3">
                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-base">
                    {step.icon}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-black text-green-900">
                      {index + 1}. {step.title}
                    </div>
                    <div className="mt-1 text-xs font-bold leading-5 text-green-800">
                      {step.body}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Link
              href="/record"
              className="rounded-xl bg-green-600 px-3 py-2.5 text-center text-xs font-black text-white active:bg-green-700"
            >
              記録する
            </Link>
            <Link
              href="/ranking"
              className="rounded-xl border border-green-200 bg-green-50 px-3 py-2.5 text-center text-xs font-black text-green-700 active:bg-green-100"
            >
              ランキングを見る
            </Link>
            <Link
              href="/realtime"
              className="col-span-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-center text-xs font-black text-gray-700 active:bg-gray-100"
            >
              リアルタイム共有を見る
            </Link>
          </div>
        </div>
      )}
    </section>
  );
}
