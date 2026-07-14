import {
  readUbalogRecords,
  writeUbalogRecords,
  type UbalogStoredRecord,
} from "@/lib/records";

export const ROCKETNOW_BULK_IMPORT_HISTORY_KEY =
  "ubalog-rocketnow-bulk-import-history";
export const ROCKETNOW_BULK_IMPORT_HISTORY_UPDATED_EVENT =
  "ubalog-rocketnow-bulk-import-history-updated";

export type RocketNowBulkHistoryItem = {
  date: string;
  beforeRecord: UbalogStoredRecord | null;
  afterRecord: UbalogStoredRecord;
  importedRocketAmount: number;
  importedRocketDeliveries: number;
};

export type RocketNowBulkImportHistory = {
  id: string;
  createdAt: string;
  importedCount: number;
  totalAmount: number;
  totalDeliveries: number;
  items: RocketNowBulkHistoryItem[];
};

function totalFromRecord(record: UbalogStoredRecord) {
  return Object.values(record.services).reduce(
    (sum, service) => sum + service.amount,
    0
  );
}

function hourlyFromRecord(record: UbalogStoredRecord) {
  if (!record.workMinutes) return 0;
  return Math.floor(record.total / (record.workMinutes / 60));
}

export function readRocketNowBulkImportHistory(): RocketNowBulkImportHistory[] {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem(ROCKETNOW_BULK_IMPORT_HISTORY_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as RocketNowBulkImportHistory[]) : [];
  } catch {
    return [];
  }
}

export function saveRocketNowBulkImportHistory(entry: RocketNowBulkImportHistory) {
  const history = [entry, ...readRocketNowBulkImportHistory()].slice(0, 20);
  localStorage.setItem(ROCKETNOW_BULK_IMPORT_HISTORY_KEY, JSON.stringify(history));
  window.dispatchEvent(new Event(ROCKETNOW_BULK_IMPORT_HISTORY_UPDATED_EVENT));
}

export function restoreLatestRocketNowBulkImport() {
  const [latest, ...rest] = readRocketNowBulkImportHistory();
  if (!latest) return { history: null, records: readUbalogRecords() };

  const records = readUbalogRecords();
  const byDate = new Map(records.map((record) => [record.date, record]));
  const now = new Date().toISOString();

  for (const item of latest.items) {
    const current = byDate.get(item.date);
    if (!current) continue;

    const beforeRocket = item.beforeRecord?.services.rocket ?? {
      amount: 0,
      deliveries: 0,
    };
    const next: UbalogStoredRecord = {
      ...current,
      services: {
        ...current.services,
        rocket: beforeRocket,
      },
      updatedAt: now,
    };
    next.total = totalFromRecord(next);
    next.hourly = hourlyFromRecord(next);
    byDate.set(item.date, next);
  }

  const nextRecords = [...byDate.values()].sort((a, b) =>
    a.date < b.date ? 1 : -1
  );
  writeUbalogRecords(nextRecords);
  localStorage.setItem(
    ROCKETNOW_BULK_IMPORT_HISTORY_KEY,
    JSON.stringify(rest.slice(0, 20))
  );
  window.dispatchEvent(new Event(ROCKETNOW_BULK_IMPORT_HISTORY_UPDATED_EVENT));

  return { history: latest, records: nextRecords };
}
