import AppHeader from "@/components/AppHeader";
import BottomMenu from "@/components/BottomMenu";

const terms = [
  "ウバログはフードデリバリー配達員向けの記録・共有アプリです。",
  "売上、時給、件数、リアルタイム報酬共有などを記録できます。",
  "ランキングや共有情報は、他のユーザーにも表示される場合があります。",
  "不正確な情報、誹謗中傷、個人情報、危険な位置情報の投稿は控えてください。",
  "リアルタイム共有の位置情報は目安として使ってください。",
  "投稿内容は必要に応じて非表示にする場合があります。",
  "情報は参考情報であり、収益を保証するものではありません。",
];

export default function TermsPage() {
  return (
    <main className="mx-auto min-h-screen w-full max-w-[430px] overflow-x-hidden bg-gray-50 pb-28">
      <AppHeader title="利用ルール" />

      <div className="px-4 py-4">
        <section className="rounded-2xl bg-white p-4 shadow-sm">
          <h2 className="text-base font-black text-gray-900">ウバログの使い方について</h2>
          <div className="mt-3 space-y-3 text-sm font-bold leading-6 text-gray-700">
            {terms.map((item) => (
              <div key={item} className="rounded-xl bg-gray-50 px-3 py-2">
                {item}
              </div>
            ))}
          </div>
        </section>
      </div>

      <BottomMenu />
    </main>
  );
}
