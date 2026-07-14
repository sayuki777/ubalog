import { collection, deleteDoc, doc, getDocs, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

export const REALTIME_OFFERS_COLLECTION = "ubalog_realtime_offers";
export const REALTIME_OFFERS_STORAGE_KEY = "ubalog-realtime-offers";

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
  [key: string]: unknown;
};

function safeJsonParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function loadLocalRealtimeOffers() {
  if (typeof window === "undefined") return [];
  const parsed = safeJsonParse<SharedRealtimeOffer[]>(
    localStorage.getItem(REALTIME_OFFERS_STORAGE_KEY),
    []
  );
  return Array.isArray(parsed) ? parsed : [];
}

export function saveLocalRealtimeOffers(offers: SharedRealtimeOffer[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(REALTIME_OFFERS_STORAGE_KEY, JSON.stringify(offers));
}

export async function fetchSharedRealtimeOffers() {
  if (!db) return [];

  try {
    const snapshot = await getDocs(collection(db, REALTIME_OFFERS_COLLECTION));
    return snapshot.docs.map((item) => item.data() as SharedRealtimeOffer);
  } catch {
    return [];
  }
}

export async function upsertSharedRealtimeOffer(offer: SharedRealtimeOffer) {
  if (!db) return;

  try {
    await setDoc(doc(db, REALTIME_OFFERS_COLLECTION, offer.id), offer, {
      merge: true,
    });
  } catch {
    // Firestore is best-effort. localStorage keeps the posted offer on this device.
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
  for (const offer of remoteOffers) merged.set(offer.id, offer);
  for (const offer of localOffers) merged.set(offer.id, offer);
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
