import { NextResponse } from "next/server";
import type { UbalogNewsItem } from "@/lib/news";

const deliveryKeywords = [
  "配達",
  "フードデリバリー",
  "Uber",
  "Uber Eats",
  "出前館",
  "menu",
  "ロケットナウ",
  "Rocket Now",
  "宅配",
  "配送",
  "バイク",
  "自転車",
  "交通",
  "事故",
  "道路",
  "天気",
  "雨",
  "台風",
  "猛暑",
  "熱中症",
  "寒波",
  "雪",
  "ガソリン",
  "電動自転車",
];

function stripCdata(value: string) {
  return value.replace(/^<!\[CDATA\[/, "").replace(/\]\]>$/, "").trim();
}

function decodeXml(value: string) {
  return stripCdata(value)
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function tagValue(xml: string, tag: string) {
  const match = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return match ? decodeXml(match[1]) : "";
}

function attrValue(xml: string, attr: string) {
  const match = xml.match(new RegExp(`${attr}=["']([^"']+)["']`, "i"));
  return match ? decodeXml(match[1]) : "";
}

function rssImage(itemXml: string) {
  const enclosure = itemXml.match(/<enclosure[^>]*>/i)?.[0] ?? "";
  const thumbnail = itemXml.match(/<media:thumbnail[^>]*>/i)?.[0] ?? "";
  const media = itemXml.match(/<media:content[^>]*>/i)?.[0] ?? "";
  const description = tagValue(itemXml, "description");
  const imgSrc = description.match(/<img[^>]+src=["']([^"']+)["']/i)?.[1] ?? "";
  return (
    attrValue(enclosure, "url") ||
    attrValue(thumbnail, "url") ||
    attrValue(media, "url") ||
    decodeXml(imgSrc) ||
    undefined
  );
}

function normalizeDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

function externalItem(
  id: string,
  title: string,
  url: string,
  imageUrl: string | undefined,
  publishedAt: string
): UbalogNewsItem {
  const isDelivery = deliveryKeywords.some((keyword) =>
    title.toLowerCase().includes(keyword.toLowerCase())
  );

  return {
    id,
    source: "external",
    category: isDelivery ? "delivery" : "external",
    title,
    message: title,
    url,
    imageUrl,
    iconType: "news",
    publishedAt,
    createdAt: new Date().toISOString(),
  };
}

async function fetchRssNews(url: string) {
  const response = await fetch(url, { next: { revalidate: 900 } });
  if (!response.ok) return [];

  const xml = await response.text();
  const itemMatches = xml.match(/<item[\s\S]*?<\/item>/gi) ?? [];

  return itemMatches.slice(0, 30).map((itemXml, index) => {
    const title = tagValue(itemXml, "title");
    const link = tagValue(itemXml, "link");
    const pubDate = tagValue(itemXml, "pubDate");
    const guid = tagValue(itemXml, "guid") || link || `rss-${index}`;

    return externalItem(
      `external-${guid}`,
      title || "ニュース",
      link,
      rssImage(itemXml),
      normalizeDate(pubDate)
    );
  });
}

async function fetchJsonNews(provider: string, apiKey: string) {
  if (provider.toLowerCase() !== "gnews") return [];

  const url = new URL("https://gnews.io/api/v4/top-headlines");
  url.searchParams.set("lang", "ja");
  url.searchParams.set("country", "jp");
  url.searchParams.set("max", "20");
  url.searchParams.set("apikey", apiKey);

  const response = await fetch(url, { next: { revalidate: 900 } });
  if (!response.ok) return [];

  const data = (await response.json()) as {
    articles?: Array<{
      title?: string;
      url?: string;
      image?: string;
      publishedAt?: string;
    }>;
  };

  return (data.articles ?? []).map((article, index) =>
    externalItem(
      `external-gnews-${article.url ?? index}`,
      article.title ?? "ニュース",
      article.url ?? "",
      article.image,
      normalizeDate(article.publishedAt ?? "")
    )
  );
}

export async function GET() {
  const rssUrl = process.env.NEWS_RSS_URL;
  const apiKey = process.env.NEWS_API_KEY;
  const provider = process.env.NEWS_API_PROVIDER ?? "";

  try {
    if (rssUrl) {
      return NextResponse.json({ configured: true, items: await fetchRssNews(rssUrl) });
    }

    if (apiKey) {
      return NextResponse.json({ configured: true, items: await fetchJsonNews(provider, apiKey) });
    }

    return NextResponse.json({ configured: false, items: [] });
  } catch (error) {
    console.warn("[news] failed to fetch external news", error);
    return NextResponse.json({ configured: true, items: [] });
  }
}
