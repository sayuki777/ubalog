import { getRegionByPrefecture } from "@/lib/areas";

const USERS_STORAGE_KEY = "ubalog-users";
const ACTIVE_USER_STORAGE_KEY = "ubalog-active-user";
const ANONYMOUS_NUMBER_STORAGE_KEY = "ubalog-anonymous-number";

export type UbalogUser = {
  id: string;
  name: string;
  prefecture?: string;
  region?: string;
  area?: string;
  createdAt: string;
  updatedAt: string;
};

export type ProfileLike = {
  displayName?: string;
  name?: string;
  realName?: string;
  fullName?: string;
  nickname?: string;
  rankingName?: string;
  anonymousNumber?: string;
  prefecture?: string;
  region?: string;
  area?: string;
};

function storageAvailable() {
  return typeof window !== "undefined";
}

export function getAnonymousNumber() {
  if (!storageAvailable()) return "0001";

  const current = localStorage.getItem(ANONYMOUS_NUMBER_STORAGE_KEY);
  if (/^\d{4}$/.test(current ?? "")) return current as string;

  const next = String(Math.floor(Math.random() * 9999) + 1).padStart(4, "0");
  localStorage.setItem(ANONYMOUS_NUMBER_STORAGE_KEY, next);
  return next;
}

export function getAnonymousDisplayName() {
  return `匿名${getAnonymousNumber()}`;
}

export function isAnonymousDisplayName(value?: string) {
  const trimmed = value?.trim() ?? "";
  return /^匿名\d{4}$/.test(trimmed) || trimmed === "匿名配達員";
}

export function normalizeUserName(name?: string) {
  return name?.trim() || getAnonymousDisplayName();
}

export function normalizeUserId(name: string) {
  return `name:${encodeURIComponent(normalizeUserName(name).toLowerCase())}`;
}

export function getUsers(): UbalogUser[] {
  if (!storageAvailable()) return [];

  const raw = localStorage.getItem(USERS_STORAGE_KEY);
  if (!raw) return [];

  try {
    return JSON.parse(raw) as UbalogUser[];
  } catch {
    return [];
  }
}

function saveUsers(users: UbalogUser[]) {
  localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
}

export function saveUser(user: UbalogUser) {
  if (!storageAvailable()) return;

  const users = getUsers();
  const existing = users.find((item) => item.id === user.id);
  const nextUser = {
    ...existing,
    ...user,
    name: normalizeUserName(user.name),
    region: user.region || getRegionByPrefecture(user.prefecture),
    createdAt: existing?.createdAt ?? user.createdAt,
    updatedAt: new Date().toISOString(),
  };
  const next = [nextUser, ...users.filter((item) => item.id !== user.id)];
  saveUsers(next);
}

export function setActiveUser(user: UbalogUser) {
  if (!storageAvailable()) return;

  saveUser(user);
  localStorage.setItem(ACTIVE_USER_STORAGE_KEY, user.id);
}

export function getActiveUser(): UbalogUser | null {
  if (!storageAvailable()) return null;

  const activeId = localStorage.getItem(ACTIVE_USER_STORAGE_KEY);
  if (!activeId) return null;

  return getUsers().find((user) => user.id === activeId) ?? null;
}

export function createUserFromProfile(profile: ProfileLike): UbalogUser {
  const now = new Date().toISOString();
  const name = normalizeUserName(
    profile.displayName || profile.name || profile.rankingName || profile.nickname
  );

  return {
    id: normalizeUserId(name),
    name,
    prefecture: profile.prefecture,
    region: profile.region || getRegionByPrefecture(profile.prefecture),
    area: profile.area,
    createdAt: now,
    updatedAt: now,
  };
}

export function createUserFromInput({
  name,
  prefecture,
  area,
}: {
  name?: string;
  prefecture?: string;
  area?: string;
}): UbalogUser {
  const now = new Date().toISOString();
  const normalizedName = normalizeUserName(name);

  return {
    id: normalizeUserId(normalizedName),
    name: normalizedName,
    prefecture,
    region: getRegionByPrefecture(prefecture),
    area: area?.trim(),
    createdAt: now,
    updatedAt: now,
  };
}

export function ensureActiveUserFromProfile(profile: ProfileLike | null) {
  const activeUser = getActiveUser();
  if (activeUser) return activeUser;

  if (!profile) return null;
  const name = profile.displayName || profile.name || profile.rankingName || profile.nickname;
  if (!name?.trim()) return null;

  const user = createUserFromProfile(profile);
  setActiveUser(user);
  return user;
}

export function getDisplayNameFromProfileOrUser(
  profile: ProfileLike | null,
  user: UbalogUser | null
) {
  return (
    profile?.displayName?.trim() ||
    profile?.name?.trim() ||
    user?.name?.trim() ||
    profile?.rankingName?.trim() ||
    profile?.nickname?.trim() ||
    getAnonymousDisplayName()
  );
}

export { ACTIVE_USER_STORAGE_KEY, USERS_STORAGE_KEY };
