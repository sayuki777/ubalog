"use client";

import Link from "next/link";
import type { ReactNode } from "react";

type AppHeaderProps = {
  title?: string;
  leftAction?: ReactNode;
};

export default function AppHeader({ title, leftAction }: AppHeaderProps) {
  return (
    <header className="sticky top-0 z-30 h-16 border-b border-green-800 bg-green-700 text-white">
      <div className="relative mx-auto flex h-full w-full max-w-[430px] items-center justify-center px-4">
        {leftAction && <div className="absolute left-3">{leftAction}</div>}

        <h1 className="max-w-[270px] truncate text-center text-xl font-black tracking-tight">
          {title ? (
            title
          ) : (
            <>
              <span className="block text-[10px] font-bold leading-4 text-white/85">
                自由にフーデリ　自由にログ
              </span>
              <span className="block text-2xl font-black leading-7">ウバログ</span>
            </>
          )}
        </h1>

        <Link
          href="/profile"
          className="absolute right-3 rounded-full bg-white/15 px-2.5 py-2 text-xs font-bold active:scale-95"
          aria-label="プロフィール"
          title="プロフィール"
        >
          プロフ
        </Link>
      </div>
    </header>
  );
}
