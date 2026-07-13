import { getMonthlyGoal, type MonthlyGoalPlan } from "@/lib/goals";

const NEWS_STORAGE_KEY = "ubalog-news";
const MAX_NEWS_ITEMS = 100;
const NEWS_UPDATED_EVENT = "ubalog-news-updated";

type ServiceKey = "uber" | "demae" | "menu" | "rocket" | "other";

export type UbalogNewsSource = "personal" | "external";

export type UbalogNewsCategory =
  | "all"
  | "personal"
  | "external"
  | "summary"
  | "goal"
  | "record"
  | "delivery"
  | "ranking"
  | "breaking";

export type NewsType =
  | "daily_record"
  | "monthly_best"
  | "all_time_best"
  | "weekly_best"
  | "weekly_delivery_best"
  | "monthly_delivery_best"
  | "daily_goal_achieved"
  | "weekly_goal_achieved"
  | "monthly_goal_achieved"
  | "weekly_summary"
  | "encouragement"
  | "ranking_top_update"
  | "area_top_update"
  | "breaking_record"
  | "breaking_realtime";

export type NewsAreaScope = "national" | "prefecture" | "region";

export type UbalogNewsItem = {
  id: string;
  source: UbalogNewsSource;
  category: UbalogNewsCategory;
  title: string;
  message?: string;
  url?: string;
  imageUrl?: string;
  iconType?:
    | "rank1"
    | "best"
    | "goal"
    | "delivery"
    | "record"
    | "news"
    | "cheer"
    | "summary"
    | "area"
    | "breaking";
  publishedAt: string;
  recordDate?: string;
  periodStart?: string;
  periodEnd?: string;
  areaScope?: NewsAreaScope;
  areaName?: string;
  periodType?: "today" | "yesterday";
  metric?: "sales";
  createdAt: string;
  type?: NewsType;
  summary?: {
    total: number;
    workMinutes: number;
    deliveries: number;
    hourly: number;
    averageDaily: number;
    unitPrice: number;
    workDays: number;
    previousTotal: number;
    previousRate: number | null;
    bestDate?: string;
    bestTotal?: number;
    comment: string;
  };
};

export type NewsRecord = {
  date?: string;
  name?: string;
  displayName?: string;
  rankingName?: string;
  nickname?: string;
  prefecture?: string;
  region?: string;
  ranking?: boolean;
  total?: number;
  workMinutes?: number;
  services?: Partial<Record<ServiceKey, { amount?: number; deliveries?: number }>>;
};

function safeDate(date?: string) {
  return typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : "";
}

function monthKey(date: string) {
  return date.slice(0, 7);
}

