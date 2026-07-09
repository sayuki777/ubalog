import Link from "next/link";

type Props = {
  title: string;
  description: string;
  href: string;
  emoji: string;
};

export default function MenuCard({
  title,
  description,
  href,
  emoji,
}: Props) {
  return (
    <Link href={href}>
      <div className="bg-white rounded-2xl shadow p-5 active:scale-95 transition mb-4">

        <div className="text-2xl mb-2">
          {emoji}
        </div>

        <h2 className="font-bold text-lg">
          {title}
        </h2>

        <p className="text-sm text-gray-500 mt-1">
          {description}
        </p>

      </div>
    </Link>
  );
}