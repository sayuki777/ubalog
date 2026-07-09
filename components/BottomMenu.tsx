"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/", label: "ホーム", icon: "🏠" },
  { href: "/record", label: "記録", icon: "📝" },
  { href: "/ranking", label: "ランク", icon: "🏆" },
  { href: "/realtime", label: "共有", icon: "📡" },
  { href: "/profile", label: "マイ", icon: "👤" },
];

export default function BottomMenu() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-gray-200 bg-white">
      <div className="mx-auto flex h-16 w-full max-w-[430px] items-center justify-around px-2">
        {items.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex min-w-[64px] flex-col items-center justify-center rounded-lg px-2 py-1 text-[11px] leading-none ${
                active ? "font-bold text-green-600" : "text-gray-500"
              }`}
            >
              <span className="text-lg">{item.icon}</span>
              <span className="mt-1">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}