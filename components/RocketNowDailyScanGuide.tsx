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
            ロケナウスクショ読取 ✨
          </div>
          <div className="mt-0.5 text-xs font-bold text-green-700">
            1日分をサクッと入力
          </div>
        </div>
        <span className="shrink-0 rounded-full bg-green-50 px-2 py-1 text-xs font-black text-green-700">
          {open ? "閉じる" : "開く"}
        </span>
      </button>

      {open && (
        <div className="border-t border-green-50 px-4 py-3">
          <div className="grid grid-cols-2 gap-2 text-[11px] font-bold text-gray-700">
            {["日付を選ぶ", "カメラを押す", "スクショを選ぶ", "金額と件数が入ります"].map(
              (item, index) => (
                <div key={item} className="rounded-xl bg-gray-50 px-3 py-2">
                  <span className="mr-1 text-green-700">{index + 1}.</span>
                  {item}
                </div>
              )
            )}
          </div>
          <div className="mt-2 text-[11px] font-bold text-gray-500">
            調整内訳がある日は、金額に足して反映します。
          </div>
        </div>
      )}
    </section>
  );
}
