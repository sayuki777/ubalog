import { Suspense } from "react";
import RankingBoard from "../../components/RankingBoard";

export default function RankingPage() {
  return (
    <Suspense fallback={null}>
      <RankingBoard />
    </Suspense>
  );
}
