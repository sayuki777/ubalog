import { collection, getDocs, setDoc, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";

export const SHARED_RECORDS_COLLECTION = "ubalog_records";
export const DEVICE_ID_STORAGE_KEY = "ubalog-device-id";
export const RECORDS_STORAGE_KEY = "ubalog-records";

export type SharedRecord = {
  date: string;
  userId?: string;
  displayName?: string;
  name?: string;
  rankingName?: string;
  nickname?: string;
  prefecture?: string;
  region?: string;
  area?: string;
  comment?: string;
  total: number;
  ranking?: boolean;
  hourly?: number;
  workMinutes?: number;
  startTime?: string;
  endTime?: string;
  breakMinutes?: number;
  services?: Record<string, { amount: number; deliveries: number }>;
  createdAt?: string;
  updatedAt?: string;
  deviceId?: string;
};

function safeJsonParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function createDeviceId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `device-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function getDeviceId() {
  if (typeof window === "undefined") return "server";

  const current = localStorage.getItem(DEVICE_ID_STORAGE_KEY);
  if (current) return current;

  const next = createDeviceId();
  localStorage.setItem(DEVICE_ID_STORAGE_KEY, next);
  return next;
}

export function loadLocalRecords() {
  if (typeof window === "undefined") return [];
  const parsed = safeJsonParse<SharedRecord[]>(
    localStorage.getItem(RECORDS_STORAGE_KEY),
    []
  );
  return Array.isArray(parsed) ? parsed : [];
}

export function saveLocalRecords(records: SharedRecord[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(RECORDS_STORAGE_KEY, JSON.stringify(records));
}

function recordDocId(record: SharedRecord) {
  const deviceId = record.deviceId || getDeviceId();
  return `${deviceId}_${record.date}`;
}

function normalizeRecord(record: SharedRecord): SharedRecord {
  return {
    ...record,
    deviceId: record.deviceId || getDeviceId(),
  };
}

export async function fetchSharedRecords() {
  if (!db) return [];

  try {
    const snapshot = await getDocs(collection(db, SHARED_RECORDS_COLLECTION));
    return snapshot.docs.map((item) => item.data() as SharedRecord);
  } catch {
    return [];
  }
}

export async function upsertSharedRecord(record: SharedRecord) {
  if (!db) return;

  const next = normalizeRecord(record);
  try {
    await setDoc(doc(db, SHARED_RECORDS_COLLECTION, recordDocId(next)), next, {
      merge: true,
    });
  } catch {
    // Firestore is best-effort. localStorage remains the source for this device.
  }
}

function mergeKey(record: SharedRecord) {
  return `${record.deviceId || record.userId || record.name || "anonymous"}_${record.date}`;
}

export function mergeRecords(
  localRecords: SharedRecord[],
  remoteRecords: SharedRecord[]
) {
  const merged = new Map<string, SharedRecord>();

  for (const record of remoteRecords) merged.set(mergeKey(record), record);
  for (const record of localRecords) merged.set(mergeKey(normalizeRecord(record)), normalizeRecord(record));

  return [...merged.values()].sort((a, b) => (a.date < b.date ? 1 : -1));
}

export async function syncRecordsFromFirestore() {
  const localRecords = loadLocalRecords();
  const remoteRecords = await fetchSharedRecords();
  const merged = mergeRecords(localRecords, remoteRecords);
  saveLocalRecords(merged);
  return merged;
}

export async function saveRecordWithSync(record: SharedRecord) {
  await upsertSharedRecord(record);
}

