import AppHeader from "@/components/AppHeader";
import BottomMenu from "@/components/BottomMenu";

const privacyItems = [
  "ウバログでは、入力された記録データを保存します。",
  "保存対象には、表示名、売上、件数、稼働時間、都道府県、エリア、リアルタイム共有情報などが含まれる場合があります。",
  "Googleログインは現在使っていません。",
  "端末内保存とFirebase Firestoreを使ってデータ共有しています。",
  "ランキング参加ONの記録はランキングに表示される場合があります。",
  "リアルタイム共有の投稿は地図や一覧に表示される場合があります。",
  "詳しすぎる住所や個人情報は入力しないでください。",
  "不適切な投稿は非表示にする場合があります。",
];

export default function PrivacyPage() {
  return (
    <main className="mx-auto min-h-screen w-full max-w-[430px] overflow-x-hidden bg-gray-50 pb-28">
      <AppHeader title="プライバシー" />

      <div className="px-4 py-4">
        <section className="rounded-2xl bg-white p-4 shadow-sm">
          <h2 className="text-base font-black text-gray-900">保存と表示について</h2>
          <div className="mt-3 space-y-3 text-sm font-bold leading-6 text-gray-700">
            {privacyItems.map((item) => (
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
