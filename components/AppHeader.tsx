"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type AppHeaderProps = {
  title?: string;
};

type Profile = {
  name?: string;
  displayName?: string;
};

function loadProfileName() {
  if (typeof window === "undefined") return "";

  const raw = localStorage.getItem("ubalog-profile");
  if (!raw) return "";

  try {
    const profile = JSON.parse(raw) as Profile;
    return profile.name?.trim() || profile.displayName?.trim() || "";
  } catch {
    return "";
  }
}

function defaultTitle(name: string) {
  return name ? `${name}のウバログ` : "ウバログ";
}

export default function AppHeader({ title }: AppHeaderProps) {
  const [profileName, setProfileName] = useState("");

  useEffect(() => {
    const update = () => setProfileName(loadProfileName());
    update();
    window.addEventListener("focus", update);
    window.addEventListener("ubalog-profile-updated", update);

    return () => {
      window.removeEventListener("focus", update);
      window.removeEventListener("ubalog-profile-updated", update);
    };
  }, []);

  const headerTitle = title ?? defaultTitle(profileName);

  return (
    <header className="sticky top-0 z-30 h-16 border-b border-green-800 bg-green-700 text-white">
      <div className="relative mx-auto flex h-full w-full max-w-[430px] items-center justify-center px-4">
        <h1 className="max-w-[270px] truncate text-center text-xl font-black tracking-tight">
          {title ? (
            headerTitle
          ) : profileName ? (
            <>
              <span className="text-2xl font-black">{profileName}</span>
              <span className="text-lg font-extrabold">のウバログ</span>
            </>
          ) : (
            headerTitle
          )}
        </h1>

        <Link
          href="/profile"
          className="absolute right-3 rounded-full bg-white/15 px-3 py-2 text-xs font-bold active:scale-95"
          aria-label="プロフィール"
          title="プロフィール"
        >
          プロフィール
        </Link>
      </div>
    </header>
  );
}
