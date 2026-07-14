export type AffiliateAdCategory = "driver" | "customer";

export type AffiliateAd = {
  id: string;
  category: AffiliateAdCategory;
  title: string;
  messages: string[];
  url: string;
  internal?: boolean;
};

const FORCE_AFFILIATE_ADS_KEY = "ubalog-force-affiliate-ads";

export const affiliateAds: AffiliateAd[] = [
  {
    id: "uber-driver",
    category: "driver",
    title: "Uber Eats 配達員",
    url: "https://www.uber.com/signup/drive/deliver/?invite_code=8yxjv31",
    messages: [
      "Uber Eats配達員を始めてみる",
      "スキマ時間で配達を始めるならUber Eats",
      "配達デビューならUber Eatsもチェック",
      "Uber Eats配達員登録はこちら",
    ],
  },
  {
    id: "rocketnow-driver",
    category: "driver",
    title: "ロケットナウ配達員",
    url: "https://rocketnowdriver.app.link/eYcxjFhF53b",
    messages: [
      "ロケットナウ配達員もチェック",
      "新しい配達サービスを試してみる",
      "ロケットナウで配達を始める",
      "キャンペーン時はロケットナウも狙い目",
    ],
  },
  {
    id: "menu-driver",
    category: "driver",
    title: "menu配達員",
    url: "/recruit",
    internal: true,
    messages: [
      "menu配達員の招待コードを確認",
      "menu登録前にコードをコピー",
      "menu配達員を始めるならこちら",
      "招待コード WZJ437 を確認",
    ],
  },
  {
    id: "uber-coupon",
    category: "customer",
    title: "Uber Eats クーポン",
    url: "https://ubereats.com/feed?promoCode=eats-3wka2w",
    messages: [
      "Uber Eatsの割引クーポンを受け取ろう",
      "今日のごはんをUber Eatsでお得に",
      "Uber Eatsクーポンをチェック",
      "配達後のごほうびにUber Eats",
    ],
  },
  {
    id: "rocketnow-coupon",
    category: "customer",
    title: "ロケットナウ クーポン",
    url: "https://share.rocketnow.co.jp/fA9nEGxZJ4b",
    messages: [
      "今日だけのロケットナウを自宅で受け取ろう",
      "ロケットナウのクーポンをチェック",
      "ロケットナウでお得に注文してみる",
      "配達後はロケットナウでひと休み",
    ],
  },
  {
    id: "menu-coupon",
    category: "customer",
    title: "menu クーポン",
    url: "https://me.nu/fu5lj36",
    messages: [
      "menuのクーポンをチェック",
      "今日のごはんをmenuでお得に",
      "menuで使えるクーポンはこちら",
      "配達後のごはんにmenuクーポン",
    ],
  },
];

function readForceFlag() {
  if (typeof window === "undefined") return false;

  try {
    return localStorage.getItem(FORCE_AFFILIATE_ADS_KEY) === "true";
  } catch {
    return false;
  }
}

export function shouldShowCustomerAffiliateAds() {
  return true;
}

export function shouldShowDriverAffiliateAds(now = new Date()) {
  if (readForceFlag()) return true;
  const start = new Date(now.getFullYear(), 7, 1);
  return now >= start;
}

export function shouldShowAffiliateAds(now = new Date()) {
  return shouldShowCustomerAffiliateAds() || shouldShowDriverAffiliateAds(now);
}

export function canShowAffiliateAd(ad: AffiliateAd, now = new Date()) {
  return ad.category === "customer"
    ? shouldShowCustomerAffiliateAds()
    : shouldShowDriverAffiliateAds(now);
}

function dateSeed(now = new Date()) {
  return `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
}

function hashText(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function pickBySeed<T>(items: T[], seed: string) {
  if (items.length === 0) return null;
  return items[hashText(seed) % items.length];
}

export function affiliateMessageFor(ad: AffiliateAd, seed: string) {
  return pickBySeed(ad.messages, `${seed}:${ad.id}:message`) ?? ad.messages[0] ?? ad.title;
}

export function pickAffiliateAd({
  placement,
  slot = 0,
  driverWeight = 0.5,
  excludeIds = [],
  now = new Date(),
}: {
  placement: string;
  slot?: number;
  driverWeight?: number;
  excludeIds?: string[];
  now?: Date;
}) {
  const seed = `${dateSeed(now)}:${placement}:${slot}`;
  const available = affiliateAds.filter(
    (ad) => !excludeIds.includes(ad.id) && canShowAffiliateAd(ad, now)
  );
  if (available.length === 0) return null;

  const shouldPickDriver = (hashText(`${seed}:category`) % 100) < driverWeight * 100;
  const category: AffiliateAdCategory = shouldPickDriver ? "driver" : "customer";
  const categoryAds = available.filter((ad) => ad.category === category);
  const pool = categoryAds.length > 0 ? categoryAds : available;

  return pickBySeed(pool, `${seed}:ad`);
}
