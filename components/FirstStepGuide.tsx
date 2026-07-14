import OnboardingCard from "@/components/OnboardingCard";

type FirstStepGuideProps = {
  recordsCount: number;
  onboardingDismissed: boolean;
  onDismissOnboarding: () => void;
};

export default function FirstStepGuide({
  recordsCount,
  onboardingDismissed,
  onDismissOnboarding,
}: FirstStepGuideProps) {
  const showFirstRecordGuide = recordsCount === 0 && !onboardingDismissed;

  if (!showFirstRecordGuide) return null;

  return (
    <div className="mt-4">
      <OnboardingCard
        title="まずは今日の記録から"
        body="売上を入れると、マイページ・ランキング・ニュースに反映されます"
        primaryHref="/record"
        primaryLabel="記録する"
        onSecondary={onDismissOnboarding}
      />
    </div>
  );
}
