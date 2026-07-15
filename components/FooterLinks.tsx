"use client";

import Link from "next/link";

export default function FooterLinks() {
  return (
    <section className="mt-4 rounded-2xl bg-white px-4 py-3 shadow-sm">
      <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs font-bold text-gray-500">
        <Link href="/feedback" className="rounded-full px-2 py-2 active:bg-gray-50">
          不具合報告・ご要望
        </Link>
        <span className="text-gray-300">/</span>
        <Link href="/terms" className="rounded-full px-2 py-2 active:bg-gray-50">
          利用ルール
        </Link>
        <span className="text-gray-300">/</span>
        <Link href="/privacy" className="rounded-full px-2 py-2 active:bg-gray-50">
          プライバシー
        </Link>
      </div>
    </section>
  );
}
