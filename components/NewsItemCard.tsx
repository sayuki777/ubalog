"use client";

import Link from "next/link";
import { useState } from "react";
import type { UbalogNewsItem } from "@/lib/news";

function iconContent(iconType: UbalogNewsItem["iconType"]) {
  if (iconType === "rank1") return "🥇";
  if (iconType === "best") return "🏆";
  if (iconType === "goal") return "🎯";
  if (iconType === "delivery") return "🛵";
  if (iconType === "area") return "📍";
  if (iconType === "breaking") return "⚡";
  if (iconType === "record") return "📝";
  if (iconType === "cheer") return "👏";
  if (iconType === "summary") return "📊";
  return "📰";
}

function categoryLabel(item: UbalogNewsItem) {
  if (item.source === "external") return "外部";
  if (item.type === "weekly_summary") return "週間";
  if (item.type === "ranking_top_update" || item.type === "area_top_update") return "ランキング";
  if (item.category === "breaking") return "速報";
  if (item.category === "ranking") return "ランキング";
  if (item.category === "goal") return "目標";
  if (item.category === "delivery") return "配達";
  return "記録";
}

function formatCurrency(value: number) {
  return `¥${Math.floor(value).toLocaleString()}`;
}

function formatWorkTime(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return `${hours}:${String(rest).padStart(2, "0")}`;
}

function formatDate(iso: string) {
  const date = new Date(iso);
  if (!Number.isNaN(date.getTime())) return `${date.getMonth() + 1}/${date.getDate()}`;

  const [, month, day] = iso.split("-");
  return month && day ? `${Number(month)}/${Number(day)}` : "";
}

function isNew(item: UbalogNewsItem) {
  const time = new Date(item.publishedAt || item.createdAt).getTime();
  return Number.isFinite(time) && Date.now() - time < 1000 * 60 * 60 * 24;
}

function shortRankingTitle(item: UbalogNewsItem) {
  if (item.source === "external") return item.message || item.title;
  if (item.type === "ranking_top_update") return "トップ更新！次は君";
  if (item.type === "area_top_update") return "エリア王更新！";
  if (item.type === "breaking_record" && item.category === "breaking") {
    return "売上記録きた！";
  }
  return item.message || item.title;
}

function Thumb({ item }: { item: UbalogNewsItem }) {
  if (item.imageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={item.imageUrl}
        alt=""
        className="h-14 w-14 rounded-xl object-cover"
        loading="lazy"
      />
    );
  }

  return (
    <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-green-50 text-2xl">
      {iconContent(item.iconType)}
    </div>
  );
}

function Body({ item }: { item: UbalogNewsItem }) {
  const isBreaking = item.category === "breaking";
  const title = shortRankingTitle(item);
  return (
    <div className={`flex min-w-0 gap-3 border-b border-gray-100 ${isBreaking ? "py-2" : "py-3"}`}>
      <Thumb item={item} />
      <div className="min-w-0 flex-1">
        <div className={`line-clamp-2 font-bold leading-5 text-gray-900 ${isBreaking ? "text-[13px]" : "text-sm"}`}>
          {title}
        </div>
        {item.type === "weekly_summary" && item.summary && (
          <div className="mt-2 grid grid-cols-3 gap-1 text-[11px] font-bold text-gray-600">
            <span className="rounded-lg bg-gray-50 px-2 py-1">
              売上 {formatCurrency(item.summary.total)}
            </span>
            <span className="rounded-lg bg-gray-50 px-2 py-1">
              稼働 {formatWorkTime(item.summary.workMinutes)}
            </span>
            <span className="rounded-lg bg-gray-50 px-2 py-1">
              件数 {item.summary.deliveries}
            </span>
            <span className="rounded-lg bg-gray-50 px-2 py-1">
              日給 {formatCurrency(item.summary.averageDaily)}
            </span>
            <span className="rounded-lg bg-gray-50 px-2 py-1">
              単価 {formatCurrency(item.summary.unitPrice)}
            </span>
            <span className="rounded-lg bg-gray-50 px-2 py-1">
              時給 {formatCurrency(item.summary.hourly)}
            </span>
          </div>
        )}
        <div className="mt-2 flex items-center gap-2 text-[11px] font-bold text-gray-500">
          <span>{categoryLabel(item)}</span>
          <span>{formatDate(item.publishedAt || item.recordDate || item.createdAt)}</span>
          {isNew(item) && (
            <span className="rounded-full bg-green-100 px-2 py-0.5 text-green-700">
              NEW
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function AdminHideNewsButton({ onHide }: { onHide: () => void }) {
  const [confirming, setConfirming] = useState(false);

  if (confirming) {
    return (
      <div className="mb-2 rounded-xl border border-red-100 bg-red-50 px-3 py-2">
        <div className="text-xs font-bold text-red-700">このニュースを非表示にしますか？</div>
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            onClick={() => setConfirming(false)}
            className="h-8 flex-1 rounded-lg bg-white text-xs font-bold text-gray-600 ring-1 ring-gray-200"
          >
            キャンセル
          </button>
          <button
            type="button"
            onClick={onHide}
            className="h-8 flex-1 rounded-lg bg-red-600 text-xs font-bold text-white"
          >
            非表示
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-2 flex justify-end">
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="rounded-full bg-red-50 px-3 py-1.5 text-xs font-bold text-red-600 ring-1 ring-red-100"
      >
        非表示
      </button>
    </div>
  );
}

export default function NewsItemCard({
  item,
  isAdmin = false,
  onHide,
}: {
  item: UbalogNewsItem;
  isAdmin?: boolean;
  onHide?: (item: UbalogNewsItem) => void;
}) {
  const adminButton =
    isAdmin && onHide ? <AdminHideNewsButton onHide={() => onHide(item)} /> : null;

  if (item.source === "external" && item.url) {
    return (
      <div>
        <a href={item.url} target="_blank" rel="noopener noreferrer" className="block">
          <Body item={item} />
        </a>
        {adminButton}
      </div>
    );
  }

  if (item.type === "breaking_realtime") {
    const href = item.offerId
      ? `/realtime?offerId=${encodeURIComponent(item.offerId)}`
      : "/realtime";

    return (
      <div>
        <Link href={href} className="block">
          <Body item={item} />
        </Link>
        {adminButton}
      </div>
    );
  }

  if (item.recordDate) {
    return (
      <div>
        <Link href={`/record?date=${item.recordDate}`} className="block">
          <Body item={item} />
        </Link>
        {adminButton}
      </div>
    );
  }

  return (
    <div>
      <Body item={item} />
      {adminButton}
    </div>
  );
}
