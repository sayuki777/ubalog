"use client";

import { useEffect, useMemo, useState } from "react";
import AffiliateMiniAd from "@/components/AffiliateMiniAd";
import AppHeader from "@/components/AppHeader";
import BottomMenu from "@/components/BottomMenu";
import NewsItemCard from "@/components/NewsItemCard";
import { pickAffiliateAd, shouldShowCustomerAffiliateAds } from "@/lib/affiliateAds";
import {
  fetchExternalNews,
  getCachedExternalNews,
  isDeliveryRelatedNews,
} from "@/lib/externalNews";
import {
  getNewsItems,
  regenerateNewsFromRecords,
  upsertWeeklySummaryNews,
  type NewsRecord,
  type UbalogNewsCategory,
  type UbalogNewsItem,
} from "@/lib/news";

const RECORDS_STORAGE_KEY = "ubalog-records";
const PROFILE_STORAGE_KEY = "ubalog-profile";

const tabs: { key: UbalogNewsCategory; label: string }[] = [
  { key: "all", label: "すべて" },
  { key: "personal", label: "個人" },
  { key: "external", label: "外部" },
  { key: "goal", label: "目標" },
  { key: "record", label: "記録" },
  { key: "delivery", label: "配達" },
];

function loadRecords(): NewsRecord[] {
  const raw = localStorage.getItem(RECORDS_STORAGE_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as NewsRecord[]) : [];
  } catch {
    return [];
  }
}

function newsTime(item: UbalogNewsItem) {
  return new Date(item.publishedAt || item.createdAt).getTime() || 0;
}

function mergeNews(personal: UbalogNewsItem[], external: UbalogNewsItem[]) {
  const map = new Map<string, UbalogNewsItem>();
  for (const item of [...personal, ...external]) map.set(item.id, item);
  return [...map.values()].sort((a, b) => newsTime(b) - newsTime(a));
}

type NewsProfile = {
  prefecture?: string;
  region?: string;
};

function normalizeRegion(region?: string) {
  if (!region) return "";
  return region === "九州四国" ? "九州" : region;
}

function loadProfile(): NewsProfile {
  const raw = localStorage.getItem(PROFILE_STORAGE_KEY);
  if (!raw) return {};
  try {
    return JSON.parse(raw) as NewsProfile;
  } catch {
    return {};
  }
}

function canShowAreaNews(item: UbalogNewsItem, profile: NewsProfile) {
  if (item.type !== "area_top_update" && item.type !== "ranking_top_update") return true;
  if (!item.areaScope || item.areaScope === "national") return true;
  if (item.areaScope === "prefecture") {
    return Boolean(profile.prefecture) && item.areaName === profile.prefecture;
  }
  if (item.areaScope === "region") {
    return Boolean(profile.region) && normalizeRegion(item.areaName) === normalizeRegion(profile.region);
  }
  return true;
}

function filterAreaNews(items: UbalogNewsItem[], profile: NewsProfile) {
  return items.filter((item) => canShowAreaNews(item, profile));
}

function filterNews(items: UbalogNewsItem[], activeTab: UbalogNewsCategory) {
  if (activeTab === "all") return items;
  if (activeTab === "personal") {
    return items.filter(
      (item) =>
        item.source === "personal" &&
        item.category !== "breaking" &&
        item.category !== "ranking"
    );
  }
  if (activeTab === "external") return items.filter((item) => item.source === "external");
  if (activeTab === "delivery") {
    return items.filter(
      (item) =>
        item.category === "delivery" ||
        item.type === "breaking_realtime" ||
        isDeliveryRelatedNews(item)
    );
  }
  if (activeTab === "record") {
    return items.filter(
      (item) =>
        item.category === "record" ||
        item.category === "ranking" ||
        item.type === "ranking_top_update" ||
        item.type === "area_top_update"
    );
  }
  return items.filter((item) => item.category === activeTab);
}

