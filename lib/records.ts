export const UBALOG_RECORDS_STORAGE_KEY = "ubalog-records";
export const UBALOG_RECORDS_UPDATED_EVENT = "ubalog-records-updated";

export function isRecordDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export type UbalogServiceRecord = {
  amount: number;
  deliveries: number;
};

export type UbalogStoredRecord = {
  date: string;
  userId?: string;
  name?: string;
  prefecture?: string;
  region?: string;
  area?: string;
  comment?: string;
  total: number;
  ranking: boolean;
  hourly: number;
  workMinutes: number;
  startTime: string;
  endTime: string;
  breakMinutes: number;
  services: {
    uber: UbalogServiceRecord;
    demae: UbalogServiceRecord;
    menu: UbalogServiceRecord;
    rocket: UbalogServiceRecord;
    other: UbalogServiceRecord;
  };
  createdAt: string;
  updatedAt: string;
};

export type RocketBulkRecordInput = {
  date: string;
  amount: number;
  deliveries: number;
};

export type RocketBulkRecordProfile = {
  userId?: string;
  name?: string;
  prefecture?: string;
  region?: string;
  area?: string;
};

function emptyService(): UbalogServiceRecord {
  return { amount: 0, deliveries: 0 };
}

function totalFromServices(record: UbalogStoredRecord) {
  return Object.values(record.services).reduce(
    (sum, service) => sum + service.amount,
    0
  );
}

function hourlyFromRecord(record: UbalogStoredRecord) {
  if (!record.workMinutes) return 0;
  return Math.floor(record.total / (record.workMinutes / 60));
}

export function readUbalogRecords() {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem(UBALOG_RECORDS_STORAGE_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as UbalogStoredRecord[]) : [];
  } catch {
    return [];
  }
}

export function writeUbalogRecords(records: UbalogStoredRecord[]) {
  localStorage.setItem(UBALOG_RECORDS_STORAGE_KEY, JSON.stringify(records));
  window.dispatchEvent(new Event(UBALOG_RECORDS_UPDATED_EVENT));
}

export function upsertRocketBulkRecords(
  items: RocketBulkRecordInput[],
  profile: RocketBulkRecordProfile,
  now = new Date().toISOString()
) {
  const records = readUbalogRecords();
  const byDate = new Map(records.map((record) => [record.date, record]));

  for (const item of items) {
    if (!isRecordDate(item.date)) continue;

    const existing = byDate.get(item.date);
    const next: UbalogStoredRecord = existing
      ? {
          ...existing,
          services: {
            ...existing.services,
            rocket: {
              amount: item.amount,
              deliveries: item.deliveries,
            },
          },
          updatedAt: now,
        }
      : {
          date: item.date,
          userId: profile.userId,
          name: profile.name,
          prefecture: profile.prefecture,
          region: profile.region,
          area: profile.area,
          comment: "",
          startTime: "",
          endTime: "",
          breakMinutes: 0,
          services: {
            uber: emptyService(),
            demae: emptyService(),
            menu: emptyService(),
            rocket: {
              amount: item.amount,
              deliveries: item.deliveries,
            },
            other: emptyService(),
          },
          total: 0,
          workMinutes: 0,
          hourly: 0,
          ranking: true,
          createdAt: now,
          updatedAt: now,
        };

    next.total = totalFromServices(next);
    next.hourly = hourlyFromRecord(next);
    byDate.set(item.date, next);
  }

  const nextRecords = [...byDate.values()].sort((a, b) =>
    a.date < b.date ? 1 : -1
  );
  writeUbalogRecords(nextRecords);
  return nextRecords;
}
