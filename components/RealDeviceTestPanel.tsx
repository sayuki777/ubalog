"use client";

import { useEffect, useState } from "react";
import {
  buildRealDeviceTestReport,
  loadStorageBoolean,
  loadStorageText,
  loadStringArray,
  normalizePublicUrl,
  PUBLIC_URL_STORAGE_KEY,
  REAL_DEVICE_TEST_CHECKLIST_KEY,
  REAL_DEVICE_TEST_NOTES_KEY,
  REAL_DEVICE_TEST_OPEN_KEY,
  realDeviceTestItems,
  saveStorageBoolean,
  saveStorageText,
  saveStringArray,
} from "@/lib/testChecklist";

export default function RealDeviceTestPanel() {
  const [checkedItems, setCheckedItems] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [publicUrl, setPublicUrl] = useState("");
  const [fallbackText, setFallbackText] = useState("");
  const [copyMessage, setCopyMessage] = useState("");
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [isOpen, setIsOpen] = useState(true);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setCheckedItems(loadStringArray(REAL_DEVICE_TEST_CHECKLIST_KEY));
      setNotes(loadStorageText(REAL_DEVICE_TEST_NOTES_KEY));
      setPublicUrl(loadStorageText(PUBLIC_URL_STORAGE_KEY));
      setIsOpen(loadStorageBoolean(REAL_DEVICE_TEST_OPEN_KEY, true));
      setLoaded(true);
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  const toggleOpen = () => {
    setIsOpen((current) => {
      const next = !current;
      saveStorageBoolean(REAL_DEVICE_TEST_OPEN_KEY, next);
      return next;
    });
  };

  const toggleItem = (item: string) => {
    setCheckedItems((current) => {
      const next = current.includes(item)
        ? current.filter((value) => value !== item)
        : [...current, item];
      saveStringArray(REAL_DEVICE_TEST_CHECKLIST_KEY, next);
      return next;
    });
  };

  const handleNotesChange = (value: string) => {
    const next = value.slice(0, 500);
    setNotes(next);
    saveStorageText(REAL_DEVICE_TEST_NOTES_KEY, next);
  };

  const handlePublicUrlChange = (value: string) => {
    const next = value.slice(0, 240);
    setPublicUrl(next);
    saveStorageText(PUBLIC_URL_STORAGE_KEY, next);
  };

  const handleCopyReport = async () => {
    const text = buildRealDeviceTestReport(checkedItems, notes);
    setFallbackText("");

    try {
      if (!navigator.clipboard) {
        setFallbackText(text);
        setCopyMessage("コピー用テキストを表示しました");
        return;
      }

      await navigator.clipboard.writeText(text);
      setCopyMessage("コピーしました");
    } catch {
      setFallbackText(text);
      setCopyMessage("コピー用テキストを表示しました");
    }
  };

  const resetChecklist = () => {
    setCheckedItems([]);
    saveStringArray(REAL_DEVICE_TEST_CHECKLIST_KEY, []);
    setShowResetConfirm(false);
  };

  if (!loaded) return null;

  const allChecked = checkedItems.length === realDeviceTestItems.length;
  const openUrl = normalizePublicUrl(publicUrl);

  return (
    <section className="mt-4 rounded-2xl bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-bold text-gray-900">スマホ実機テスト</h2>
          <p className="mt-1 text-xs font-bold leading-5 text-gray-500">
            公開URLをスマホで開いて、表示と操作を確認します
          </p>
        </div>
        <button
          type="button"
          onClick={toggleOpen}
          className="shrink-0 rounded-full border border-green-200 px-3 py-2 text-xs font-bold text-green-700 active:bg-green-50"
        >
          {isOpen ? "閉じる" : "開く"}
        </button>
      </div>

      {allChecked && (
        <div className="mt-3 rounded-xl bg-green-50 px-3 py-2 text-xs font-black text-green-700">
          実機テスト完了！
        </div>
      )}

      {isOpen && (
        <>
          <label className="mt-4 block">
            <span className="text-xs font-bold text-gray-600">公開URL</span>
            <div className="mt-2 flex gap-2">
              <input
                type="url"
                value={publicUrl}
                onChange={(event) => handlePublicUrlChange(event.target.value)}
                className="h-10 min-w-0 flex-1 rounded-xl border border-gray-200 bg-white px-3 text-sm outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100"
                placeholder="VercelのURLを貼る"
              />
              {openUrl && (
                <a
                  href={openUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-10 shrink-0 items-center justify-center rounded-xl bg-green-600 px-3 text-xs font-black text-white active:scale-[0.98]"
                >
                  開く
                </a>
              )}
            </div>
          </label>

          <div className="mt-4 grid grid-cols-2 gap-2">
            {realDeviceTestItems.map((item) => (
              <label
                key={item}
                className="flex min-h-10 items-center gap-2 rounded-xl bg-gray-50 px-3 py-2 text-xs font-bold text-gray-700"
              >
                <input
                  type="checkbox"
                  checked={checkedItems.includes(item)}
                  onChange={() => toggleItem(item)}
                  className="h-4 w-4 rounded border-gray-300 text-green-600"
                />
                <span>{item}</span>
              </label>
            ))}
          </div>

          <label className="mt-4 block">
            <span className="text-xs font-bold text-gray-600">実機テストメモ</span>
            <textarea
              value={notes}
              maxLength={500}
              onChange={(event) => handleNotesChange(event.target.value)}
              className="mt-2 min-h-20 w-full resize-none rounded-xl border border-gray-200 bg-white px-3 py-3 text-sm outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100"
              placeholder="スマホで気づいたことをメモ"
            />
          </label>

          <div className="mt-1 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => {
                void handleCopyReport();
              }}
              className="rounded-full border border-gray-200 px-3 py-2 text-xs font-bold text-gray-700 active:bg-gray-50"
            >
              テスト報告をコピー
            </button>
            <div className="text-right text-[11px] font-bold text-gray-400">
              {notes.length}/500
            </div>
          </div>

          {copyMessage && (
            <div className="mt-3 rounded-xl bg-green-50 px-3 py-2 text-xs font-bold text-green-700">
              {copyMessage}
            </div>
          )}

          {fallbackText && (
            <textarea
              value={fallbackText}
              readOnly
              className="mt-2 max-h-36 w-full resize-none rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-700 outline-none"
            />
          )}

          <div className="mt-4 rounded-xl border border-gray-100 bg-gray-50 px-3 py-3">
            {showResetConfirm ? (
              <div className="space-y-2">
                <div className="text-xs font-bold text-gray-600">
                  チェック項目だけをリセットします。メモと公開URLは残ります。
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={resetChecklist}
                    className="rounded-full bg-gray-900 px-3 py-2 text-xs font-bold text-white"
                  >
                    リセットする
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowResetConfirm(false)}
                    className="rounded-full bg-white px-3 py-2 text-xs font-bold text-gray-700"
                  >
                    やめる
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowResetConfirm(true)}
                className="rounded-full border border-gray-200 bg-white px-3 py-2 text-xs font-bold text-gray-700 active:bg-gray-50"
              >
                テスト項目をリセット
              </button>
            )}
          </div>
        </>
      )}
    </section>
  );
}
