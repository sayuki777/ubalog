import Link from "next/link";

type OnboardingCardProps = {
  title: string;
  body: string;
  primaryHref?: string;
  primaryLabel?: string;
  onSecondary?: () => void;
  secondaryLabel?: string;
  tone?: "green" | "blue" | "pink";
};

const toneClasses = {
  green: {
    shell: "border-green-100 bg-green-50",
    title: "text-green-900",
    body: "text-green-700",
    button: "bg-green-600 text-white active:bg-green-700",
    secondary: "text-green-700",
  },
  blue: {
    shell: "border-sky-100 bg-sky-50",
    title: "text-sky-950",
    body: "text-sky-700",
    button: "bg-sky-600 text-white active:bg-sky-700",
    secondary: "text-sky-700",
  },
  pink: {
    shell: "border-pink-100 bg-pink-50",
    title: "text-pink-950",
    body: "text-pink-700",
    button: "bg-pink-500 text-white active:bg-pink-600",
    secondary: "text-pink-700",
  },
};

export default function OnboardingCard({
  title,
  body,
  primaryHref,
  primaryLabel,
  onSecondary,
  secondaryLabel = "あとで",
  tone = "green",
}: OnboardingCardProps) {
  const classes = toneClasses[tone];

  return (
    <section className={`rounded-2xl border p-4 shadow-sm ${classes.shell}`}>
      <div className={`text-base font-black ${classes.title}`}>{title}</div>
      <p className={`mt-1 text-xs font-bold leading-relaxed ${classes.body}`}>{body}</p>
      {(primaryHref || onSecondary) && (
        <div className="mt-3 flex items-center gap-2">
          {primaryHref && primaryLabel && (
            <Link
              href={primaryHref}
              className={`flex-1 rounded-xl px-3 py-2 text-center text-sm font-black ${classes.button}`}
            >
              {primaryLabel}
            </Link>
          )}
          {onSecondary && (
            <button
              type="button"
              onClick={onSecondary}
              className={`rounded-xl bg-white px-3 py-2 text-xs font-black shadow-sm ${classes.secondary}`}
            >
              {secondaryLabel}
            </button>
          )}
        </div>
      )}
    </section>
  );
}
