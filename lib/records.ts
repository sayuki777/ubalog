export const UBALOG_RECORDS_STORAGE_KEY = "ubalog-records";

export function isRecordDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}
