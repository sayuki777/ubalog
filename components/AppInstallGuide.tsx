"use client";

import { useState } from "react";

const STORAGE_KEY = "ubalog-app-install-guide-open";

export default function AppInstallGuide() {
  const [open, setOpen] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(STORAGE_KEY) === "true";
  });

  const toggleOpen = () => {
    const next = !open;
    setOpen(next);
    localStorage.setItem(STORAGE_KEY, String(next));
  };

  return (
    <section className="mt-4 overflow-hidden rounded-2xl border border-green-100 bg-white p-4 shadow-sm">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-black text-gray-900">
            ホーム画面に追加しよう 📱
          </div>
          <p className="mt-1 text-xs font-bold leading-5 text-gray-500">
            ウバログをホーム画面に置くと、アプリみたいにすぐ開けます。
            記録もランキング確認もラクになります。
          </p>
        </div>
        <button
          type="button"
          onClick={toggleOpen}
          className="shrink-0 rounded-full border border-green-200 bg-green-50 px-3 py-2 text-xs font-black text-green-700 active:bg-green-100"
        >
          {open ? "閉じる" : "追加方法を見る"}
        </button>
      </div>

      {open && (
        <div className="mt-3 grid gap-2 text-xs font-bold leading-5 text-gray-700">
          <GuideSteps
            title="iPhoneの場合"
            steps={[
              "Safariでウバログを開く",
              "共有ボタンを押す",
              "ホーム画面に追加を選ぶ",
              "追加を押す",
            ]}
          />
          <GuideSteps
            title="Androidの場合"
            steps={[
              "Chromeでウバログを開く",
              "右上メニューを押す",
              "ホーム画面に追加を選ぶ",
              "追加を押す",
            ]}
          />
        </div>
      )}
    </section>
  );
}

function GuideSteps({ title, steps }: { title: string; steps: string[] }) {
  return (
    <div className="rounded-2xl bg-green-50 px-3 py-3">
      <div className="text-sm font-black text-green-800">{title}</div>
      <ol className="mt-2 space-y-1">
        {steps.map((step, index) => (
          <li key={step} className="flex gap-2">
            <span className="shrink-0 text-green-700">{index + 1}.</span>
            <span className="min-w-0 break-words">{step}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
