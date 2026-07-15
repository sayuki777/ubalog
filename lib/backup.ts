const BACKUP_VERSION = "2.0";
const STORAGE_PREFIX = "ubalog-";
const RECORDS_STORAGE_KEY = "ubalog-records";
const REALTIME_OFFERS_STORAGE_KEY = "ubalog-realtime-offers";

export type UbalogBackupData = {
  version: string;
  exportedAt: string;
  storage: Record<string, string>;
  records?: unknown[];
  profile?: unknown | null;
  users?: unknown[];
  activeUserId?: string | null;
  goals?: unknown[];
  news?: unknown[];
  realtimeOffers?: unknown[];
  rocketNowScanFeedbacks?: unknown[];
  mood?: Record<string, unknown>;
  highlightUpdates?: unknown | null;
};

export type UbalogBackupSummary = {
  recordCount: number;
  realtimeOfferCount: number;
  keyCount: number;
  exportedAt: string;
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function safeJsonParse<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;

  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function todayFileDate() {
  return new Date().toISOString().slice(0, 10);
}

function shouldExportValue(value: string) {
  const trimmed = value.trimStart();
  if (trimmed.startsWith("data:image/")) return false;
  if (trimmed.startsWith("data:video/")) return false;
  return true;
}

function collectUbalogStorage() {
  const storage: Record<string, string> = {};
  if (typeof window === "undefined") return storage;

  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (!key?.startsWith(STORAGE_PREFIX)) continue;

    const value = localStorage.getItem(key);
    if (typeof value !== "string") continue;
    if (!shouldExportValue(value)) continue;
    storage[key] = value;
  }

  return storage;
}

function getBackupStorage(data: UbalogBackupData) {
  if (isPlainObject(data.storage)) {
    return Object.fromEntries(
      Object.entries(data.storage).filter(
        ([key, value]) => key.startsWith(STORAGE_PREFIX) && typeof value === "string",
      ),
    ) as Record<string, string>;
  }

  const legacyStorage: Record<string, string> = {};
  const legacyEntries: Array<[string, unknown]> = [
    [RECORDS_STORAGE_KEY, data.records],
    ["ubalog-profile", data.profile],
    ["ubalog-users", data.users],
    ["ubalog-active-user", data.activeUserId],
    ["ubalog-goals", data.goals],
    ["ubalog-news", data.news],
    [REALTIME_OFFERS_STORAGE_KEY, data.realtimeOffers],
    ["ubalog-rocketnow-scan-feedbacks", data.rocketNowScanFeedbacks],
    ["ubalog-mood", data.mood],
    ["ubalog-highlight-updates", data.highlightUpdates],
  ];

  for (const [key, value] of legacyEntries) {
    if (typeof value === "undefined") continue;
    if (value === null) continue;
    legacyStorage[key] =
      typeof value === "string" ? value : JSON.stringify(value);
  }

  return legacyStorage;
}

function readArrayFromStorage<T>(key: string): T[] {
  if (typeof window === "undefined") return [];
  const parsed = safeJsonParse<unknown>(localStorage.getItem(key), []);
  return Array.isArray(parsed) ? (parsed as T[]) : [];
}

function writeJsonStorage(key: string, value: unknown) {
  localStorage.setItem(key, JSON.stringify(value));
}

function dateTimeValue(value: unknown) {
  if (typeof value !== "string") return 0;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
}

function recordKey(record: Record<string, unknown>) {
  if (typeof record.id === "string" && record.id.trim()) return `id:${record.id}`;
  if (typeof record.deviceId === "string" && typeof record.date === "string") {
    return `device-date:${record.deviceId}:${record.date}`;
  }
  if (typeof record.userId === "string" && typeof record.date === "string") {
    return `user-date:${record.userId}:${record.date}`;
  }

  const date = typeof record.date === "string" ? record.date : "";
  const displayName =
    typeof record.displayName === "string"
      ? record.displayName
      : typeof record.name === "string"
        ? record.name
        : "";
  const total = Number(record.total) || 0;
  return `soft:${date}:${displayName}:${total}`;
}

function isUsableRecord(value: unknown): value is Record<string, unknown> {
  if (!isPlainObject(value)) return false;
  return typeof value.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value.date);
}

function mergeRecords(current: unknown[], incoming: unknown[]) {
  const merged = new Map<string, Record<string, unknown>>();

  for (const record of [...current, ...incoming]) {
    if (!isUsableRecord(record)) continue;
    const key = recordKey(record);
    const existing = merged.get(key);
    if (!existing) {
      merged.set(key, record);
      continue;
    }

    const existingTime = dateTimeValue(existing.updatedAt);
    const nextTime = dateTimeValue(record.updatedAt);
    if (nextTime >= existingTime) {
      merged.set(key, record);
    }
  }

  return [...merged.values()].sort((a, b) => {
    const dateA = typeof a.date === "string" ? a.date : "";
    const dateB = typeof b.date === "string" ? b.date : "";
    return dateA < dateB ? 1 : -1;
  });
}

