"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useRef, type TouchEvent } from "react";

const items = [
  { href: "/mypage", label: "マイページ", icon: "🏠" },
  { href: "/record", label: "記録", icon: "📝" },
  { href: "/ranking", label: "ランキング", icon: "🏆" },
  { href: "/realtime", label: "共有", icon: "📡" },
  { href: "/news", label: "ニュース", icon: "📰" },
];

export default function BottomMenu() {
  const pathname = usePathname();
  const router = useRouter();
  const swipeStartRef = useRef<{ x: number; y: number } | null>(null);

  const activeIndex = items.findIndex(
    (item) =>
      pathname === item.href ||
      (item.href === "/news" && pathname === "/game")
  );

  const handleTouchStart = (event: TouchEvent<HTMLElement>) => {
    const touch = event.touches[0];
    swipeStartRef.current = { x: touch.clientX, y: touch.clientY };
  };

  const handleTouchEnd = (event: TouchEvent<HTMLElement>) => {
    const start = swipeStartRef.current;
    swipeStartRef.current = null;
    const touch = event.changedTouches[0];
    if (!start || !touch || activeIndex < 0) return;

    const diffX = touch.clientX - start.x;
    const diffY = touch.clientY - start.y;
    if (Math.abs(diffX) < 50 || Math.abs(diffX) <= Math.abs(diffY)) return;

    const nextIndex = diffX < 0 ? activeIndex + 1 : activeIndex - 1;
    const nextItem = items[nextIndex];
    if (!nextItem) return;
    router.push(nextItem.href);
  };

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-gray-200 bg-white pb-[env(safe-area-inset-bottom)] [touch-action:pan-y]"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div className="mx-auto flex h-16 w-full max-w-[430px] items-center justify-around px-2">
        {items.map((item) => {
          const active =
            pathname === item.href ||
            (item.href === "/news" && pathname === "/game");

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={(event) => {
                if (item.href === "/mypage" && pathname === "/mypage") {
                  event.preventDefault();
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }
              }}
              className={`flex min-w-[64px] flex-col items-center justify-center rounded-lg px-1 py-1 text-[10px] leading-none ${
                active ? "font-bold text-green-600" : "text-gray-500"
              }`}
            >
              <span className="text-lg">{item.icon}</span>
              <span className="mt-1 whitespace-nowrap">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
