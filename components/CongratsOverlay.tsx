"use client";

import { useEffect } from "react";

type Props = {
  type: "daily" | "weekly" | "monthly";
  message: string;
  onClose?: () => void;
};

export default function CongratsOverlay({ type, message, onClose }: Props) {
  useEffect(() => {
    const timer = window.setTimeout(() => {
      onClose?.();
    }, type === "monthly" ? 3600 : 2400);

    return () => window.clearTimeout(timer);
  }, [onClose, type]);

  const monthly = type === "monthly";
  const weekly = type === "weekly";

  return (
    <div className="pointer-events-none fixed inset-x-0 top-20 z-[80] mx-auto w-full max-w-[430px] px-6">
      <div
        className={`relative overflow-hidden rounded-3xl border bg-white/95 px-5 py-5 text-center shadow-2xl ${
          monthly
            ? "border-yellow-300"
            : weekly
            ? "border-green-300"
            : "border-pink-200"
        }`}
      >
        <div className="absolute left-4 top-3 animate-bounce text-xl">✨</div>
        <div className="absolute right-5 top-5 animate-pulse text-xl">🎉</div>
        {monthly && <div className="absolute bottom-3 left-8 animate-bounce text-2xl">🏆</div>}
        <div className={monthly ? "text-4xl" : "text-3xl"}>
          {monthly ? "🎊🎊🎊" : weekly ? "🎉🔥" : "🎉"}
        </div>
        <div
          className={`mt-2 font-black text-gray-900 ${
            monthly ? "text-xl" : "text-lg"
          }`}
        >
          {message}
        </div>
      </div>
    </div>
  );
}
