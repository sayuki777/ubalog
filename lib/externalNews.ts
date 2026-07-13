import type { UbalogNewsItem } from "@/lib/news";

const EXTERNAL_NEWS_CACHE_KEY = "ubalog-external-news-cache";

export function getCachedExternalNews(): UbalogNewsItem[] {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem(EXTERNAL_NEWS_CACHE_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as UbalogNewsItem[]) : [];
  } catch {
    return [];
  }
}

export function saveExternalNewsCache(items: UbalogNewsItem[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(EXTERNAL_NEWS_CACHE_KEY, JSON.stringify(items.slice(0, 50)));
}

export async function fetchExternalNews(): Promise<UbalogNewsItem[]> {
  try {
    const response = await fetch("/api/news", { cache: "no-store" });
    if (!response.ok) throw new Error("news request failed");
    const data = (await response.json()) as {
      configured?: boolean;
      items?: UbalogNewsItem[];
    };
    const items = Array.isArray(data.items) ? data.items : [];
    if (items.length > 0) {
      saveExternalNewsCache(items);
      return items;
    }
    if (data.configured) return getCachedExternalNews();
    return items;
  } catch {
    return getCachedExternalNews();
  }
}

export function isDeliveryRelatedNews(item: UbalogNewsItem) {
  const text = `${item.title} ${item.message ?? ""}`.toLowerCase();
  return [
    "配達",
    "フードデリバリー",
    "uber",
    "uber eats",
    "出前館",
    "menu",
    "ロケットナウ",
    "rocket now",
    "配送",
    "宅配",
    "バイク",
    "自転車",
    "交通",
    "事故",
    "道路",
    "天気",
    "猛暑",
    "熱中症",
    "雨",
    "台風",
    "寒波",
    "雪",
    "ガソリン",
    "電動自転車",
  ].some((keyword) => text.includes(keyword.toLowerCase()));
}
