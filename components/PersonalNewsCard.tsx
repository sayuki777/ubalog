"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { fetchExternalNews, getCachedExternalNews } from "@/lib/externalNews";
import { getNewsItems, type UbalogNewsItem } from "@/lib/news";

function formatDate(iso: string) {
  const date = new Date(iso);
  if (!Number.isNaN(date.getTime())) return `${date.getMonth() + 1}/${date.getDate()}`;
  const [, month, day] = iso.split("-");
  return month && day ? `${Number(month)}/${Number(day)}` : "";
}

function newsTime(item: UbalogNewsItem) {
  return new Date(item.publishedAt || item.createdAt).getTime() || 0;
}

export default function PersonalNewsCard() {
  const [personalItems, setPersonalItems] = useState<UbalogNewsItem[]>([]);
  const [externalItems, setExternalItems] = useState<UbalogNewsItem[]>([]);

  useEffect(() => {
    const loadPersonal = () => setPersonalItems(getNewsItems());
    const load = async () => {
      loadPersonal();
      setExternalItems(getCachedExternalNews());
      setExternalItems(await fetchExternalNews());
    };

    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    window.addEventListener("focus", loadPersonal);
    window.addEventListener("ubalog-news-updated", loadPersonal);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("focus", loadPersonal);
      window.removeEventListener("ubalog-news-updated", loadPersonal);
    };
  }, []);

  const items = useMemo(
    () => {
      const personal = [...personalItems].sort((a, b) => newsTime(b) - newsTime(a));
      const external = [...externalItems].sort((a, b) => newsTime(b) - newsTime(a));
      return [...personal.slice(0, 3), ...external].slice(0, 3);
    },
    [externalItems, personalItems]
  );

  return (
    <Link
      href="/news"
      className="mt-4 block rounded-2xl bg-white p-4 shadow-sm active:scale-[0.99]"
    >
      <div className="flex items-center justify-between">
        <div className="text-base font-bold text-gray-900">ニュース</div>
        <div className="text-xs font-bold text-green-700">一覧へ</div>
      </div>
      <div className="mt-3 space-y-2">
        {items.length === 0 ? (
          <div className="rounded-xl bg-gray-50 px-3 py-3 text-sm font-bold text-gray-500">
            記録するとニュースが表示されます
          </div>
        ) : (
          items.map((item) => (
            <div
              key={`${item.source}-${item.id}`}
              className="line-clamp-2 rounded-xl bg-green-50 px-3 py-2 text-sm font-bold text-gray-800"
            >
              <span className="mr-2 text-green-700">
                {formatDate(item.publishedAt || item.recordDate || item.createdAt)}
              </span>
              {item.message || item.title}
            </div>
          ))
        )}
      </div>
    </Link>
  );
}