function offerKey(offer: Record<string, unknown>) {
  if (typeof offer.id === "string" && offer.id.trim()) return `id:${offer.id}`;

  const createdAt = typeof offer.createdAt === "string" ? offer.createdAt : "";
  const service = typeof offer.service === "string" ? offer.service : "";
  const amount = Number(offer.amount) || 0;
  const distanceKm = Number(offer.distanceKm) || 0;
  return `soft:${createdAt}:${service}:${amount}:${distanceKm}`;
}

function isUsableOffer(value: unknown): value is Record<string, unknown> {
  if (!isPlainObject(value)) return false;
  if (value.hidden === true) return false;
  return Boolean(value.id || value.createdAt);
}

function mergeRealtimeOffers(current: unknown[], incoming: unknown[]) {
  const merged = new Map<string, Record<string, unknown>>();

  for (const offer of [...current, ...incoming]) {
    if (!isUsableOffer(offer)) continue;
    const key = offerKey(offer);
    const existing = merged.get(key);
    if (!existing) {
      merged.set(key, offer);
      continue;
    }

    const existingTime = dateTimeValue(existing.createdAt);
    const nextTime = dateTimeValue(offer.createdAt);
    if (nextTime >= existingTime) {
      merged.set(key, offer);
    }
  }

  return [...merged.values()].sort((a, b) =>
    dateTimeValue(a.createdAt) < dateTimeValue(b.createdAt) ? 1 : -1,
  );
}

export function createUbalogBackup(): UbalogBackupData {
  return {
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    storage: collectUbalogStorage(),
  };
}

export function downloadUbalogBackup() {
  const backup = createUbalogBackup();
  const json = JSON.stringify(backup, null, 2);
  const blob = new Blob([json], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = `ubalog-backup-${todayFileDate()}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function validateUbalogBackup(data: unknown): data is UbalogBackupData {
  if (!isPlainObject(data)) return false;
  if (typeof data.version !== "string") return false;
  if (typeof data.exportedAt !== "string") return false;

  if ("storage" in data) {
    if (!isPlainObject(data.storage)) return false;
    return Object.entries(data.storage).every(
      ([key, value]) => key.startsWith(STORAGE_PREFIX) && typeof value === "string",
    );
  }

  return Array.isArray(data.records) || Array.isArray(data.realtimeOffers);
}

export function getUbalogBackupSummary(data: UbalogBackupData): UbalogBackupSummary {
  const storage = getBackupStorage(data);
  const records = safeJsonParse<unknown[]>(storage[RECORDS_STORAGE_KEY], []);
  const realtimeOffers = safeJsonParse<unknown[]>(
    storage[REALTIME_OFFERS_STORAGE_KEY],
    [],
  );

  return {
    recordCount: Array.isArray(records) ? records.length : 0,
    realtimeOfferCount: Array.isArray(realtimeOffers) ? realtimeOffers.length : 0,
    keyCount: Object.keys(storage).length,
    exportedAt: data.exportedAt,
  };
}

export function restoreUbalogBackup(data: UbalogBackupData) {
  const storage = getBackupStorage(data);

  for (const [key, value] of Object.entries(storage)) {
    if (!key.startsWith(STORAGE_PREFIX)) continue;

    if (key === RECORDS_STORAGE_KEY) {
      const currentRecords = readArrayFromStorage<unknown>(RECORDS_STORAGE_KEY);
      const incomingRecords = safeJsonParse<unknown[]>(value, []);
      writeJsonStorage(
        RECORDS_STORAGE_KEY,
        mergeRecords(currentRecords, Array.isArray(incomingRecords) ? incomingRecords : []),
      );
      continue;
    }

    if (key === REALTIME_OFFERS_STORAGE_KEY) {
      const currentOffers = readArrayFromStorage<unknown>(REALTIME_OFFERS_STORAGE_KEY);
      const incomingOffers = safeJsonParse<unknown[]>(value, []);
      writeJsonStorage(
        REALTIME_OFFERS_STORAGE_KEY,
        mergeRealtimeOffers(currentOffers, Array.isArray(incomingOffers) ? incomingOffers : []),
      );
      continue;
    }

    localStorage.setItem(key, value);
  }

  window.dispatchEvent(new Event("ubalog-records-updated"));
  window.dispatchEvent(new Event("ubalog-profile-updated"));
}
