"use client";

import Link from "next/link";
import {
  affiliateMessageFor,
  canShowAffiliateAd,
  pickAffiliateAd,
  type AffiliateAd,
} from "@/lib/affiliateAds";

type AffiliateMiniAdProps = {
  ad?: AffiliateAd | null;
  placement: string;
  slot?: number;
  driverWeight?: number;
  excludeIds?: string[];
};

export default function AffiliateMiniAd({
  ad,
  placement,
  slot = 0,
  driverWeight,
  excludeIds,
}: AffiliateMiniAdProps) {
  const selected =
    ad ??
    pickAffiliateAd({
      placement,
      slot,
      driverWeight,
      excludeIds,
    });

  if (!selected || !canShowAffiliateAd(selected)) return null;

  const message = affiliateMessageFor(selected, `${placement}:${slot}`);
  const content = (
    <div className="flex items-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50/80 px-3 py-2 text-left shadow-sm active:bg-emerald-100">
      <span className="shrink-0 rounded-full bg-white px-1.5 py-0.5 text-[9px] font-black text-emerald-700">
        PR
      </span>
      <span className="min-w-0 flex-1 truncate text-[11px] font-black text-gray-800">
        {message}
      </span>
      <span className="shrink-0 text-sm font-black text-emerald-700">›</span>
    </div>
  );

  if (selected.internal) {
    return (
      <Link href={selected.url} className="block">
        {content}
      </Link>
    );
  }

  return (
    <a href={selected.url} target="_blank" rel="noopener noreferrer" className="block">
      {content}
    </a>
  );
}
