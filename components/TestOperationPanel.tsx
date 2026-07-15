"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

const STORAGE_KEY = "ubalog-public-test-checklist";

type CheckCategory = {
  title: string;
  items: Array<{
    id: string;
    label: string;
  }>;
};

const checkCategories: CheckCategory[] = [
  {
    title: "記録",
    items: [
      { id: "record-empty-name", label: "表示名入力を空にできる" },
      { id: "record-anonymous-number", label: "無記名時に0001のような匿名番号になる" },
      { id: "record-save-basic", label: "売上・件数・稼働時間を保存できる" },
      { id: "record-ranking-reflect", label: "保存後ランキングに反映される" },
      { id: "record-rocketnow-open", label: "ロケナウスキャンを開ける" },
      { id: "record-rocketnow-multiple", label: "ロケナウスキャンで複数スクショを選べる" },
    ],
  },
  {
    title: "ランキング",
    items: [
      { id: "ranking-today", label: "今日ランキングが見られる" },
      { id: "ranking-yesterday", label: "昨日ランキングが見られる" },
      { id: "ranking-tabs", label: "売上/時給/件数/単価タブが切り替わる" },
      { id: "ranking-swipe", label: "左右スワイプで指標タブが切り替わる" },
      { id: "ranking-no-duplicate", label: "自分の記録が重複表示されない" },
      { id: "ranking-unit-price", label: "単価ランキングが報酬単価順になっている" },
    ],
  },
  {
    title: "リアルタイム共有",
    items: [
      { id: "realtime-post", label: "スキャン入力または手入力で共有できる" },
      { id: "realtime-pin", label: "地図にピンを指定できる" },
      { id: "realtime-close-complete", label: "共有後の完了ウィンドウを閉じられる" },
      { id: "realtime-x-share", label: "X共有ボタンが開く" },
      { id: "realtime-unit-ranking", label: "単価ランキングへ移動できる" },
    ],
  },
  {
    title: "ニュース",
    items: [
      { id: "news-open", label: "ニュースタブが開く" },
      { id: "news-refresh", label: "下に引っ張って更新できる" },
      { id: "news-realtime-link", label: "リアルタイム投稿ニュースから共有画面へ移動できる" },
      { id: "news-pr-balance", label: "PRが出すぎていない" },
    ],
  },
  {
    title: "マイページ",
    items: [
      { id: "home-share-text", label: "ウバログ紹介シェアが指定文言になっている" },
      { id: "home-install-guide", label: "ホーム画面追加ガイドが見られる" },
      { id: "home-beginner-guide", label: "初回ガイドが見られる" },
      { id: "home-footer-links", label: "利用ルール/プライバシー/不具合報告リンクが開く" },
    ],
  },
  {
    title: "表示",
    items: [
      { id: "display-no-horizontal-scroll", label: "iPhone幅で横スクロールしない" },
      { id: "display-bottom-menu-safe", label: "BottomMenuにボタンやカードが隠れない" },
      { id: "display-ogp-icon", label: "OGP/アイコン設定がある" },
      { id: "display-build", label: "npm run build が通る" },
    ],
  },
];

const shortcuts = [
  { href: "/", label: "マイページ" },
  { href: "/record", label: "記録" },
  { href: "/ranking", label: "ランキング" },
  { href: "/ranking?tab=unitPrice", label: "単価ランキング" },
  { href: "/realtime", label: "リアルタイム共有" },
  { href: "/news", label: "ニュース" },
  { href: "/profile", label: "プロフ" },
  { href: "/terms", label: "利用ルール" },
  { href: "/privacy", label: "プライバシー" },
  { href: "/feedback", label: "不具合報告" },
];

function readStoredChecks() {
  if (typeof window === "undefined") return [];

  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is string => typeof item === "string");
  } catch {
    return [];
  }
}

function writeStoredChecks(ids: string[]) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  } catch {
    // 保存できない環境でもチェック操作自体は続けます。
  }
}

