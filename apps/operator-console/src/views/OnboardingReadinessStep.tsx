import { useTranslation } from 'react-i18next';
import { CheckCircle2, ShieldCheck, XCircle } from 'lucide-react';
import { cn } from '../lib/utils';
import { AlertBanner } from '../components/ui/AlertBanner';
import { Button } from '../components/ui/Button';
import { Heading } from '../components/ui/Heading';
import type { ReadinessItem } from './onboardingSetup';

interface OnboardingReadinessStepProps {
  readinessItems: ReadinessItem[];
  isNativeOnly: boolean;
  isAdmin: boolean;
  onContinue: () => void;
}

export function OnboardingReadinessStep({ readinessItems, isNativeOnly, isAdmin, onContinue }: OnboardingReadinessStepProps) {
  const { t } = useTranslation();

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <ShieldCheck className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <Heading variant="section" className="text-foreground">{t('onboarding.step1.title')}</Heading>
          <p className="hp-type-body mt-1">{t('onboarding.step1.description')}</p>
        </div>
      </div>

      <div className="grid gap-3">
        {readinessItems.map(item => (
          <div key={item.labelKey} className="flex min-w-0 flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-border/60 py-3">
            <span className="text-body-compact font-semibold text-muted-foreground">{t(item.labelKey)}</span>
            <span
              className={cn(
                'inline-flex min-w-0 max-w-full items-center gap-1.5 break-all text-caption font-semibold',
                item.status === 'success' && 'text-success',
                item.status === 'warning' && 'text-warning',
                item.status === 'error' && 'text-danger'
              )}
            >
              {item.status === 'success' ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
              {`${t(item.valueKey)}${item.valueSuffix ?? ''}`}
            </span>
          </div>
        ))}
      </div>

      <AlertBanner
        variant="info"
        title={t('onboarding.step1.operator_note_title')}
        message={t(isNativeOnly ? 'onboarding.step1.native_operator_note' : 'onboarding.step1.operator_note')}
      />

      <div className="flex justify-end pt-2">
        <Button
          onClick={onContinue}
          disabled={!isAdmin}
          size="md"
          className="w-full whitespace-normal sm:w-auto"
        >
          {t(isNativeOnly ? 'onboarding.step1.native_continue' : 'onboarding.step1.continue')}
        </Button>
      </div>
    </div>
  );
}
