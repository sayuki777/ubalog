import OnboardingCard from "@/components/OnboardingCard";

type FirstStepGuideProps = {
  recordsCount: number;
  hasDisplayName: boolean;
  onboardingDismissed: boolean;
  profileGuideDismissed: boolean;
  onDismissOnboarding: () => void;
  onDismissProfileGuide: () => void;
};

export default function FirstStepGuide({
  recordsCount,
  hasDisplayName,
  onboardingDismissed,
  profileGuideDismissed,
  onDismissOnboarding,
  onDismissProfileGuide,
}: FirstStepGuideProps) {
  const showFirstRecordGuide = recordsCount === 0 && !onboardingDismissed;
  const showProfileGuide = !hasDisplayName && !profileGuideDismissed;

  if (!showFirstRecordGuide && !showProfileGuide) return null;

  return (
    <div className="mt-4 space-y-3">
      {showFirstRecordGuide && (
        <OnboardingCard
          title="まずは今日の記録から"
          body="売上を入れると、マイページ・ランキング・ニュースに反映されます"
          primaryHref="/record"
          primaryLabel="記録する"
          onSecondary={onDismissOnboarding}
        />
      )}
      {showProfileGuide && (
        <OnboardingCard
          title="表示名を入れておくと便利です"
          body="表示名を入れるとランキングやニュースに表示されます"
          primaryHref="/profile"
          primaryLabel="プロフを設定"
          onSecondary={onDismissProfileGuide}
          tone="blue"
        />
      )}
    </div>
  );
}
