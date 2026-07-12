"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const CHECKLIST_STORAGE_KEY = "ubalog-test-checklist";
const NOTES_STORAGE_KEY = "ubalog-test-notes";

const checklistItems = [
  "記録入力",
  "目標確認",
  "ロケナウOCR",
  "リアルタイム共有",
  "地図に同期",
  "ランキング確認",
  "バックアップ",
];

function loadCheckedItems() {
  const raw = localStorage.getItem(CHECKLIST_STORAGE_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as string[]) : [];
  } catch {
    return [];
  }
}

export default function TestOperationPanel() {
  const [checkedItems, setCheckedItems] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setCheckedItems(loadCheckedItems());
      setNotes(localStorage.getItem(NOTES_STORAGE_KEY) ?? "");
      setLoaded(true);
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  const toggleItem = (item: string) => {
    setCheckedItems((current) => {
      const next = current.includes(item)
        ? current.filter((value) => value !== item)
        : [...current, item];
      localStorage.setItem(CHECKLIST_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  };

  const handleNotesChange = (value: string) => {
    const next = value.slice(0, 300);
    setNotes(next);
    localStorage.setItem(NOTES_STORAGE_KEY, next);
  };

  if (!loaded) return null;

  return (
    <section className="mt-4 rounded-2xl bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-gray-900">テスト運用チェック</h2>
          <p className="mt-1 text-xs font-bold text-gray-500">
            配達中に確認した項目を残せます
          </p>
        </div>
        <Link
          href="/profile"
          className="shrink-0 rounded-full border border-green-200 px-3 py-2 text-xs font-bold text-green-700"
        >
          バックアップ
        </Link>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        {checklistItems.map((item) => (
          <label
            key={item}
            className="flex min-h-11 items-center gap-2 rounded-xl bg-gray-50 px-3 py-2 text-xs font-bold text-gray-700"
          >
            <input
              type="checkbox"
              checked={checkedItems.includes(item)}
              onChange={() => toggleItem(item)}
              className="h-4 w-4 rounded border-gray-300 text-green-600"
            />
            {item}
          </label>
        ))}
      </div>

      <label className="mt-4 block">
        <span className="text-xs font-bold text-gray-600">テストメモ</span>
        <textarea
          value={notes}
          maxLength={300}
          onChange={(event) => handleNotesChange(event.target.value)}
          className="mt-2 min-h-24 w-full resize-none rounded-xl border border-gray-200 bg-white px-3 py-3 text-sm outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100"
          placeholder="気づいたことをメモ"
        />
      </label>
      <div className="mt-1 text-right text-[11px] font-bold text-gray-400">
        {notes.length}/300
      </div>
    </section>
  );
}

