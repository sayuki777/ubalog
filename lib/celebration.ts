const CELEBRATION_STORAGE_KEY = "ubalog-celebrations";

export function rememberCelebration(key: string) {
  if (typeof window === "undefined") return;
  const current = readCelebrations();
  localStorage.setItem(
    CELEBRATION_STORAGE_KEY,
    JSON.stringify([{ key, createdAt: new Date().toISOString() }, ...current].slice(0, 30))
  );
}

export function readCelebrations(): { key: string; createdAt: string }[] {
  if (typeof window === "undefined") return [];

  try {
    const parsed = JSON.parse(localStorage.getItem(CELEBRATION_STORAGE_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
