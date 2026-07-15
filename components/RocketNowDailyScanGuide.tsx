"use client";

import { useState } from "react";

const GUIDE_OPEN_KEY = "ubalog-rocketnow-guide-open";

export default function RocketNowDailyScanGuide() {
  const [open, setOpen] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(GUIDE_OPEN_KEY) === "true";
  });

  const toggleOpen = () => {
    const next = !open;
    setOpen(next);
    localStorage.setItem(GUIDE_OPEN_KEY, String(next));
  };

  return (
    <section className="overflow-hidden rounded-2xl border border-green-100 bg-white shadow-sm">
      <button
        type="button"
        onClick={toggleOpen}
        className="flex w-full min-w-0 items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <div className="min-w-0">
          <div className="text-base font-black text-green-900">
            ロケナウ一気読みとは？ 🚀
          </div>
          <div className="mt-0.5 text-xs font-bold text-green-700">
            スクショでRocket入力をラクに
          </div>
        </div>
        <span className="shrink-0 rounded-full bg-green-50 px-2 py-1 text-xs font-black text-green-700">
          {open ? "閉じる" : "見る"}
        </span>
      </button>

      {open && (
        <div className="border-t border-green-50 px-4 py-3">
          <p className="text-xs font-bold leading-5 text-gray-600">
            ロケナウのMY収入スクショを選ぶだけで、日付ごとの売上と配達件数をまとめて読み取れます。
            確認してから反映できるので、数日分の入力を一気に進められます。
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] font-bold text-gray-700">
            {[
              "1日ずつ入力する手間を減らせます",
              "金額と配達件数をまとめて確認できます",
              "読み取り後に補正してから反映できます",
              "他社の記録はそのまま残ります",
            ].map((item) => (
              <div key={item} className="rounded-xl bg-gray-50 px-3 py-2">
                {item}
              </div>
            ))}
          </div>
          <div className="mt-3 rounded-xl bg-green-50 px-3 py-2 text-[11px] font-bold leading-5 text-green-800">
            使い方: Rocket行の「一気読み」を押して、MY収入スクショを選びます。
          </div>
        </div>
      )}
    </section>
  );
}
