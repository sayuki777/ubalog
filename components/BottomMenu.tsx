"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const items = [
  { href: "/", label: "マイページ", icon: "🏠" },
  { href: "/record", label: "記録", icon: "📝" },
  { href: "/ranking", label: "ランキング", icon: "🏆" },
  { href: "/realtime", label: "共有", icon: "📡" },
  { href: "/news", label: "ニュース", icon: "📰" },
];

export default function BottomMenu() {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-gray-200 bg-white pb-[env(safe-area-inset-bottom)]">
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
                if (item.href === "/" && pathname === "/") {
                  event.preventDefault();
                  window.scrollTo({ top: 0, behavior: "smooth" });
                  return;
                }
                if (item.href === "/" && pathname !== "/") {
                  event.preventDefault();
                  router.push("/");
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
