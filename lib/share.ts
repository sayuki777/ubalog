type RecordShareLike = {
  total?: number;
  workMinutes?: number;
  hourly?: number;
};

type RocketNowShareLike = {
  monthAmount: number;
  monthDeliveries: number;
  monthUnitPrice: number | null;
};

type RealtimeOfferShareLike = {
  service?: string;
  amount: number;
  distanceKm: number;
  unitPrice: number;
};

function yen(value: number) {
  return `¥${Math.max(0, Math.floor(value)).toLocaleString()}`;
}

function workTime(minutes?: number) {
  const safeMinutes = Math.max(0, minutes ?? 0);
  if (safeMinutes === 0) return "";
  const h = Math.floor(safeMinutes / 60);
  const m = safeMinutes % 60;
  return `${h}:${String(m).padStart(2, "0")}`;
}

export function getShareUrl() {
  return "https://ubalog.vercel.app";
}

export function buildRecordShareText(record: RecordShareLike) {
  const lines = [
    "今日のフーデリ記録",
    `売上 ${yen(record.total ?? 0)}`,
  ];

  const worked = workTime(record.workMinutes);
  if (worked) lines.push(`稼働 ${worked}`);
  if (record.hourly && record.hourly > 0) lines.push(`時給 ${yen(record.hourly)}`);

  return [
    ...lines,
    "",
    "ウバログで記録中",
    "#ウバログ #フードデリバリー",
  ].join("\n");
}

export function buildUbalogShareText() {
  return [
    "配達記録アプリ",
    "「ウバログ」",
    "",
    "🏆 全国・都道府県別、エリア別",
    "🏆 売り上げ、時給、件数別",
    "🗺 リアルタイム報酬共有",
    "④ 目標応援ギャル「ユリア」搭載検討中)",
    "",
    "ホーム画面にショートカット作って、",
    "高報酬エリアに行こうぜ〜！！",
    "",
    "#ウバログ #フードデリバリー",
    "https://ubalog.vercel.app",
  ].join("\n");
}

export function buildRocketNowShareText(stats: RocketNowShareLike) {
  const lines = [
    "今月のロケナウ記録",
    `売上 ${yen(stats.monthAmount)}`,
    `配達 ${stats.monthDeliveries.toLocaleString()}件`,
  ];

  if (stats.monthUnitPrice !== null) {
    lines.push(`1件単価 ${yen(stats.monthUnitPrice)}`);
  }

  return [
    ...lines,
    "",
    "ウバログで記録中 🚀",
    "#ウバログ #ロケナウ",
  ].join("\n");
}

export function buildRealtimeOfferShareText(offer: RealtimeOfferShareLike) {
  return [
    `${offer.service || "フーデリ"}の高報酬案件を共有しました！`,
    `報酬 ${yen(offer.amount)} / ${offer.distanceKm.toLocaleString()}km`,
    `参考 ${yen(offer.unitPrice)}/km`,
    "",
    "ウバログでリアルタイム共有中",
    "#ウバログ #フードデリバリー",
    "https://ubalog.vercel.app",
  ].join("\n");
}

export function buildRankingShareText() {
  return [
    "ウバログのランキング更新中！",
    "今日の配達記録をみんなで共有しています。",
    "",
    "次は自分もTOP入りを狙う！",
    "",
    "#ウバログ #フードデリバリー",
  ].join("\n");
}

export function openXShare(text: string, url = getShareUrl()) {
  if (typeof window === "undefined") return;

  const params = new URLSearchParams({ text });
  if (url && !text.includes(url)) {
    params.set("url", url);
  }
  window.open(`https://twitter.com/intent/tweet?${params.toString()}`, "_blank", "noopener,noreferrer");
}
