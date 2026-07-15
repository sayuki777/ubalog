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
            ロケナウスキャンとは？ 📷
          </div>
          <div className="mt-0.5 text-xs font-bold text-green-700">
            MY収入スクショからRocket欄へ反映できます
          </div>
        </div>
        <span className="shrink-0 rounded-full bg-green-50 px-2 py-1 text-xs font-black text-green-700">
          {open ? "閉じる" : "見る"}
        </span>
      </button>

      {open && (
        <div className="border-t border-green-50 px-4 py-3">
          <p className="text-xs font-bold leading-5 text-gray-600">
            ロケナウのMY収入スクショを選ぶと、選択中の日付に近い売上と配達件数を読み取ります。
            読み取り後に金額や件数を確認してから保存してください。
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] font-bold text-gray-700">
            {[
              "1枚でも複数枚でも確認できます",
              "日付に合う行を優先します",
              "金額と件数をあとから直せます",
              "ほかの会社の入力はそのまま残ります",
            ].map((item) => (
              <div key={item} className="rounded-xl bg-gray-50 px-3 py-2">
                {item}
              </div>
            ))}
          </div>
          <div className="mt-3 rounded-xl bg-green-50 px-3 py-2 text-[11px] font-bold leading-5 text-green-800">
            使い方: Rocket行のカメラを押して、MY収入スクショを選びます。
          </div>
        </div>
      )}
    </section>
  );
}
