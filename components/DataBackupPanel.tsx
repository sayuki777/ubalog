"use client";

import { useRef, useState } from "react";
import {
  downloadUbalogBackup,
  restoreUbalogBackup,
  validateUbalogBackup,
  type UbalogBackupData,
} from "@/lib/backup";

function formatExportedAt(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;

  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export default function DataBackupPanel() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [pendingBackup, setPendingBackup] = useState<UbalogBackupData | null>(null);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [restored, setRestored] = useState(false);

  const clearStatus = () => {
    setMessage("");
    setErrorMessage("");
    setRestored(false);
  };

  const handleDownload = () => {
    clearStatus();
    downloadUbalogBackup();
    setMessage("バックアップを書き出しました");
  };

  const handleFileSelect = async (file: File | undefined) => {
    clearStatus();
    setPendingBackup(null);
    if (!file) return;

    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as unknown;

      if (!validateUbalogBackup(parsed)) {
        setErrorMessage("バックアップファイルを確認してください");
        return;
      }

      setPendingBackup(parsed);
    } catch (error) {
      console.error("Failed to read backup file", error);
      setErrorMessage("バックアップファイルを確認してください");
    }
  };

  const handleRestore = () => {
    if (!pendingBackup) return;

    restoreUbalogBackup(pendingBackup);
    setPendingBackup(null);
    setRestored(true);
    setMessage("復元しました。画面を更新してください");
  };

  return (
    <section className="mt-4 rounded-2xl bg-white p-4 shadow-sm">
      <input
        ref={fileInputRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(event) => {
          void handleFileSelect(event.target.files?.[0]);
          event.target.value = "";
        }}
      />

      <div>
        <h2 className="text-lg font-bold text-gray-900">データのバックアップ</h2>
        <p className="mt-1 text-sm text-gray-500">
          記録・目標・ニュースなどを保存できます
        </p>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3">
        <button
          type="button"
          onClick={handleDownload}
          className="h-12 rounded-xl bg-green-600 px-4 text-sm font-bold text-white shadow-sm active:scale-[0.99]"
        >
          バックアップを作成
        </button>

        <button
          type="button"
          onClick={() => {
            clearStatus();
            fileInputRef.current?.click();
          }}
          className="h-12 rounded-xl border border-green-600 bg-white px-4 text-sm font-bold text-green-700 active:bg-green-50"
        >
          バックアップを復元
        </button>
      </div>

      {pendingBackup && (
        <div className="mt-4 rounded-2xl border border-green-100 bg-green-50 p-3">
          <div className="text-sm font-bold text-gray-900">
            このバックアップを復元しますか？
          </div>
          <p className="mt-1 text-xs font-bold text-gray-600">
            ウバログの保存データを、選んだファイルの内容に置き換えます
          </p>

          <div className="mt-3 grid grid-cols-2 gap-2 text-xs font-bold text-gray-700">
            <div className="rounded-xl bg-white px-3 py-2">
              記録件数: {pendingBackup.records.length}件
            </div>
            <div className="rounded-xl bg-white px-3 py-2">
              ユーザー数: {pendingBackup.users.length}件
            </div>
            <div className="rounded-xl bg-white px-3 py-2">
              目標: {pendingBackup.goals?.length ?? 0}件
            </div>
            <div className="rounded-xl bg-white px-3 py-2">
              ニュース: {pendingBackup.news?.length ?? 0}件
            </div>
            <div className="rounded-xl bg-white px-3 py-2">
              リアルタイム共有: {pendingBackup.realtimeOffers.length}件
            </div>
            <div className="rounded-xl bg-white px-3 py-2">
              書き出し日時: {formatExportedAt(pendingBackup.exportedAt)}
            </div>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setPendingBackup(null)}
              className="h-11 rounded-xl border border-gray-200 bg-white text-sm font-bold text-gray-600 active:bg-gray-50"
            >
              キャンセル
            </button>
            <button
              type="button"
              onClick={handleRestore}
              className="h-11 rounded-xl bg-green-600 text-sm font-bold text-white shadow-sm active:scale-[0.99]"
            >
              復元する
            </button>
          </div>
        </div>
      )}

      {message && (
        <div className="mt-3 rounded-xl bg-green-50 px-3 py-2 text-sm font-bold text-green-700">
          {message}
        </div>
      )}

      {errorMessage && (
        <div className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-sm font-bold text-amber-700">
          {errorMessage}
        </div>
      )}

      {restored && (
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-3 h-11 w-full rounded-xl border border-green-600 bg-white text-sm font-bold text-green-700 active:bg-green-50"
        >
          画面を更新
        </button>
      )}
    </section>
  );
}
