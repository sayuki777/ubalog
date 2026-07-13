const HIGHLIGHT_STORAGE_KEY = "ubalog-highlight-updates";
const HIGHLIGHT_TTL_MS = 1000 * 60 * 60 * 24;

export type HighlightField =
  | "today"
  | "yesterday"
  | "thisWeek"
  | "lastWeek"
  | "monthlyBest"
  | "bestUnitPrice";

export type HighlightUpdate = {
  recordDate: string;
  fields: HighlightField[];
  createdAt: string;
};

function storageAvailable() {
  return typeof window !== "undefined";
}

function clearHighlightUpdate() {
  localStorage.removeItem(HIGHLIGHT_STORAGE_KEY);
  window.dispatchEvent(new Event("ubalog-highlight-updated"));
}

export function saveHighlightUpdate(update: HighlightUpdate) {
  if (!storageAvailable()) return;
  localStorage.setItem(
    HIGHLIGHT_STORAGE_KEY,
    JSON.stringify({
      ...update,
      fields: [...new Set(update.fields)],
      createdAt: update.createdAt || new Date().toISOString(),
    })
  );
  window.dispatchEvent(new Event("ubalog-highlight-updated"));
}

export function getHighlightUpdate(): HighlightUpdate | null {
  if (!storageAvailable()) return null;

  try {
    const raw = localStorage.getItem(HIGHLIGHT_STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    if (!parsed?.createdAt || !Array.isArray(parsed.fields)) {
      clearHighlightUpdate();
      return null;
    }
    const createdAt = new Date(parsed.createdAt).getTime();
    if (!Number.isFinite(createdAt) || Date.now() - createdAt > HIGHLIGHT_TTL_MS) {
      clearHighlightUpdate();
      return null;
    }
    return parsed as HighlightUpdate;
  } catch {
    clearHighlightUpdate();
    return null;
  }
}

export function hasHighlight(field: HighlightField, update: HighlightUpdate | null) {
  return update?.fields.includes(field) ?? false;
}
