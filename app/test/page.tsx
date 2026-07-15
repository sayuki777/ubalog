import AppHeader from "@/components/AppHeader";
import BottomMenu from "@/components/BottomMenu";
import TestOperationPanel from "@/components/TestOperationPanel";

export default function TestPage() {
  return (
    <main className="mx-auto min-h-screen w-full max-w-[430px] overflow-x-hidden bg-gray-50 pb-28">
      <AppHeader title="動作チェック" />

      <div className="space-y-4 px-4 py-4">
        <section className="rounded-2xl bg-white p-4 shadow-sm">
          <h2 className="text-lg font-black text-gray-900">公開前チェックリスト</h2>
          <p className="mt-2 text-sm font-bold leading-6 text-gray-600">
            公開前に、記録・ランキング・リアルタイム共有・ニュースなどの動作を確認できます。
          </p>
        </section>

        <TestOperationPanel />
      </div>

      <BottomMenu />
    </main>
  );
}
