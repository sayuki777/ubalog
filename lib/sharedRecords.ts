import { collection, getDocs, setDoc, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { safeParseJson } from "@/lib/storage";

export const SHARED_RECORDS_COLLECTION = "ubalog_records";
export const DEVICE_ID_STORAGE_KEY = "ubalog-device-id";
export const RECORDS_STORAGE_KEY = "ubalog-records";
const RECORD_WRITE_GUARD_MS = 1500;
let lastRecordWriteAt = 0;

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
  firestoreId?: string;
  hidden?: boolean;
  hiddenAt?: string;
  hiddenReason?: string;
};

function createDeviceId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `device-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function clampNumber(value: unknown, min: number, max: number) {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) return min;
  return Math.min(max, Math.max(min, Math.round(numberValue)));
}

function trimText(value: unknown, maxLength: number) {
  if (typeof value !== "string") return undefined;
  const trimmed = value.replace(/[\r\n\t]+/g, " ").trim();
  if (!trimmed) return undefined;
  return trimmed.slice(0, maxLength);
}

function isRecordDate(value: unknown) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function cleanObject<T extends Record<string, unknown>>(value: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined)
  ) as Partial<T>;
}

function sanitizeServices(record: SharedRecord) {
  const source = record.services ?? {};
  const next: SharedRecord["services"] = {};

  for (const [key, service] of Object.entries(source)) {
    if (!service || typeof service !== "object") continue;
    next[key] = {
      amount: clampNumber(service.amount, 0, 300000),
      deliveries: clampNumber(service.deliveries, 0, 500),
    };
  }

  return next;
}

export function sanitizeSharedRecord(record: SharedRecord, withDeviceId = false) {
  if (!isRecordDate(record.date)) return null;

  const next = cleanObject({
    ...record,
    date: record.date,
    deviceId: record.deviceId || (withDeviceId ? getDeviceId() : undefined),
    displayName: trimText(record.displayName, 20),
    name: trimText(record.name, 20),
    rankingName: trimText(record.rankingName, 20),
    nickname: trimText(record.nickname, 20),
    prefecture: trimText(record.prefecture, 20),
    region: trimText(record.region, 20),
    area: trimText(record.area, 30),
    comment: trimText(record.comment, 25),
    total: clampNumber(record.total, 0, 300000),
    hourly: clampNumber(record.hourly, 0, 100000),
    workMinutes: clampNumber(record.workMinutes, 0, 1440),
    breakMinutes: clampNumber(record.breakMinutes, 0, 1440),
    startTime: trimText(record.startTime, 8),
    endTime: trimText(record.endTime, 8),
    services: sanitizeServices(record),
    createdAt: trimText(record.createdAt, 40),
    updatedAt: trimText(record.updatedAt, 40),
    firestoreId: trimText(record.firestoreId, 120),
    hidden: record.hidden === true ? true : undefined,
    hiddenAt: trimText(record.hiddenAt, 40),
    hiddenReason: trimText(record.hiddenReason, 80),
  }) as SharedRecord;

  return next;
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
  const parsed = safeParseJson<SharedRecord[]>(
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

export async function fetchSharedRecords() {
  if (!db) return [];

  try {
    const snapshot = await getDocs(collection(db, SHARED_RECORDS_COLLECTION));
    return snapshot.docs
      .map((item) => ({ ...(item.data() as SharedRecord), firestoreId: item.id }))
      .filter((record) => record.hidden !== true);
  } catch {
    return [];
  }
}

export async function hideSharedRecord(record: SharedRecord, reason = "admin_hidden") {
  if (!db) return;
  const sanitized = sanitizeSharedRecord({
    ...record,
    hidden: true,
    hiddenAt: new Date().toISOString(),
    hiddenReason: reason,
  });
  if (!sanitized) return;

  const targetId = record.firestoreId || recordDocId(sanitized);
  try {
    await setDoc(doc(db, SHARED_RECORDS_COLLECTION, targetId), sanitized, {
      merge: true,
    });
  } catch {
    // Firestore is best-effort. The local hidden state still removes it here.
  }
}

export async function upsertSharedRecord(record: SharedRecord) {
  if (!db) return;
  const now = Date.now();
  if (now - lastRecordWriteAt < RECORD_WRITE_GUARD_MS) return;

  const next = sanitizeSharedRecord(record, true);
  if (!next || next.hidden === true) return;
  lastRecordWriteAt = now;
  try {
    await setDoc(doc(db, SHARED_RECORDS_COLLECTION, recordDocId(next)), next, {
      merge: true,
    });
  } catch {
    // Firestore is best-effort. localStorage remains the source for this device.
  }
}

function normalizeMergeText(value?: string) {
  return value?.replace(/[\r\n\t]+/g, " ").trim() || "";
}

function mergeKeys(record: SharedRecord) {
  const date = record.date;
  const total = String(record.total ?? 0);
  const keys = [
    record.deviceId ? `device:${record.deviceId}:${date}` : "",
    record.userId ? `user:${record.userId}:${date}` : "",
    normalizeMergeText(record.displayName)
      ? `display:${normalizeMergeText(record.displayName)}:${date}:${total}`
      : "",
    normalizeMergeText(record.name)
      ? `name:${normalizeMergeText(record.name)}:${date}:${total}`
      : "",
    normalizeMergeText(record.rankingName)
      ? `ranking:${normalizeMergeText(record.rankingName)}:${date}:${total}`
      : "",
  ].filter(Boolean);

  return keys.length > 0 ? keys : [`anonymous:${date}:${total}`];
}

function recordTime(record: SharedRecord) {
  return new Date(record.updatedAt || record.createdAt || "").getTime() || 0;
}

function chooseNewerRecord(current: SharedRecord | undefined, next: SharedRecord) {
  if (!current) return next;
  return recordTime(next) >= recordTime(current) ? next : current;
}

export function mergeRecords(
  localRecords: SharedRecord[],
  remoteRecords: SharedRecord[]
) {
  const merged = new Map<string, SharedRecord>();
  const aliases = new Map<string, string>();

  const addRecord = (record: SharedRecord) => {
    const sanitized = sanitizeSharedRecord(record);
    if (!sanitized || sanitized.hidden === true) return;

    const keys = mergeKeys(sanitized);
    const primaryKey =
      keys.map((key) => aliases.get(key)).find(Boolean) ?? keys[0];
    const next = chooseNewerRecord(merged.get(primaryKey), sanitized);
    merged.set(primaryKey, next);
    keys.forEach((key) => aliases.set(key, primaryKey));
  };

  for (const record of remoteRecords) {
    addRecord(record);
  }
  for (const record of localRecords) {
    addRecord(record);
  }

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
