import AppHeader from "@/components/AppHeader";
import BottomMenu from "@/components/BottomMenu";

const APP_URL = "https://ubalog.vercel.app";
const FEEDBACK_FORM_URL = process.env.NEXT_PUBLIC_UBALOG_FEEDBACK_FORM_URL ?? "";
const REQUEST_FORM_URL = process.env.NEXT_PUBLIC_UBALOG_REQUEST_FORM_URL ?? "";

function buildXIntent(text: string) {
  const params = new URLSearchParams({
    text,
    url: APP_URL,
  });
  return `https://twitter.com/intent/tweet?${params.toString()}`;
}

const xReportText = [
  "ウバログの不具合・要望です。",
  "",
  "内容：",
  "機種：",
  "ページ：",
  "状況：",
  "",
  "#ウバログ",
].join("\n");

export default function FeedbackPage() {
  return (
    <main className="mx-auto min-h-screen w-full max-w-[430px] overflow-x-hidden bg-gray-50 pb-28">
      <AppHeader title="不具合報告・ご要望" />

      <div className="space-y-4 px-4 py-4">
        <section className="rounded-2xl bg-white p-4 shadow-sm">
          <h2 className="text-base font-black text-gray-900">
            気づいたことを教えてください
          </h2>
          <p className="mt-2 text-sm font-bold leading-6 text-gray-600">
            ウバログを使っていて気づいた不具合や、追加してほしい機能があれば教えてください。
          </p>
        </section>

        {(FEEDBACK_FORM_URL || REQUEST_FORM_URL) && (
          <section className="space-y-3 rounded-2xl bg-white p-4 shadow-sm">
            {FEEDBACK_FORM_URL && (
              <FeedbackButton
                href={FEEDBACK_FORM_URL}
                title="不具合を報告する"
                body="動きがおかしいところや、表示の崩れを送れます。"
              />
            )}
            {REQUEST_FORM_URL && (
              <FeedbackButton
                href={REQUEST_FORM_URL}
                title="機能をリクエストする"
                body="追加してほしい機能や改善案を送れます。"
              />
            )}
          </section>
        )}

        <section className="rounded-2xl bg-white p-4 shadow-sm">
          <div className="text-sm font-black text-gray-900">Xで報告する</div>
          <p className="mt-1 text-xs font-bold leading-5 text-gray-500">
            投稿文が入った状態でXを開きます。内容を追記して送ってください。
          </p>
          <a
            href={buildXIntent(xReportText)}
            target="_blank"
            rel="noreferrer"
            className="mt-3 block rounded-xl bg-green-600 px-4 py-3 text-center text-sm font-black text-white active:bg-green-700"
          >
            Xで報告する
          </a>
        </section>
      </div>

      <BottomMenu />
    </main>
  );
}

function FeedbackButton({
  href,
  title,
  body,
}: {
  href: string;
  title: string;
  body: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="block rounded-2xl border border-green-100 bg-green-50 px-3 py-3 active:bg-green-100"
    >
      <div className="text-sm font-black text-green-900">{title}</div>
      <div className="mt-1 text-xs font-bold leading-5 text-green-700">{body}</div>
    </a>
  );
}
