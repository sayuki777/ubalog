import "leaflet/dist/leaflet.css";
import "./globals.css";

export const metadata = {
  title: "ウバログ",
  description: "配達員向けの売上記録アプリ",
  applicationName: "ウバログ",
};

export const viewport = {
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
      <body>{children}</body>
    </html>
  );
}
