"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { readUbalogRecords } from "@/lib/records";
import {
  getRocketNowStats,
  type RocketNowStats,
} from "@/lib/rocketNowStats";
import { buildRocketNowShareText, openXShare } from "@/lib/share";

function yen(value: number) {
  return `￥${value.toLocaleString()}`;
}

function shortDate(isoDate: string) {
  const [, month, day] = isoDate.split("-");
  return `${Number(month)}/${Number(day)}`;
}

function StatPill({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="min-w-0 rounded-xl bg-white px-3 py-2 shadow-sm ring-1 ring-green-100">
      <div className="text-[10px] font-black text-green-700">{label}</div>
      <div className="mt-0.5 truncate text-base font-black text-gray-950">
        {value}
      </div>
    </div>
  );
}

export default function RocketNowStatsCard() {
  const [stats, setStats] = useState<RocketNowStats | null>(null);

  useEffect(() => {
    const load = () => {
      setStats(getRocketNowStats(readUbalogRecords()));
    };

    const timer = window.setTimeout(load, 0);
    window.addEventListener("focus", load);
    window.addEventListener("storage", load);
    window.addEventListener("ubalog-records-updated", load);
    window.addEventListener("ubalog-rocketnow-bulk-import-history-updated", load);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("focus", load);
      window.removeEventListener("storage", load);
      window.removeEventListener("ubalog-records-updated", load);
      window.removeEventListener(
        "ubalog-rocketnow-bulk-import-history-updated",
        load
      );
    };
  }, []);

  if (!stats?.hasRocketRecords) return null;

  const canShareRocketNow = stats.monthAmount > 0 || stats.monthDeliveries > 0;

  return (
    <section className="mt-4 overflow-hidden rounded-2xl border border-green-100 bg-green-50 p-3 shadow-sm">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-black text-gray-950">ロケナウ成果 🚀</div>
          <div className="mt-0.5 truncate text-[11px] font-bold text-green-700">
            {stats.comment}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {canShareRocketNow && (
            <button
              type="button"
              onClick={() => openXShare(buildRocketNowShareText(stats))}
              className="rounded-full border border-green-200 bg-white px-3 py-1.5 text-[11px] font-black text-green-700 shadow-sm active:bg-green-50"
            >
              シェア
            </button>
          )}
          <Link
            href="/record"
            className="rounded-full bg-green-600 px-3 py-1.5 text-[11px] font-black text-white shadow-sm active:bg-green-700"
          >
            記録する
          </Link>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <StatPill label="今日" value={yen(stats.todayAmount)} />
        <StatPill label="今週" value={yen(stats.weekAmount)} />
      </div>

      <div className="mt-2 rounded-xl bg-white px-3 py-2 shadow-sm ring-1 ring-green-100">
        <div className="flex min-w-0 items-center justify-between gap-2">
          <div className="text-[10px] font-black text-green-700">今月</div>
          <div className="min-w-0 truncate text-sm font-black text-gray-950">
            {yen(stats.monthAmount)} / {stats.monthDeliveries.toLocaleString()}件
          </div>
        </div>
        <div className="mt-1 flex min-w-0 items-center justify-between gap-2 text-[11px] font-bold text-gray-600">
          <span>1件単価</span>
          <span className="truncate">
            {stats.monthUnitPrice === null ? "-" : yen(stats.monthUnitPrice)}
          </span>
        </div>
      </div>

      {(stats.monthBestDay || stats.latestBulkImportedCount) && (
        <div className="mt-2 flex flex-wrap gap-2 text-[11px] font-bold">
          {stats.monthBestDay && (
            <div className="min-w-0 flex-1 rounded-xl bg-white px-3 py-2 text-gray-700 shadow-sm ring-1 ring-green-100">
              <div className="text-[10px] font-black text-gray-500">今月ベスト</div>
              <div className="mt-0.5 truncate text-gray-950">
                {shortDate(stats.monthBestDay.date)} {yen(stats.monthBestDay.amount)} /{" "}
                {stats.monthBestDay.deliveries.toLocaleString()}件
              </div>
            </div>
          )}

          {stats.latestBulkImportedCount && (
            <div className="rounded-xl bg-white px-3 py-2 text-green-700 shadow-sm ring-1 ring-green-100">
              一気読み反映 {stats.latestBulkImportedCount.toLocaleString()}日分
            </div>
          )}
        </div>
      )}
    </section>
  );
}
