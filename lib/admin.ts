"use client";

import { useState } from "react";

const ADMIN_STORAGE_KEY = "ubalog-admin-enabled";

function adminKey() {
  return process.env.NEXT_PUBLIC_UBALOG_ADMIN_KEY?.trim() ?? "";
}

export function isAdminMode() {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(ADMIN_STORAGE_KEY) === "true";
}

export function enableAdminFromQuery() {
  if (typeof window === "undefined") return false;

  const key = adminKey();
  if (!key) return isAdminMode();

  try {
    const value = new URLSearchParams(window.location.search).get("admin");
    if (value && value === key) {
      localStorage.setItem(ADMIN_STORAGE_KEY, "true");
      return true;
    }
  } catch {
    return isAdminMode();
  }

  return isAdminMode();
}

export function clearAdminMode() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(ADMIN_STORAGE_KEY);
}

export function useAdminMode() {
  const [enabled] = useState(() => enableAdminFromQuery());
  return enabled;
}

export const isAdminEnabled = isAdminMode;
export const enableAdminModeFromQuery = enableAdminFromQuery;
