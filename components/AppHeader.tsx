import Link from "next/link";

type AppHeaderProps = {
  title?: string;
};

export default function AppHeader({
  title = "ウバログ",
}: AppHeaderProps) {
  return (
    <header className="sticky top-0 z-30 h-16 border-b border-green-800 bg-green-700 text-white">
      <div className="mx-auto flex h-full w-full max-w-[430px] items-center justify-center px-4 relative">
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>

        <Link
          href="/profile"
          className="absolute right-4 flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-lg active:scale-95"
          aria-label="マイページ"
        >
          👤
        </Link>
      </div>
    </header>
  );
}