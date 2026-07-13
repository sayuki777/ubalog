const BACKUP_VERSION = "1.0";

const STORAGE_KEYS = {
  records: "ubalog-records",
  profile: "ubalog-profile",
  users: "ubalog-users",
  activeUserId: "ubalog-active-user",
  goals: "ubalog-goals",
  news: "ubalog-news",
  realtimeOffers: "ubalog-realtime-offers",
  rocketNowScanFeedbacks: "ubalog-rocketnow-scan-feedbacks",
  mood: "ubalog-mood",
  highlightUpdates: "ubalog-highlight-updates",
} as const;

export type UbalogBackupData = {
  version: string;
  exportedAt: string;
  records: unknown[];
  profile: unknown | null;
  users: unknown[];
  activeUserId: string | null;
  goals: unknown[];
  news: unknown[];
  realtimeOffers: unknown[];
  rocketNowScanFeedbacks: unknown[];
  mood: Record<string, unknown>;
  highlightUpdates: unknown | null;
};

function readJsonValue<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;

  const raw = localStorage.getItem(key);
  if (!raw) return fallback;

  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function readStringValue(key: string) {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(key);
}

function writeJsonValue(key: string, value: unknown) {
  localStorage.setItem(key, JSON.stringify(value));
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function todayFileDate() {
  return new Date().toISOString().slice(0, 10);
}

export function createUbalogBackup(): UbalogBackupData {
  return {
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    records: readJsonValue<unknown[]>(STORAGE_KEYS.records, []),
    profile: readJsonValue<unknown | null>(STORAGE_KEYS.profile, null),
    users: readJsonValue<unknown[]>(STORAGE_KEYS.users, []),
    activeUserId: readStringValue(STORAGE_KEYS.activeUserId),
    goals: readJsonValue<unknown[]>(STORAGE_KEYS.goals, []),
    news: readJsonValue<unknown[]>(STORAGE_KEYS.news, []),
    realtimeOffers: readJsonValue<unknown[]>(STORAGE_KEYS.realtimeOffers, []),
    rocketNowScanFeedbacks: readJsonValue<unknown[]>(
      STORAGE_KEYS.rocketNowScanFeedbacks,
      []
    ),
    mood: readJsonValue<Record<string, unknown>>(STORAGE_KEYS.mood, {}),
    highlightUpdates: readJsonValue<unknown | null>(
      STORAGE_KEYS.highlightUpdates,
      null
    ),
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
  if (!Array.isArray(data.records)) return false;
  if (!("profile" in data)) return false;
  if (!Array.isArray(data.users)) return false;
  if (
    data.activeUserId !== null &&
    typeof data.activeUserId !== "string" &&
    typeof data.activeUserId !== "undefined"
  ) {
    return false;
  }
  if ("goals" in data && !Array.isArray(data.goals)) return false;
  if ("news" in data && !Array.isArray(data.news)) return false;
  if (!Array.isArray(data.realtimeOffers)) return false;
  if (!Array.isArray(data.rocketNowScanFeedbacks)) return false;
  if ("mood" in data && !isPlainObject(data.mood)) return false;
  if ("highlightUpdates" in data && data.highlightUpdates !== null) {
    if (!isPlainObject(data.highlightUpdates)) return false;
  }

  return true;
}

export function restoreUbalogBackup(data: UbalogBackupData) {
  localStorage.setItem(STORAGE_KEYS.records, JSON.stringify(data.records));

  if (data.profile === null) {
    localStorage.removeItem(STORAGE_KEYS.profile);
  } else {
    writeJsonValue(STORAGE_KEYS.profile, data.profile);
  }

  writeJsonValue(STORAGE_KEYS.users, data.users);

  if (data.activeUserId) {
    localStorage.setItem(STORAGE_KEYS.activeUserId, data.activeUserId);
  } else {
    localStorage.removeItem(STORAGE_KEYS.activeUserId);
  }

  writeJsonValue(STORAGE_KEYS.goals, data.goals ?? []);
  writeJsonValue(STORAGE_KEYS.news, data.news ?? []);
  writeJsonValue(STORAGE_KEYS.realtimeOffers, data.realtimeOffers);
  writeJsonValue(
    STORAGE_KEYS.rocketNowScanFeedbacks,
    data.rocketNowScanFeedbacks
  );
  writeJsonValue(STORAGE_KEYS.mood, data.mood ?? {});

  if (data.highlightUpdates === null || typeof data.highlightUpdates === "undefined") {
    localStorage.removeItem(STORAGE_KEYS.highlightUpdates);
  } else {
    writeJsonValue(STORAGE_KEYS.highlightUpdates, data.highlightUpdates);
  }
}
