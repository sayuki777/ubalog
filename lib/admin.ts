"use client";

import { useState } from "react";

const ADMIN_STORAGE_KEY = "ubalog-admin-enabled";

function adminKey() {
  return process.env.NEXT_PUBLIC_UBALOG_ADMIN_KEY?.trim() ?? "";
}

export function isAdminEnabled() {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(ADMIN_STORAGE_KEY) === "true";
}

export function enableAdminModeFromQuery() {
  if (typeof window === "undefined") return false;

  const key = adminKey();
  if (!key) return isAdminEnabled();

  try {
    const value = new URLSearchParams(window.location.search).get("admin");
    if (value && value === key) {
      localStorage.setItem(ADMIN_STORAGE_KEY, "true");
      return true;
    }
  } catch {
    return isAdminEnabled();
  }

  return isAdminEnabled();
}

export function useAdminMode() {
  const [enabled] = useState(() => enableAdminModeFromQuery());
  return enabled;
}