export default function TestOperationPanel() {
  const [checkedIds, setCheckedIds] = useState<string[]>(readStoredChecks);
  const [confirmReset, setConfirmReset] = useState(false);

  const totalCount = useMemo(
    () => checkCategories.reduce((sum, category) => sum + category.items.length, 0),
    [],
  );
  const checkedCount = checkedIds.length;
  const checkedSet = useMemo(() => new Set(checkedIds), [checkedIds]);
  const isComplete = checkedCount === totalCount;

  const toggleCheck = (id: string) => {
    setCheckedIds((current) => {
      const next = current.includes(id)
        ? current.filter((currentId) => currentId !== id)
        : [...current, id];
      writeStoredChecks(next);
      return next;
    });
    setConfirmReset(false);
  };

  const resetChecks = () => {
    setCheckedIds([]);
    setConfirmReset(false);
    if (typeof window !== "undefined") {
      try {
        window.localStorage.removeItem(STORAGE_KEY);
      } catch {
        // 端末保存を消せない場合も画面上のチェックは戻します。
      }
    }
  };

  return (
    <div className="space-y-4">
      <section className="rounded-2xl bg-white p-4 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-black text-green-700">チェック進捗</p>
            <h2 className="mt-1 text-2xl font-black text-gray-900">
              {checkedCount} / {totalCount} チェック済み
            </h2>
            {isComplete && (
              <p className="mt-2 rounded-xl bg-green-50 px-3 py-2 text-sm font-black text-green-700">
                公開チェック完了！
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => setConfirmReset(true)}
            className="shrink-0 rounded-full bg-gray-100 px-3 py-2 text-xs font-black text-gray-600 active:bg-gray-200"
          >
            リセット
          </button>
        </div>

        {confirmReset && (
          <div className="mt-3 rounded-2xl border border-orange-100 bg-orange-50 p-3">
            <p className="text-sm font-black text-orange-900">リセットしますか？</p>
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={resetChecks}
                className="flex-1 rounded-xl bg-orange-500 px-3 py-2 text-xs font-black text-white active:bg-orange-600"
              >
                リセットする
              </button>
              <button
                type="button"
                onClick={() => setConfirmReset(false)}
                className="flex-1 rounded-xl bg-white px-3 py-2 text-xs font-black text-orange-700 active:bg-orange-100"
              >
                やめる
              </button>
            </div>
          </div>
        )}
      </section>

      <section className="rounded-2xl bg-white p-4 shadow-sm">
        <h2 className="text-base font-black text-gray-900">確認ショートカット</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {shortcuts.map((shortcut) => (
            <Link
              key={shortcut.href}
              href={shortcut.href}
              className="rounded-full bg-green-50 px-3 py-2 text-xs font-black text-green-700 active:bg-green-100"
            >
              {shortcut.label}
            </Link>
          ))}
        </div>
      </section>

      {checkCategories.map((category) => (
        <section key={category.title} className="rounded-2xl bg-white p-4 shadow-sm">
          <h2 className="text-base font-black text-gray-900">{category.title}</h2>
          <div className="mt-3 space-y-2">
            {category.items.map((item) => {
              const checked = checkedSet.has(item.id);
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => toggleCheck(item.id)}
                  className={`flex w-full min-w-0 items-center gap-3 rounded-2xl border px-3 py-3 text-left active:scale-[0.99] ${
                    checked
                      ? "border-green-200 bg-green-50 text-green-900"
                      : "border-gray-100 bg-gray-50 text-gray-700"
                  }`}
                >
                  <span
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-sm font-black ${
                      checked
                        ? "border-green-600 bg-green-600 text-white"
                        : "border-gray-300 bg-white text-transparent"
                    }`}
                    aria-hidden="true"
                  >
                    ✓
                  </span>
                  <span className="min-w-0 break-words text-sm font-bold leading-5">
                    {item.label}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
