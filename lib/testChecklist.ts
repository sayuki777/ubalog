export const REAL_DEVICE_TEST_CHECKLIST_KEY = "ubalog-real-device-test-checklist";
export const REAL_DEVICE_TEST_NOTES_KEY = "ubalog-real-device-test-notes";
export const PUBLIC_URL_STORAGE_KEY = "ubalog-public-url";
export const REAL_DEVICE_TEST_OPEN_KEY = "ubalog-real-device-test-open";

export const realDeviceTestItems = [
  "マイページが開ける",
  "記録タブが開ける",
  "記録を保存できる",
  "保存後にマイページへ反映される",
  "NEW表示が自然に出る",
  "目標タブが開ける",
  "日別目標を設定できる",
  "目標達成演出が出る",
  "ニュースタブが開ける",
  "個人ニュースが表示される",
  "ランキングタブが開ける",
  "売上/時給/件数タブが動く",
  "ランキング個人詳細が開く",
  "リアルタイム共有が開ける",
  "＋共有ボタンが押せる",
  "地図に同期できる",
  "プロフが開ける",
  "表示名が同期される",
  "配達員募集ページが開ける",
  "menu招待コードをコピーできる",
  "バックアップを作成できる",
  "下部メニューに隠れていない",
  "文字が小さすぎない",
  "ボタンが押しやすい",
];

export function loadStringArray(key: string) {
  if (typeof window === "undefined") return [];

  try {
    const parsed = JSON.parse(localStorage.getItem(key) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === "string") : [];
  } catch {
    return [];
  }
}

export function saveStringArray(key: string, values: string[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, JSON.stringify(values));
}

export function loadStorageText(key: string) {
  if (typeof window === "undefined") return "";

  try {
    return localStorage.getItem(key) ?? "";
  } catch {
    return "";
  }
}

export function saveStorageText(key: string, value: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, value);
}

export function loadStorageBoolean(key: string, fallback = true) {
  if (typeof window === "undefined") return fallback;

  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) === true;
  } catch {
    return fallback;
  }
}

export function saveStorageBoolean(key: string, value: boolean) {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, JSON.stringify(value));
}

export function normalizePublicUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

export function buildRealDeviceTestReport(checkedItems: string[], notes: string) {
  const checks = realDeviceTestItems
    .map((item) => `- ${item}: ${checkedItems.includes(item) ? "OK" : "未確認"}`)
    .join("\n");

  return `ウバログ スマホ実機テスト報告\n\n確認済み:\n${checks}\n\nメモ:\n${
    notes.trim() || "なし"
  }`;
}