function toDate(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function toIsoDate(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function weekRange(date: string) {
  const base = toDate(date);
  const day = base.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const start = new Date(base);
  start.setDate(base.getDate() + diff);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return { start: toIsoDate(start), end: toIsoDate(end) };
}

function dateLabel(date: string) {
  const [, month, day] = date.split("-");
  return `${Number(month)}/${Number(day)}`;
}

export function isTodayDate(dateString: string) {
  return safeDate(dateString) === toIsoDate(new Date());
}

export function formatNewsDateLabel(dateString: string) {
  const date = safeDate(dateString);
  if (!date) return "この日";
  if (isTodayDate(date)) return "今日";

  const parsed = toDate(date);
  const currentYear = new Date().getFullYear();
  const monthDay = `${parsed.getMonth() + 1}月${parsed.getDate()}日`;
  return parsed.getFullYear() === currentYear
    ? monthDay
    : `${parsed.getFullYear()}年${monthDay}`;
}

function pickMessage(seed: string, messages: string[]) {
  const index = Math.abs(seed.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0));
  return messages[index % messages.length];
}

function recordTotal(record: NewsRecord) {
  return typeof record.total === "number" && Number.isFinite(record.total) ? record.total : 0;
}

function publishedTime(item: UbalogNewsItem) {
  return new Date(item.publishedAt || item.createdAt).getTime() || 0;
}

export function getRecordTotalDeliveries(record: NewsRecord) {
  const services = record.services ?? {};
  return (Object.keys(services) as ServiceKey[]).reduce((sum, key) => {
    const deliveries = services[key]?.deliveries;
    return sum + (typeof deliveries === "number" && Number.isFinite(deliveries) ? deliveries : 0);
  }, 0);
}

function validRecords(records: NewsRecord[]) {
  return records.filter((record) => safeDate(record.date));
}

export function isAllTimeBest(record: NewsRecord, records: NewsRecord[]) {
  const total = recordTotal(record);
  if (total <= 0) return false;
  return total >= Math.max(...validRecords(records).map(recordTotal), total);
}

export function isMonthlyBest(record: NewsRecord, records: NewsRecord[]) {
  const date = safeDate(record.date);
  if (!date) return false;
  const total = recordTotal(record);
  const monthly = validRecords(records).filter((item) => item.date?.startsWith(monthKey(date)));
  return total > 0 && total >= Math.max(...monthly.map(recordTotal), total);
}

export function isWeeklyBest(record: NewsRecord, records: NewsRecord[]) {
  const date = safeDate(record.date);
  if (!date) return false;
  const total = recordTotal(record);
  const range = weekRange(date);
  const weekly = validRecords(records).filter(
    (item) => item.date && item.date >= range.start && item.date <= range.end
  );
  return total > 0 && total >= Math.max(...weekly.map(recordTotal), total);
}

export function isMonthlyDeliveryBest(record: NewsRecord, records: NewsRecord[]) {
  const date = safeDate(record.date);
  if (!date) return false;
  const deliveries = getRecordTotalDeliveries(record);
  const monthly = validRecords(records).filter((item) => item.date?.startsWith(monthKey(date)));
  return deliveries > 0 && deliveries >= Math.max(...monthly.map(getRecordTotalDeliveries), deliveries);
}

export function isWeeklyDeliveryBest(record: NewsRecord, records: NewsRecord[]) {
  const date = safeDate(record.date);
  if (!date) return false;
  const deliveries = getRecordTotalDeliveries(record);
  const range = weekRange(date);
  const weekly = validRecords(records).filter(
    (item) => item.date && item.date >= range.start && item.date <= range.end
  );
  return deliveries > 0 && deliveries >= Math.max(...weekly.map(getRecordTotalDeliveries), deliveries);
}

export function getDailyGoalForDate(date: string) {
  if (typeof window === "undefined") return null;
  const plan = getMonthlyGoal(monthKey(date));
  return plan?.dailyGoals.find((goal) => goal.date === date)?.targetAmount ?? null;
}

export function isDailyGoalAchieved(record: NewsRecord) {
  const date = safeDate(record.date);
  if (!date) return false;
  const goal = getDailyGoalForDate(date);
  return typeof goal === "number" && goal > 0 && recordTotal(record) >= goal;
}

function monthlyGoalTotal(plan: MonthlyGoalPlan | null) {
  return plan?.dailyGoals.reduce((sum, goal) => sum + goal.targetAmount, 0) ?? 0;
}

export function isMonthlyGoalAchieved(date: string, records: NewsRecord[]) {
  if (typeof window === "undefined") return false;
  const month = monthKey(date);
  const plan = getMonthlyGoal(month);
  const target = monthlyGoalTotal(plan);
  if (target <= 0) return false;
  const actual = validRecords(records)
    .filter((record) => record.date?.startsWith(month))
    .reduce((sum, record) => sum + recordTotal(record), 0);
  return actual >= target;
}

function categoryForType(type: NewsType): UbalogNewsCategory {
  if (type === "weekly_summary") return "summary";
  if (type === "ranking_top_update" || type === "area_top_update") return "ranking";
  if (type === "breaking_record" || type === "breaking_realtime") return "breaking";
  if (type.includes("goal")) return "goal";
  if (type.includes("delivery")) return "delivery";
  return "record";
}

function iconForType(type: NewsType): UbalogNewsItem["iconType"] {
  if (type === "weekly_summary") return "summary";
  if (type === "ranking_top_update") return "rank1";
  if (type === "area_top_update") return "area";
  if (type === "breaking_record" || type === "breaking_realtime") return "breaking";
  if (type === "all_time_best") return "best";
  if (type.includes("best")) return "best";
  if (type.includes("goal")) return "goal";
  if (type.includes("delivery")) return "delivery";
  if (type === "encouragement") return "cheer";
  return "record";
}

function makeItem(recordDate: string, type: NewsType, title: string, message: string): UbalogNewsItem {
  const now = new Date().toISOString();
  return {
    id: `${recordDate}-${type}`,
    source: "personal",
    category: categoryForType(type),
    type,
    title,
    message,
    iconType: iconForType(type),
    publishedAt: now,
    recordDate,
    createdAt: now,
  };
}

function normalizeNewsItem(item: unknown): UbalogNewsItem | null {
  if (typeof item !== "object" || item === null) return null;
  const raw = item as Partial<UbalogNewsItem> & { date?: string };
  const createdAt = typeof raw.createdAt === "string" ? raw.createdAt : new Date().toISOString();
  const recordDate = typeof raw.recordDate === "string" ? raw.recordDate : raw.date;
  const type = raw.type;
  const message = typeof raw.message === "string" ? raw.message : raw.title;
  const title = typeof raw.title === "string" ? raw.title : message;

  if (!title || !message) return null;

  return {
    id: typeof raw.id === "string" ? raw.id : `${recordDate ?? createdAt}-${type ?? "news"}`,
    source: raw.source === "external" ? "external" : "personal",
    category: raw.category ?? (type ? categoryForType(type) : "record"),
    type,
    title,
    message,
    url: typeof raw.url === "string" ? raw.url : undefined,
    imageUrl: typeof raw.imageUrl === "string" ? raw.imageUrl : undefined,
    iconType: raw.iconType ?? (type ? iconForType(type) : "news"),
    publishedAt: typeof raw.publishedAt === "string" ? raw.publishedAt : createdAt,
    recordDate,
    periodStart: typeof raw.periodStart === "string" ? raw.periodStart : undefined,
    periodEnd: typeof raw.periodEnd === "string" ? raw.periodEnd : undefined,
    areaScope: raw.areaScope,
    areaName: typeof raw.areaName === "string" ? raw.areaName : undefined,
    periodType: raw.periodType,
    metric: raw.metric,
    createdAt,
    summary: raw.summary,
  };
}

export function getNewsItems(): UbalogNewsItem[] {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem(NEWS_STORAGE_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map(normalizeNewsItem)
      .filter((item): item is UbalogNewsItem => Boolean(item))
      .sort((a, b) => publishedTime(b) - publishedTime(a))
      .slice(0, MAX_NEWS_ITEMS);
  } catch {
    return [];
  }
}

export function saveNewsItems(items: UbalogNewsItem[]) {
  if (typeof window === "undefined") return;
  const normalized = items
    .sort((a, b) => publishedTime(b) - publishedTime(a))
    .slice(0, MAX_NEWS_ITEMS);
  localStorage.setItem(NEWS_STORAGE_KEY, JSON.stringify(normalized));
  window.dispatchEvent(new Event(NEWS_UPDATED_EVENT));
}

export function addNewsItem(item: UbalogNewsItem) {
  const current = getNewsItems();
  const next = [
    item,
    ...current.filter(
      (news) =>
        !(
          news.recordDate === item.recordDate &&
          news.type === item.type &&
          news.source === item.source
        )
    ),
  ];
  saveNewsItems(next);
}

function publicDisplayName(record: NewsRecord) {
  const name =
    record.displayName?.trim() ||
    record.name?.trim() ||
    record.rankingName?.trim() ||
    record.nickname?.trim() ||
    "";
  return name && name !== "匿名配達員" ? name : "";
}

function actorName(record: NewsRecord) {
  return publicDisplayName(record) || "誰か";
}

function normalizeRegionName(region?: string) {
  if (!region) return "";
  if (region === "九州四国") return "九州";
  return region;
}

function scopeLabel(scope: NewsAreaScope, areaName?: string) {
  if (scope === "national") return "全国";
  return normalizeRegionName(areaName) || "全国";
}

function newsPeriodType(date: string): "today" | "yesterday" | null {
  const today = toIsoDate(new Date());
  const yesterdayDate = new Date();
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterday = toIsoDate(yesterdayDate);
  if (date === today) return "today";
  if (date === yesterday) return "yesterday";
  return null;
}

function periodLabel(periodType: "today" | "yesterday") {
  return periodType === "today" ? "今日" : "昨日";
}

function topNewsKey(item: UbalogNewsItem) {
  return [
    item.type,
    item.recordDate,
    item.areaScope,
    item.areaName,
    item.periodType,
    item.metric,
  ].join("|");
}

function sameTopNews(a: UbalogNewsItem, b: UbalogNewsItem) {
  return (
    (a.type === "ranking_top_update" || a.type === "area_top_update") &&
    (b.type === "ranking_top_update" || b.type === "area_top_update") &&
    topNewsKey(a) === topNewsKey(b)
  );
}

function rankedSalesRecords(records: NewsRecord[], date: string, scope: NewsAreaScope, areaName?: string) {
  return validRecords(records)
    .filter((record) => {
      if (record.date !== date) return false;
      if (record.ranking === false) return false;
      if (recordTotal(record) <= 0) return false;
      if (scope === "national") return true;
      if (scope === "prefecture") return Boolean(areaName) && record.prefecture === areaName;
      return Boolean(areaName) && normalizeRegionName(record.region) === normalizeRegionName(areaName);
    })
    .sort((a, b) => recordTotal(b) - recordTotal(a));
}

function buildTopUpdateItem(
  record: NewsRecord,
  scope: NewsAreaScope,
  areaName: string | undefined,
  periodType: "today" | "yesterday"
): UbalogNewsItem {
  const now = new Date().toISOString();
  const date = safeDate(record.date) || toIsoDate(new Date());
  const type: NewsType = scope === "national" ? "ranking_top_update" : "area_top_update";
  const label = scopeLabel(scope, areaName);
  const name = publicDisplayName(record);
  const amount = formatCurrency(recordTotal(record));
  const title = `${periodLabel(periodType)}の${label}売上トップが更新されました！`;
  const message = name
    ? `${title}${name}さんが${amount}を記録🏆`
    : `${title}${amount}のナイス記録です🔥`;

  return {
    id: `${date}-${type}-${scope}-${normalizeRegionName(areaName) || "全国"}-sales`,
    source: "personal",
    category: "ranking",
    type,
    title,
    message,
    iconType: scope === "national" ? "rank1" : "area",
    publishedAt: now,
    recordDate: date,
    areaScope: scope,
    areaName: scope === "region" ? normalizeRegionName(areaName) : areaName,
    periodType,
    metric: "sales",
    createdAt: now,
  };
}

export function addTopUpdateNewsForRecord(record: NewsRecord, allRecords: NewsRecord[]) {
  const date = safeDate(record.date);
  if (!date || record.ranking === false || recordTotal(record) <= 0) return;

  const periodType = newsPeriodType(date);
  if (!periodType) return;

  const scopes: Array<{ scope: NewsAreaScope; areaName?: string }> = [{ scope: "national" }];
  if (record.prefecture?.trim()) {
    scopes.push({ scope: "prefecture", areaName: record.prefecture.trim() });
  }
  const region = normalizeRegionName(record.region);
  if (region) {
    scopes.push({ scope: "region", areaName: region });
  }

  const current = getNewsItems();
  const next = [...current];

  for (const target of scopes) {
    const top = rankedSalesRecords(allRecords, date, target.scope, target.areaName)[0];
    if (top !== record && recordTotal(top) !== recordTotal(record)) continue;

    const item = buildTopUpdateItem(record, target.scope, target.areaName, periodType);
    const index = next.findIndex((news) => sameTopNews(news, item));
    if (index >= 0) {
      next[index] = { ...next[index], ...item, id: next[index].id, createdAt: next[index].createdAt };
    } else {
      next.unshift(item);
    }
  }

  saveNewsItems(next);
}

function upsertBreakingNews(item: UbalogNewsItem) {
  const next = [item, ...getNewsItems().filter((news) => news.type !== item.type)];
  saveNewsItems(next);
}

export function addBreakingRecordNews(record: NewsRecord) {
  const date = safeDate(record.date);
  if (!date || record.ranking === false || recordTotal(record) <= 0) return;
  const now = new Date().toISOString();
  const name = actorName(record);
  upsertBreakingNews({
    id: "breaking-record-latest",
    source: "personal",
    category: "breaking",
    type: "breaking_record",
    title: `${name}が売上を記録しました⚡`,
    message: `${name}が売上を記録しました⚡`,
    iconType: "breaking",
    publishedAt: now,
    recordDate: date,
    createdAt: now,
  });
}

export function addBreakingRealtimeNews(input: { name?: string; amount?: number; service?: string }) {
  if (!input.service?.trim()) return;
  if (!input.amount || input.amount <= 0) return;
  const now = new Date().toISOString();
  const cleanName = input.name?.trim();
  const name = cleanName && cleanName !== "匿名配達員" ? cleanName : "誰か";
  upsertBreakingNews({
    id: "breaking-realtime-latest",
    source: "personal",
    category: "breaking",
    type: "breaking_realtime",
    title: `${name}がリアルタイム投稿しました🛵`,
    message: `${name}がリアルタイム投稿しました🛵`,
    iconType: "breaking",
    publishedAt: now,
    createdAt: now,
  });
}

export function generateNewsForRecord(record: NewsRecord, allRecords: NewsRecord[]): UbalogNewsItem[] {
  const date = safeDate(record.date);
  if (!date) return [];

  const items: UbalogNewsItem[] = [];
  const label = dateLabel(date);

  if (isAllTimeBest(record, allRecords)) {
    items.push(
      makeItem(
        date,
        "all_time_best",
        "最高記録",
        pickMessage(`${date}-all_time_best`, [
          "過去一の売上記録を更新しました！すごいです🏆",
          "自己ベスト更新！これは大きい記録です🥇",
          "過去最高売上を更新しました！めちゃくちゃ良い日です🔥",
          "最高記録を塗り替えました！おめでとうございます🎉",
        ])
      )
    );
  }
  if (isMonthlyBest(record, allRecords)) {
    items.push(
      makeItem(
        date,
        "monthly_best",
        "今月の最高記録",
        pickMessage(`${date}-monthly_best`, [
          `${label}、今月の最高記録を更新しました！🏆`,
          "今月ベストの売上です！ナイス記録です👏",
          "今月最高売上を更新！かなり良いペースです🚀",
        ])
      )
    );
  }
  if (isDailyGoalAchieved(record)) {
    const goalDateLabel = formatNewsDateLabel(date);
    items.push(
      makeItem(
        date,
        "daily_goal_achieved",
        "目標達成",
        pickMessage(`${date}-daily_goal_achieved`, [
          `${goalDateLabel}の目標を達成しました！おめでとう！🎉`,
          `${goalDateLabel}の目標クリア！かなりいい流れです🔥`,
          `${goalDateLabel}の目標達成！積み上げが形になっています👏`,
          `${goalDateLabel}の目標を超えました！ナイス稼働です🚀`,
          `${goalDateLabel}の目標クリア！この調子でいきましょう💪`,
        ])
      )
    );
  }
  if (isMonthlyGoalAchieved(date, allRecords)) {
    items.push(
      makeItem(
        date,
        "monthly_goal_achieved",
        "目標達成",
        pickMessage(`${date}-monthly_goal_achieved`, [
          "今月の目標を達成しました！おめでとう！🎉",
          "今月目標クリア！積み上げがしっかり形になっています👏",
          "今月の目標を超えました！かなり良い流れです🚀",
        ])
      )
    );
  }
  if (isWeeklyBest(record, allRecords)) {
    items.push(
      makeItem(
        date,
        "weekly_best",
        "今週の最高記録",
        pickMessage(`${date}-weekly_best`, [
          "今週の最高売上を更新しました！🏆",
          "今週ベストの売上です！ナイス稼働です👏",
          "今週最高売上を更新！いいペースです🚀",
        ])
      )
    );
  }
  if (isMonthlyDeliveryBest(record, allRecords)) {
    items.push(
      makeItem(
        date,
        "monthly_delivery_best",
        "件数",
        pickMessage(`${date}-monthly_delivery_best`, [
          `${label}は件数もかなり伸びました！ナイス配達です🛵`,
          "今月で一番多い件数でした！よく走りました👏",
          "件数をしっかり積めた日でした！いい走りです🔥",
        ])
      )
    );
  }
  if (isWeeklyDeliveryBest(record, allRecords)) {
    items.push(
      makeItem(
        date,
        "weekly_delivery_best",
        "件数",
        pickMessage(`${date}-weekly_delivery_best`, [
          "今週最多件数です！積み上げがすごいです🔥",
          "今週で一番多い件数でした！ナイス配達です🛵",
          "件数が伸びた良い記録です！よく走りました👏",
        ])
      )
    );
  }
  if (items.length === 0) {
    items.push(createPositiveNewsForRecord(record, allRecords));
  }

  return items.slice(0, 3);
}

export function createPositiveNewsForRecord(record: NewsRecord, allRecords: NewsRecord[]): UbalogNewsItem {
  void allRecords;
  const date = safeDate(record.date) || toIsoDate(new Date());
  const messages = [
    "今日も記録できました。積み上げナイスです👏",
    "稼働記録を残せました。おつかれさまでした📝",
    "一歩ずつ記録が増えています。いい流れです✨",
    "今日の売上をしっかり残せました！ナイスです👍",
    "継続できています。これが一番大事です💪",
  ];
  return makeItem(date, "encouragement", "記録", pickMessage(`${date}-encouragement`, messages));
}

export function addNewsForRecord(record: NewsRecord, allRecords: NewsRecord[]) {
  const generated = generateNewsForRecord(record, allRecords);
  const current = getNewsItems();
  const next = [...current];

  for (const item of generated) {
    const index = next.findIndex(
      (news) =>
        news.recordDate === item.recordDate &&
        news.type === item.type &&
        news.source === item.source
    );
    if (index >= 0) {
      next[index] = { ...next[index], ...item, id: next[index].id };
    } else {
      next.unshift(item);
    }
  }

  saveNewsItems(next);
}

function recordWorkMinutes(record: NewsRecord) {
  return typeof record.workMinutes === "number" && Number.isFinite(record.workMinutes)
    ? record.workMinutes
    : 0;
}

function inRange(record: NewsRecord, start: string, end: string) {
  const date = safeDate(record.date);
  return date >= start && date <= end;
}

function formatMonthDay(date: string) {
  const [, month, day] = date.split("-");
  return `${Number(month)}/${Number(day)}`;
}

function formatCurrency(value: number) {
  return `¥${Math.floor(value).toLocaleString()}`;
}

export function formatWeeklyWorkTime(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return `${hours}:${String(rest).padStart(2, "0")}`;
}

export function getWeekRange(date: Date) {
  const base = new Date(date);
  const day = base.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const start = new Date(base);
  start.setDate(base.getDate() + diff);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return { start: toIsoDate(start), end: toIsoDate(end) };
}

export function getPreviousWeekRange(referenceDate: Date) {
  const date = new Date(referenceDate);
  date.setDate(date.getDate() - 7);
  return getWeekRange(date);
}

function weeklyComment(previousRate: number | null, deliveries: number, hourly: number, workMinutes: number) {
  if (previousRate !== null && previousRate >= 20) {
    return "先週より大きく伸びています！めっちゃ頑張りました🔥";
  }
  if (previousRate !== null && previousRate >= 5) {
    return "先週よりしっかり伸びています！いい流れです👏";
  }
  if (deliveries >= 50) return "件数をしっかり積めた週でした。走り切りましたね🛵";
  if (hourly >= 2500) return "時給がかなり良い週でした。案件選びがうまくいっています👍";
  if (workMinutes >= 1500) return "稼働時間も十分。かなり粘り強く積み上げました💪";
  return "今週も記録を残せました。次につながるデータです📝";
}

export function generateWeeklySummaryNews(records: NewsRecord[], referenceDate = new Date()): UbalogNewsItem | null {
  const range = getPreviousWeekRange(referenceDate);
  const previousReference = toDate(range.start);
  previousReference.setDate(previousReference.getDate() - 1);
  const previousRange = getWeekRange(previousReference);
  const weeklyRecords = validRecords(records).filter((record) => inRange(record, range.start, range.end));
  if (weeklyRecords.length === 0) return null;

  const total = weeklyRecords.reduce((sum, record) => sum + recordTotal(record), 0);
  const workMinutes = weeklyRecords.reduce((sum, record) => sum + recordWorkMinutes(record), 0);
  const deliveries = weeklyRecords.reduce((sum, record) => sum + getRecordTotalDeliveries(record), 0);
  const workDays = weeklyRecords.length;
  const hourly = workMinutes > 0 ? Math.floor(total / (workMinutes / 60)) : 0;
  const averageDaily = workDays > 0 ? Math.floor(total / workDays) : 0;
  const unitPrice = deliveries > 0 ? Math.floor(total / deliveries) : 0;
  const previousTotal = validRecords(records)
    .filter((record) => inRange(record, previousRange.start, previousRange.end))
    .reduce((sum, record) => sum + recordTotal(record), 0);
  const previousRate = previousTotal > 0 ? Math.round(((total - previousTotal) / previousTotal) * 100) : null;
  const bestRecord = [...weeklyRecords].sort((a, b) => recordTotal(b) - recordTotal(a))[0];
  const comment = weeklyComment(previousRate, deliveries, hourly, workMinutes);
  const title = `${formatMonthDay(range.start)}〜${formatMonthDay(range.end)} 週間サマリー`;
  const rateText = previousRate === null ? "" : `、先週比${previousRate >= 0 ? "+" : ""}${previousRate}%`;
  const message = `${title}：売上${formatCurrency(total)}、配達${deliveries}件、時給${formatCurrency(hourly)}${rateText}！ ${comment}`;
  const now = new Date().toISOString();

  return {
    id: `weekly-summary-${range.start}-${range.end}`,
    source: "personal",
    category: "summary",
    type: "weekly_summary",
    title,
    message,
    iconType: "summary",
    publishedAt: now,
    periodStart: range.start,
    periodEnd: range.end,
    createdAt: now,
    summary: {
      total,
      workMinutes,
      deliveries,
      hourly,
      averageDaily,
      unitPrice,
      workDays,
      previousTotal,
      previousRate,
      bestDate: bestRecord?.date,
      bestTotal: bestRecord ? recordTotal(bestRecord) : undefined,
      comment,
    },
  };
}

export function upsertWeeklySummaryNews(records: NewsRecord[], referenceDate = new Date()) {
  const item = generateWeeklySummaryNews(records, referenceDate);
  if (!item) return null;

  const current = getNewsItems();
  const next = [...current];
  const index = next.findIndex(
    (news) =>
      news.type === "weekly_summary" &&
      news.periodStart === item.periodStart &&
      news.periodEnd === item.periodEnd
  );

  if (index >= 0) {
    next[index] = { ...next[index], ...item, id: next[index].id, createdAt: next[index].createdAt };
  } else {
    next.unshift(item);
  }

  saveNewsItems(next);
  return item;
}

export function regenerateNewsFromRecords(records: NewsRecord[]) {
  const items: UbalogNewsItem[] = [];
  const preserved = getNewsItems().filter(
    (item) =>
      item.type === "breaking_record" ||
      item.type === "breaking_realtime" ||
      item.type === "ranking_top_update" ||
      item.type === "area_top_update" ||
      item.type === "weekly_summary"
  );
  const sorted = validRecords(records).sort((a, b) => ((a.date ?? "") > (b.date ?? "") ? 1 : -1));

  for (const record of sorted) {
    items.unshift(...generateNewsForRecord(record, sorted).slice(0, 1));
  }

  saveNewsItems([...preserved, ...items]);
  return getNewsItems();
}
