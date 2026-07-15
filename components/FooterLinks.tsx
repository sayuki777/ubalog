"use client";

import Link from "next/link";

const footerLinks = [
  { href: "/feedback", label: "不具合報告・ご要望" },
  { href: "/test", label: "動作チェック" },
  { href: "/terms", label: "利用ルール" },
  { href: "/privacy", label: "プライバシー" },
];

export default function FooterLinks() {
  return (
    <section className="mt-4 rounded-2xl bg-white px-4 py-3 shadow-sm">
      <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-xs font-bold text-gray-500">
        {footerLinks.map((link, index) => (
          <span key={link.href} className="flex items-center gap-x-2">
            {index > 0 && <span className="text-gray-300">/</span>}
            <Link href={link.href} className="rounded-full px-2 py-2 active:bg-gray-50">
              {link.label}
            </Link>
          </span>
        ))}
      </div>
    </section>
  );
}
