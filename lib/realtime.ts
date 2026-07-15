import { collection, deleteDoc, doc, getDocs, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { getDeviceId } from "@/lib/sharedRecords";
import { safeParseJson } from "@/lib/storage";

export const REALTIME_OFFERS_COLLECTION = "ubalog_realtime_offers";
export const REALTIME_OFFERS_STORAGE_KEY = "ubalog-realtime-offers";
export const REALTIME_LAST_POST_STORAGE_KEY = "ubalog-realtime-last-post-at";
const REALTIME_POST_GUARD_MS = 5000;
const validServices = new Set(["Uber", "出前館", "ロケナウ", "menu"]);
const validRanks = new Set(["S", "A", "B", "C"]);

export type SharedRealtimeOffer = {
  id: string;
  createdAt: string;
  name?: string;
  area: string;
  service: string;
  amount: number;
  distanceKm: number;
  unitPrice: number;
  rank: string;
  comment: string;
  shopName?: string;
  dropoffArea?: string;
  lat?: number;
  lng?: number;
  deviceId?: string;
  hidden?: boolean;
  hiddenAt?: string;
  hiddenReason?: string;
  [key: string]: unknown;
};

export function loadLocalRealtimeOffers() {
  if (typeof window === "undefined") return [];
  const parsed = safeParseJson<SharedRealtimeOffer[]>(
    localStorage.getItem(REALTIME_OFFERS_STORAGE_KEY),
    []
  );
  return Array.isArray(parsed) ? parsed : [];
}

export function saveLocalRealtimeOffers(offers: SharedRealtimeOffer[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(REALTIME_OFFERS_STORAGE_KEY, JSON.stringify(offers));
}

function clampNumber(value: unknown, min: number, max: number) {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) return null;
  return Math.min(max, Math.max(min, numberValue));
}

function trimText(value: unknown, maxLength: number) {
  if (typeof value !== "string") return undefined;
  const trimmed = value.replace(/[\r\n\t]+/g, " ").trim();
  if (!trimmed) return undefined;
  return trimmed.slice(0, maxLength);
}

function cleanObject<T extends Record<string, unknown>>(value: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined)
  ) as Partial<T>;
}

export function canPostRealtimeOfferNow(now = Date.now()) {
  if (typeof window === "undefined") return true;
  const previous = Number(localStorage.getItem(REALTIME_LAST_POST_STORAGE_KEY));
  return !Number.isFinite(previous) || now - previous >= REALTIME_POST_GUARD_MS;
}

export function markRealtimeOfferPosted(now = Date.now()) {
  if (typeof window === "undefined") return;
  localStorage.setItem(REALTIME_LAST_POST_STORAGE_KEY, String(now));
}

export function createRealtimeOfferId(now = Date.now()) {
  return `${getDeviceId()}_${now}_${Math.random().toString(36).slice(2, 10)}`;
}

export function sanitizeRealtimeOffer(offer: SharedRealtimeOffer) {
  const amount = clampNumber(offer.amount, 1, 50000);
  const distanceKm = clampNumber(offer.distanceKm, 0.1, 100);
  const unitPrice = clampNumber(offer.unitPrice, 0, 100000);
  const lat = typeof offer.lat === "number" && Number.isFinite(offer.lat) ? offer.lat : undefined;
  const lng = typeof offer.lng === "number" && Number.isFinite(offer.lng) ? offer.lng : undefined;

  if (amount === null || distanceKm === null || unitPrice === null) return null;
  if (!validServices.has(offer.service)) return null;
  if (!validRanks.has(offer.rank)) return null;

  return cleanObject({
    ...offer,
    id: trimText(offer.id, 100) || createRealtimeOfferId(),
    deviceId: trimText(offer.deviceId, 80) || getDeviceId(),
    createdAt: trimText(offer.createdAt, 40) || new Date().toISOString(),
    name: trimText(offer.name, 20),
    area: trimText(offer.area, 40) || "",
    service: offer.service,
    amount: Math.round(amount),
    distanceKm: Math.round(distanceKm * 10) / 10,
    unitPrice: Math.round(unitPrice),
    rank: offer.rank,
    comment: trimText(offer.comment, 80) || "",
    shopName: trimText(offer.shopName, 40),
    dropoffArea: trimText(offer.dropoffArea, 40),
    hidden: offer.hidden === true ? true : undefined,
    hiddenAt: trimText(offer.hiddenAt, 40),
    hiddenReason: trimText(offer.hiddenReason, 80),
    lat,
    lng,
  }) as SharedRealtimeOffer;
}

export async function fetchSharedRealtimeOffers() {
  if (!db) return [];

  try {
    const snapshot = await getDocs(collection(db, REALTIME_OFFERS_COLLECTION));
    return snapshot.docs
      .map((item) => item.data() as SharedRealtimeOffer)
      .filter((offer) => offer.hidden !== true);
  } catch {
    return [];
  }
}

export async function upsertSharedRealtimeOffer(offer: SharedRealtimeOffer) {
  if (!db) return;
  const sanitized = sanitizeRealtimeOffer(offer);
  if (!sanitized || sanitized.hidden === true) return;

  try {
    await setDoc(doc(db, REALTIME_OFFERS_COLLECTION, sanitized.id), sanitized, {
      merge: true,
    });
  } catch {
    // Firestore is best-effort. localStorage keeps the posted offer on this device.
  }
}

export async function hideSharedRealtimeOffer(id: string, reason = "admin_hidden") {
  if (!db) return;

  try {
    await setDoc(
      doc(db, REALTIME_OFFERS_COLLECTION, id),
      {
        hidden: true,
        hiddenAt: new Date().toISOString(),
        hiddenReason: reason,
      },
      { merge: true }
    );
  } catch {
    // Firestore is best-effort. The local hidden state still removes it here.
  }
}

export async function deleteSharedRealtimeOffer(id: string) {
  if (!db) return;

  try {
    await deleteDoc(doc(db, REALTIME_OFFERS_COLLECTION, id));
  } catch {
    // localStorage deletion still applies on this device.
  }
}

export function mergeRealtimeOffers(
  localOffers: SharedRealtimeOffer[],
  remoteOffers: SharedRealtimeOffer[]
) {
  const merged = new Map<string, SharedRealtimeOffer>();
  const softKeys = new Set<string>();
  for (const offer of [...remoteOffers, ...localOffers]) {
    const sanitized = sanitizeRealtimeOffer(offer);
    if (!sanitized || sanitized.hidden === true) continue;
    const createdAtMs = new Date(sanitized.createdAt).getTime() || 0;
    const softKey = [
      sanitized.service,
      sanitized.amount,
      sanitized.distanceKm,
      Math.floor(createdAtMs / 10000),
    ].join("_");
    if (!merged.has(sanitized.id) && softKeys.has(softKey)) continue;
    merged.set(sanitized.id, sanitized);
    softKeys.add(softKey);
  }
  return [...merged.values()].sort((a, b) =>
    a.createdAt < b.createdAt ? 1 : -1
  );
}

export async function syncRealtimeOffersFromFirestore() {
  const localOffers = loadLocalRealtimeOffers();
  const remoteOffers = await fetchSharedRealtimeOffers();
  const merged = mergeRealtimeOffers(localOffers, remoteOffers);
  saveLocalRealtimeOffers(merged);
  return merged;
}
