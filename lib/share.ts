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

function yen(value: number) {
  return `¥${Math.max(0, value).toLocaleString()}`;
}

function workTime(minutes?: number) {
  const safeMinutes = Math.max(0, minutes ?? 0);
  if (safeMinutes === 0) return "";
  const h = Math.floor(safeMinutes / 60);
  const m = safeMinutes % 60;
  return `${h}:${String(m).padStart(2, "0")}`;
}

export function getShareUrl() {
  if (typeof window !== "undefined" && window.location.origin) {
    return window.location.origin;
  }
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
    "配達員向け売上記録アプリ「ウバログ」公開中！",
    "",
    "売上記録、ランキング、ニュース、リアルタイム共有ができます。",
    "フーデリ配達員の記録にどうぞ。",
    "",
    "#ウバログ #フードデリバリー",
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

  const params = new URLSearchParams({
    text,
    url,
  });
  window.open(`https://twitter.com/intent/tweet?${params.toString()}`, "_blank", "noopener,noreferrer");
}
