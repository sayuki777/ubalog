"use client";

import { MOOD_OPTIONS } from "@/lib/mood";

type Props = {
  open: boolean;
  selectedMood: string;
  onSelect: (mood: string) => void;
  onClose: () => void;
};

export default function MoodPicker({
  open,
  selectedMood,
  onSelect,
  onClose,
}: Props) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/30 px-3">
      <div className="w-full max-w-[430px] rounded-t-3xl bg-white p-4 shadow-2xl">
        <div className="flex items-center justify-between">
          <div className="text-sm font-black text-gray-900">気分を選ぶ</div>
          <button
            type="button"
            onClick={onClose}
            className="h-9 rounded-full px-3 text-xs font-bold text-gray-500"
          >
            閉じる
          </button>
        </div>
        <div className="mt-3 grid max-h-[55dvh] grid-cols-2 gap-2 overflow-y-auto pb-2">
          {MOOD_OPTIONS.map((mood) => (
            <button
              key={mood}
              type="button"
              onClick={() => onSelect(mood)}
              className={`min-h-11 rounded-xl border px-3 py-2 text-left text-xs font-bold ${
                selectedMood === mood
                  ? "border-green-500 bg-green-50 text-green-800"
                  : "border-gray-200 bg-white text-gray-700"
              }`}
            >
              {mood}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
