"use client";

import { useRef, useState } from "react";
import {
  downloadUbalogBackup,
  getUbalogBackupSummary,
  restoreUbalogBackup,
  validateUbalogBackup,
  type UbalogBackupData,
  type UbalogBackupSummary,
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
  const [pendingSummary, setPendingSummary] = useState<UbalogBackupSummary | null>(null);
  const [message, setMessage] = useState("");
  const [notice, setNotice] = useState("");
  const [restored, setRestored] = useState(false);

  const clearStatus = () => {
    setMessage("");
    setNotice("");
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
    setPendingSummary(null);
    if (!file) return;

    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as unknown;

      if (!validateUbalogBackup(parsed)) {
        setNotice("バックアップファイルを読み込めませんでした");
        return;
      }

      setPendingBackup(parsed);
      setPendingSummary(getUbalogBackupSummary(parsed));
    } catch {
      setNotice("バックアップファイルを読み込めませんでした");
    }
  };

  const handleRestore = () => {
    if (!pendingBackup) return;

    restoreUbalogBackup(pendingBackup);
    setPendingBackup(null);
    setPendingSummary(null);
    setRestored(true);
    setMessage("読み込みました");
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
        <h2 className="text-lg font-black text-gray-900">
          データのバックアップ・引き継ぎ
        </h2>
        <p className="mt-2 text-sm font-bold leading-6 text-gray-600">
          ログインなしでも使えますが、端末やブラウザを変えると端末内の記録が見えなくなる場合があります。
          大事な記録はバックアップしておくと安心です。
        </p>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3">
        <button
          type="button"
          onClick={handleDownload}
          className="h-12 rounded-xl bg-green-600 px-4 text-sm font-black text-white shadow-sm active:scale-[0.99]"
        >
          バックアップを書き出す
        </button>

        <button
          type="button"
          onClick={() => {
            clearStatus();
            fileInputRef.current?.click();
          }}
          className="h-12 rounded-xl border border-green-600 bg-white px-4 text-sm font-black text-green-700 active:bg-green-50"
        >
          バックアップを読み込む
        </button>
      </div>

      <div className="mt-4 rounded-2xl bg-gray-50 p-3">
        <div className="text-xs font-black text-gray-700">バックアップのメモ</div>
        <ul className="mt-2 space-y-1 text-xs font-bold leading-5 text-gray-500">
          <li>バックアップファイルには記録やプロフィール情報が含まれます</li>
          <li>他人に共有しないでください</li>
          <li>機種変更前に保存しておくと安心です</li>
        </ul>
      </div>

      {pendingBackup && pendingSummary && (
        <div className="mt-4 rounded-2xl border border-green-100 bg-green-50 p-3">
          <div className="text-sm font-black text-gray-900">
            読み込むと、この端末のウバログデータに上書き・追加されます。よろしいですか？
          </div>
          <p className="mt-2 text-xs font-bold leading-5 text-gray-600">
            記録とリアルタイム共有は、できるだけ重複しないようにまとめます。
            プロフィールなどはファイルの内容で更新されます。
          </p>

          <div className="mt-3 grid grid-cols-2 gap-2 text-xs font-bold text-gray-700">
            <div className="rounded-xl bg-white px-3 py-2">
              記録: {pendingSummary.recordCount}件
            </div>
            <div className="rounded-xl bg-white px-3 py-2">
              共有: {pendingSummary.realtimeOfferCount}件
            </div>
            <div className="rounded-xl bg-white px-3 py-2">
              データ: {pendingSummary.keyCount}種類
            </div>
            <div className="rounded-xl bg-white px-3 py-2">
              日時: {formatExportedAt(pendingSummary.exportedAt)}
            </div>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                setPendingBackup(null);
                setPendingSummary(null);
              }}
              className="h-11 rounded-xl border border-gray-200 bg-white text-sm font-black text-gray-600 active:bg-gray-50"
            >
              やめる
            </button>
            <button
              type="button"
              onClick={handleRestore}
              className="h-11 rounded-xl bg-green-600 text-sm font-black text-white shadow-sm active:scale-[0.99]"
            >
              読み込む
            </button>
          </div>
        </div>
      )}

      {message && (
        <div className="mt-3 rounded-xl bg-green-50 px-3 py-2 text-sm font-black text-green-700">
          {message}
        </div>
      )}

      {notice && (
        <div className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-sm font-black text-amber-700">
          {notice}
        </div>
      )}

      {restored && (
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-3 h-11 w-full rounded-xl border border-green-600 bg-white text-sm font-black text-green-700 active:bg-green-50"
        >
          画面を更新する
        </button>
      )}
    </section>
  );
}
