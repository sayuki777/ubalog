import AppHeader from "@/components/AppHeader";
import BottomMenu from "@/components/BottomMenu";

type SimplePageProps = {
  title: string;
  description: string;
  emoji: string;
};

export default function SimplePage({
  title,
  description,
  emoji,
}: SimplePageProps) {
  return (
    <main className="mx-auto min-h-screen w-full max-w-[430px] bg-gray-50 pb-24">
      <AppHeader />

      <div className="px-4 pt-4">
        <section className="rounded-2xl bg-white p-5 shadow-sm">
          <div className="text-4xl">{emoji}</div>
          <h2 className="mt-4 text-xl font-bold text-gray-900">{title}</h2>
          <p className="mt-3 text-sm leading-6 text-gray-600">{description}</p>

          <div className="mt-6 rounded-xl bg-green-50 px-4 py-4 text-sm text-green-700">
            このページは次のSprintで本実装します。
          </div>
        </section>
      </div>

      <BottomMenu />
    </main>
  );
}