import { useTranslation } from 'react-i18next';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Heading } from '../components/ui/Heading';

interface OnboardingActivationStepProps {
  isNativeOnly: boolean;
  loading: boolean;
  onFinalize: () => void;
}

export function OnboardingActivationStep({ isNativeOnly, loading, onFinalize }: OnboardingActivationStepProps) {
  const { t } = useTranslation();

  return (
    <div className="space-y-6 text-center animate-in zoom-in-95">
      <div className="w-16 h-16 bg-success/10 rounded-2xl flex items-center justify-center mx-auto mb-2 border border-success/20">
        <CheckCircle2 className="w-8 h-8 text-success" />
      </div>
      <div>
        <Heading variant="view" as="h2" className="mt-2">{t('onboarding.step3.title')}</Heading>
        <p className="hp-type-body mx-auto mt-2 max-w-lg">
          {t(isNativeOnly ? 'onboarding.step3.native_subtitle' : 'onboarding.step3.subtitle')}
        </p>
      </div>

      <div className="grid gap-3 text-left sm:grid-cols-3">
        {[
          t(isNativeOnly ? 'onboarding.step3.native_next_1' : 'onboarding.step3.next_1'),
          t('onboarding.step3.next_2'),
          t(isNativeOnly ? 'onboarding.step3.native_next_3' : 'onboarding.step3.next_3')
        ].map(item => (
          <div key={item} className="rounded-xl border border-border/70 bg-muted/25 p-4 text-micro font-semibold uppercase tracking-control text-muted-foreground">
            {item}
          </div>
        ))}
      </div>

      <div className="pt-2">
        <Button
          onClick={onFinalize}
          disabled={loading}
          size="md"
          className="w-full whitespace-normal bg-success text-success-foreground hover:bg-success/90 sm:w-auto"
        >
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : t('onboarding.step3.complete')}
        </Button>
      </div>
    </div>
  );
}
