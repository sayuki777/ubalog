const MOOD_STORAGE_KEY = "ubalog-mood";

export type MoodEntry = {
  mood: string;
  updatedAt: string;
};

export const MOOD_OPTIONS = [
  "最悪…😵",
  "しんどい",
  "へとへと",
  "低空飛行",
  "休みたい",
  "ぼちぼち☕",
  "ふつう",
  "まあまあ",
  "悪くない",
  "じわ伸び",
  "コツコツ",
  "いい感じ👏",
  "順調",
  "ナイス",
  "乗ってる",
  "集中中",
  "爆走中",
  "イケイケ🔥",
  "ドンドン",
  "絶好調",
  "神モード",
  "無双中",
  "最高！🔥",
  "優勝！",
  "燃えてる",
  "覚醒中",
  "やる気MAX",
  "走り切る",
  "今日はいける",
  "限界突破🚀",
];

function readMoodMap(): Record<string, MoodEntry> {
  if (typeof window === "undefined") return {};

  const raw = localStorage.getItem(MOOD_STORAGE_KEY);
  if (!raw) return {};

  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object"
      ? (parsed as Record<string, MoodEntry>)
      : {};
  } catch {
    return {};
  }
}

export function getMood(date: string) {
  return readMoodMap()[date] ?? null;
}

export function saveMood(date: string, mood: string) {
  if (typeof window === "undefined") return;

  const next = {
    ...readMoodMap(),
    [date]: {
      mood,
      updatedAt: new Date().toISOString(),
    },
  };

  localStorage.setItem(MOOD_STORAGE_KEY, JSON.stringify(next));
  window.dispatchEvent(new Event("ubalog-mood-updated"));
}
