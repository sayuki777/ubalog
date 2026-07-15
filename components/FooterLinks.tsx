"use client";

import Link from "next/link";

export default function FooterLinks() {
  return (
    <section className="mt-4 rounded-2xl bg-white px-4 py-3 shadow-sm">
      <div className="flex items-center justify-center gap-4 text-xs font-bold text-gray-500">
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
