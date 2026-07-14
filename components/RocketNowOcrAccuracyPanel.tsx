"use client";

import { useCallback, useEffect, useState } from "react";
import {
  clearRocketNowFeedbacks,
  readRocketNowFeedbackEntries,
  ROCKETNOW_FEEDBACK_UPDATED_EVENT,
  type RocketNowFeedbackEntry,
} from "@/lib/rocketNowOcrFeedback";

const ACCURACY_OPEN_KEY = "ubalog-rocketnow-accuracy-panel-open";

export default function RocketNowOcrAccuracyPanel() {
  const [open, setOpen] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(ACCURACY_OPEN_KEY) === "true";
  });
  const [confirmingClear, setConfirmingClear] = useState(false);
  const [copyMessage, setCopyMessage] = useState("");
  const [fallbackText, setFallbackText] = useState("");
  const [version, setVersion] = useState(0);

  const entries = readRocketNowFeedbackEntries();
  const recent = entries.slice(0, 5);
  const meterEntries = entries.slice(0, 10);
  const okCount = meterEntries.filter(isFeedbackOk).length;

  const refresh = useCallback(() => setVersion((value) => value + 1), []);
  void version;

  useEffect(() => {
    window.addEventListener(ROCKETNOW_FEEDBACK_UPDATED_EVENT, refresh);
    return () => window.removeEventListener(ROCKETNOW_FEEDBACK_UPDATED_EVENT, refresh);
  }, [refresh]);

  const copyLogs = async () => {
    const text = buildCopyText(entries.slice(0, 10));
    setFallbackText("");
    setCopyMessage("");

    if (navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(text);
        setCopyMessage("コピーしました");
        return;
      } catch {
        // Fall through to the visible copy text.
      }
    }

    setFallbackText(text);
    setCopyMessage("下のテキストをコピーしてください");
  };

  const clearLogs = () => {
    clearRocketNowFeedbacks();
    setConfirmingClear(false);
    setCopyMessage("整理しました");
    refresh();
  };

  const toggleOpen = () => {
    const next = !open;
    setOpen(next);
    localStorage.setItem(ACCURACY_OPEN_KEY, String(next));
  };

  return (
    <section className="min-w-0 overflow-hidden rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
      <button
        type="button"
        onClick={toggleOpen}
        className="flex w-full min-w-0 items-center justify-between gap-3 text-left"
      >
        <div className="min-w-0">
          <div className="text-base font-black text-gray-900">読取チェック 🔍</div>
          <div className="mt-1 text-xs font-bold text-gray-500">
            読み取り結果を確認
          </div>
        </div>
        <span className="shrink-0 rounded-full bg-gray-100 px-2 py-1 text-xs font-black text-gray-600">
          {open ? "閉じる" : "見る"}
        </span>
      </button>

      {open && (
        <div className="mt-3 min-w-0 space-y-3">
          {meterEntries.length > 0 && (
            <div className="rounded-xl bg-green-50 px-3 py-2 text-xs font-black text-green-800">
              最近の読取OK {okCount}/{meterEntries.length}
              <span className="ml-1 font-bold">だんだん賢くなってます 🚀</span>
            </div>
          )}

          <div className="space-y-2">
            {recent.length > 0 ? (
              recent.map((entry) => <FeedbackCard key={entry.id} entry={entry} />)
            ) : (
              <div className="rounded-xl bg-gray-50 px-3 py-3 text-xs font-bold text-gray-500">
                まだ補正ログはありません
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => void copyLogs()}
              disabled={entries.length === 0}
              className="h-10 rounded-xl bg-green-600 px-2 text-xs font-black text-white disabled:bg-gray-300"
            >
              読取ログをコピー
            </button>
            <button
              type="button"
              onClick={() => setConfirmingClear(true)}
              disabled={entries.length === 0}
              className="h-10 rounded-xl bg-gray-100 px-2 text-xs font-black text-gray-700 disabled:text-gray-300"
            >
              ログを整理
            </button>
          </div>

          {copyMessage && (
            <div className="text-xs font-bold text-green-700">{copyMessage}</div>
          )}

          {fallbackText && (
            <textarea
              readOnly
              value={fallbackText}
              className="h-36 w-full resize-none rounded-xl border border-gray-200 bg-gray-50 p-2 text-xs text-gray-700"
            />
          )}

          {confirmingClear && (
            <div className="rounded-xl bg-red-50 p-3">
              <div className="text-xs font-bold text-red-700">
                読取チェックのログだけ整理します
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={clearLogs}
                  className="h-9 rounded-lg bg-red-600 text-xs font-black text-white"
                >
                  整理する
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmingClear(false)}
                  className="h-9 rounded-lg bg-white text-xs font-black text-gray-700"
                >
                  やめる
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function FeedbackCard({ entry }: { entry: RocketNowFeedbackEntry }) {
  return (
    <div className="min-w-0 rounded-xl bg-gray-50 px-3 py-2">
      <div className="flex min-w-0 flex-wrap items-center gap-1.5">
        <span className="text-sm font-black text-gray-900">{formatShortDate(entry.date)}</span>
        <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-gray-600 ring-1 ring-gray-200">
          {entry.source === "single" ? "単日読取" : "一気読み"}
        </span>
        <CorrectionBadge entry={entry} />
      </div>
      <div className="mt-1 text-[11px] font-bold leading-5 text-gray-600">
        <div className="break-words">
          OCR {formatNullableCurrency(entry.ocrAmount)} → 補正{" "}
          {formatCurrency(entry.correctedAmount)}
        </div>
        <div>
          件数 {formatNullableCount(entry.ocrDeliveries)} →{" "}
          {entry.correctedDeliveries.toLocaleString()}件
        </div>
        <div className="text-gray-400">{formatReadTime(entry.createdAt)}</div>
      </div>
    </div>
  );
}

function CorrectionBadge({ entry }: { entry: RocketNowFeedbackEntry }) {
  const amountChanged = entry.ocrAmount !== entry.correctedAmount;
  const deliveriesChanged = entry.ocrDeliveries !== entry.correctedDeliveries;
  const label =
    amountChanged && deliveriesChanged
      ? "金額・件数補正"
      : amountChanged
      ? "金額補正"
      : deliveriesChanged
      ? "件数補正"
      : "OK";

  return (
    <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-bold text-green-700">
      {label}
    </span>
  );
}

function isFeedbackOk(entry: RocketNowFeedbackEntry) {
  return (
    entry.ocrAmount === entry.correctedAmount &&
    entry.ocrDeliveries === entry.correctedDeliveries
  );
}

function buildCopyText(entries: RocketNowFeedbackEntry[]) {
  return [
    "ロケナウ読取チェック",
    "",
    ...entries.flatMap((entry) => [
      `${formatShortDate(entry.date)} ${entry.source === "single" ? "単日" : "一気読み"}`,
      `OCR金額: ${entry.ocrAmount ?? "-"}`,
      `補正金額: ${entry.correctedAmount}`,
      `OCR件数: ${entry.ocrDeliveries ?? "-"}`,
      `補正件数: ${entry.correctedDeliveries}`,
      "",
    ]),
  ].join("\n");
}

function formatCurrency(amount: number) {
  return `￥${amount.toLocaleString()}`;
}

function formatNullableCurrency(amount: number | null) {
  return typeof amount === "number" ? formatCurrency(amount) : "-";
}

function formatNullableCount(count: number | null) {
  return typeof count === "number" ? `${count.toLocaleString()}件` : "-";
}

function formatShortDate(date: string) {
  const [, month, day] = date.split("-").map(Number);
  return `${String(month).padStart(2, "0")}/${String(day).padStart(2, "0")}`;
}

function formatReadTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${String(date.getMonth() + 1).padStart(2, "0")}/${String(
    date.getDate()
  ).padStart(2, "0")} ${String(date.getHours()).padStart(2, "0")}:${String(
    date.getMinutes()
  ).padStart(2, "0")}`;
}
