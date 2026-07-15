export function safeParseJson<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;

  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function loadStorageArray<T>(key: string): T[] {
  if (typeof window === "undefined") return [];
  const parsed = safeParseJson<unknown>(window.localStorage.getItem(key), []);
  return Array.isArray(parsed) ? (parsed as T[]) : [];
}

export function loadStorageObject<T extends Record<string, unknown>>(
  key: string,
  fallback: T
): T {
  if (typeof window === "undefined") return fallback;
  const parsed = safeParseJson<unknown>(window.localStorage.getItem(key), fallback);
  return parsed && typeof parsed === "object" && !Array.isArray(parsed)
    ? ({ ...fallback, ...parsed } as T)
    : fallback;
}