export default function NewsPage() {
  const [personalItems, setPersonalItems] = useState<UbalogNewsItem[]>([]);
  const [externalItems, setExternalItems] = useState<UbalogNewsItem[]>([]);
  const [activeTab, setActiveTab] = useState<UbalogNewsCategory>("all");
  const [profile, setProfile] = useState<NewsProfile>({});
  const [message, setMessage] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadPersonal = () => {
    setProfile(loadProfile());
    setPersonalItems(getNewsItems());
  };

  useEffect(() => {
    const load = async () => {
      loadPersonal();
      setExternalItems(getCachedExternalNews());
      const external = await fetchExternalNews();
      setExternalItems(external);
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

  const allItems = useMemo(
    () => filterAreaNews(mergeNews(personalItems, externalItems), profile),
    [externalItems, personalItems, profile]
  );
  const filteredItems = useMemo(
    () => filterNews(allItems, activeTab),
    [activeTab, allItems]
  );
  const newsAds = useMemo(() => {
    if (activeTab !== "all" || filteredItems.length < 2 || !shouldShowCustomerAffiliateAds()) {
      return [];
    }

    const first = pickAffiliateAd({
      placement: "news-all",
      slot: 0,
      driverWeight: 0.4,
    });
    const second =
      filteredItems.length >= 6
        ? pickAffiliateAd({
            placement: "news-all",
            slot: 1,
            driverWeight: 0.4,
            excludeIds: first ? [first.id] : [],
          })
        : null;

    return [first, second].filter(Boolean);
  }, [activeTab, filteredItems.length]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    const next = regenerateNewsFromRecords(loadRecords());
    setPersonalItems(next);
    const external = await fetchExternalNews();
    setExternalItems(external);
    setMessage("ニュースを更新しました");
    setIsRefreshing(false);
  };

  const handleWeeklySummary = () => {
    const item = upsertWeeklySummaryNews(loadRecords());
    loadPersonal();
    setMessage(item ? "週間サマリーを更新しました" : "週間サマリーは記録がある週に表示されます");
  };

  const emptyMessage =
    activeTab === "external"
      ? "外部ニュースは取得でき次第表示されます"
      : "記録するとニュースが表示されます";

  return (
    <main className="mx-auto min-h-screen w-full max-w-[430px] bg-gray-50 pb-24">
      <AppHeader title="ニュース" />

      <div className="px-4 pt-1">
        <section className="hidden">
          <h1 className="text-xl font-bold text-gray-900">ニュース</h1>
          <div className="mt-3 rounded-2xl bg-gray-50 px-3 py-3 text-sm font-bold text-gray-500">
            記録と配達まわりの話題をまとめて確認できます
          </div>
        </section>

        <div className="sticky top-16 z-20 -mx-4 bg-gray-50 px-4 py-1.5">
          <div className="mb-1 min-h-4">
            <div className="text-xs font-bold text-gray-500">
              {isRefreshing ? "更新中..." : message}
            </div>
          </div>
          <div className="mb-1.5 flex min-w-0 items-center gap-2">
            <button
              type="button"
              onClick={handleWeeklySummary}
              className="h-8 min-w-0 flex-1 truncate rounded-full border border-green-200 bg-green-50 px-3 text-xs font-bold text-green-700"
            >
              週間サマリー
            </button>
            <button
              type="button"
              onClick={() => void handleRefresh()}
              disabled={isRefreshing}
              className="h-8 w-20 shrink-0 rounded-full border border-green-600 bg-white px-3 text-xs font-bold text-green-700 disabled:border-gray-200 disabled:text-gray-400"
            >
              更新
            </button>
          </div>
          <div className="grid grid-cols-3 gap-2 pb-1">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`h-9 min-w-0 truncate rounded-full px-2 text-xs font-bold ${
                  activeTab === tab.key
                    ? "bg-green-600 text-white shadow-sm"
                    : "bg-white text-gray-600"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <section className="rounded-2xl bg-white px-4 py-2 shadow-sm">
          {filteredItems.length === 0 ? (
            <div className="px-3 py-10 text-center text-sm font-bold text-gray-500">
              {emptyMessage}
            </div>
          ) : (
            filteredItems.slice(0, 80).map((item, index) => (
              <div key={`${item.source}-${item.id}`}>
                <NewsItemCard item={item} />
                {index === 0 && newsAds[0] && (
                  <div className="py-2">
                    <AffiliateMiniAd ad={newsAds[0]} placement="news-all" slot={0} />
                  </div>
                )}
                {index === 2 && newsAds[1] && (
                  <div className="py-2">
                    <AffiliateMiniAd ad={newsAds[1]} placement="news-all" slot={1} />
                  </div>
                )}
              </div>
            ))
          )}
        </section>

      </div>

      <BottomMenu />
    </main>
  );
}
