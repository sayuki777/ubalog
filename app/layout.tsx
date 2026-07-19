import "leaflet/dist/leaflet.css";
import "./globals.css";
import type { Metadata, Viewport } from "next";

const appTitle = "ウバログ｜配達記録アプリ";
const appDescription =
  "フードデリバリー配達員向けの売上記録・ランキング・リアルタイム報酬共有アプリ";
const appUrl = "https://ubalog.vercel.app";
const ogpImageUrl = `${appUrl}/ogp.png`;

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: appTitle,
  description: appDescription,
  applicationName: "ウバログ",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icon-192.png", sizes: "192x192", type: "image/png" }],
  },
  openGraph: {
    title: appTitle,
    description: appDescription,
    siteName: "ウバログ",
    url: appUrl,
    type: "website",
    images: [
      {
        url: ogpImageUrl,
        width: 1200,
        height: 630,
        alt: "ウバログ 配達記録アプリ",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: appTitle,
    description: appDescription,
    images: [ogpImageUrl],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#16a34a",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body className="overflow-x-hidden">{children}</body>
    </html>
  );
}
