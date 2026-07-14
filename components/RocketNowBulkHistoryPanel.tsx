"use client";

import { useCallback, useEffect, useState } from "react";
import {
  readRocketNowBulkImportHistory,
  restoreLatestRocketNowBulkImport,
  ROCKETNOW_BULK_IMPORT_HISTORY_UPDATED_EVENT,
  type RocketNowBulkImportHistory,
} from "@/lib/rocketNowBulkImport";

const HISTORY_OPEN_KEY = "ubalog-rocketnow-history-panel-open";

export default function RocketNowBulkHistoryPanel({
  selectedDate,
  onCurrentDateRestored,
}: {
  selectedDate: string;
  onCurrentDateRestored: (value: { amount: number; deliveries: number }) => void;
}) {
  const [open, setOpen] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(HISTORY_OPEN_KEY) === "true";
  });
  const [history, setHistory] = useState<RocketNowBulkImportHistory[]>(() =>
    readRocketNowBulkImportHistory()
  );
  const [confirmingUndo, setConfirmingUndo] = useState(false);
  const [message, setMessage] = useState("");

  const refresh = useCallback(() => {
    setHistory(readRocketNowBulkImportHistory());
  }, []);

  useEffect(() => {
    window.addEventListener(ROCKETNOW_BULK_IMPORT_HISTORY_UPDATED_EVENT, refresh);
    return () =>
      window.removeEventListener(ROCKETNOW_BULK_IMPORT_HISTORY_UPDATED_EVENT, refresh);
  }, [refresh]);

  const toggleOpen = () => {
    const next = !open;
    setOpen(next);
    localStorage.setItem(HISTORY_OPEN_KEY, String(next));
  };

  const handleUndo = () => {
    const restored = restoreLatestRocketNowBulkImport();
    refresh();
    setConfirmingUndo(false);
    if (!restored.history) return;

    const current = restored.records.find((record) => record.date === selectedDate);
    const affectedCurrent = restored.history.items.some(
      (item) => item.date === selectedDate
    );
    if (affectedCurrent) {
      onCurrentDateRestored({
        amount: current?.services.rocket.amount ?? 0,
        deliveries: current?.services.rocket.deliveries ?? 0,
      });
    }
    setMessage("直前の一気読みを戻しました");
  };

  return (
    <section className="min-w-0 overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
      <button
        type="button"
        onClick={toggleOpen}
        className="flex w-full min-w-0 items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <div className="min-w-0">
          <div className="text-base font-black text-gray-900">最近の一気読み 🧾</div>
          <div className="mt-0.5 text-xs font-bold text-gray-500">
            直前の反映を戻せます
          </div>
        </div>
        <span className="shrink-0 rounded-full bg-gray-100 px-2 py-1 text-xs font-black text-gray-600">
          {open ? "閉じる" : "開く"}
        </span>
      </button>

      {open && (
        <div className="border-t border-gray-50 px-4 py-3">
          {history.length > 0 ? (
            <>
              <div className="space-y-1 text-[11px] font-bold text-gray-600">
                {history.slice(0, 3).map((item) => (
                  <div key={item.id} className="break-words">
                    {formatHistoryDate(item.createdAt)} {item.importedCount}日分{" "}
                    {formatCurrency(item.totalAmount)} / {item.totalDeliveries}件
                  </div>
                ))}
              </div>
              {!confirmingUndo ? (
                <button
                  type="button"
                  onClick={() => setConfirmingUndo(true)}
                  className="mt-2 h-9 w-full rounded-lg border border-green-200 bg-white text-xs font-black text-green-700 active:bg-green-50"
                >
                  直前の一気読みを戻す
                </button>
              ) : (
                <div className="mt-2 rounded-lg bg-gray-50 p-2">
                  <div className="text-[11px] font-bold text-gray-700">
                    直前に反映したRocketデータを戻します
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={handleUndo}
                      className="h-9 rounded-lg bg-green-600 text-xs font-black text-white"
                    >
                      戻す
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmingUndo(false)}
                      className="h-9 rounded-lg bg-white text-xs font-black text-gray-700"
                    >
                      やめる
                    </button>
                  </div>
                </div>
              )}
              {message && (
                <div className="mt-2 text-xs font-bold text-green-700">{message}</div>
              )}
            </>
          ) : (
            <div className="text-xs font-bold text-gray-500">まだ履歴はありません</div>
          )}
        </div>
      )}
    </section>
  );
}

function formatCurrency(amount: number) {
  return `￥${amount.toLocaleString()}`;
}

function formatHistoryDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${String(date.getMonth() + 1).padStart(2, "0")}/${String(
    date.getDate()
  ).padStart(2, "0")}`;
}
