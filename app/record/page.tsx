import { Suspense } from "react";
import RecordForm from "../../components/RecordForm";

export default function RecordPage() {
  return (
    <Suspense fallback={null}>
      <RecordForm />
    </Suspense>
  );
}
