export const ONBOARDING_DISMISSED_KEY = "ubalog-onboarding-dismissed";
export const RECORD_GUIDE_DISMISSED_KEY = "ubalog-record-guide-dismissed";
export const PROFILE_GUIDE_DISMISSED_KEY = "ubalog-profile-guide-dismissed";

export function readStorageBoolean(key: string) {
  if (typeof window === "undefined") return false;

  const raw = localStorage.getItem(key);
  if (!raw) return false;

  try {
    return JSON.parse(raw) === true;
  } catch {
    return raw === "true";
  }
}

export function writeStorageBoolean(key: string, value: boolean) {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, JSON.stringify(value));
}
