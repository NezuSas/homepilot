import { useTranslation } from 'react-i18next';
import { Home } from 'lucide-react';
import { cn } from '../lib/utils';
import { Card } from '../components/ui/Card';
import { Heading } from '../components/ui/Heading';

interface OnboardingHeaderProps {
  step: number;
  isNativeOnly: boolean;
}

export function OnboardingHeader({ step, isNativeOnly }: OnboardingHeaderProps) {
  const { t } = useTranslation();
  const progressItems = [
    { index: 1, label: t('onboarding.progress.diagnostics') },
    { index: 2, label: t(isNativeOnly ? 'onboarding.progress.native' : 'onboarding.progress.bridge') },
    { index: 3, label: t('onboarding.progress.activation') }
  ];

  return (
    <Card variant="flat" radius="section" className="p-4">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10">
            <Home className="h-6 w-6 text-primary" />
          </div>
          <div className="min-w-0">
            <Heading variant="view" className="mt-1">{t('onboarding.title')}</Heading>
            <p className="hp-type-body mt-1 max-w-2xl">
              {t('onboarding.subtitle')}
            </p>
          </div>
        </div>
        <div className="grid w-full shrink-0 grid-cols-3 gap-2 sm:max-w-form-md">
          {progressItems.map(item => {
            const isCurrent = item.index === step;
            const isDone = item.index < step;
            return (
              <div
                key={item.index}
                aria-current={isCurrent ? 'step' : undefined}
                className={cn(
                  'min-w-0 rounded-xl border px-2 py-2 text-nano font-semibold uppercase leading-tight tracking-micro transition-colors sm:px-2.5',
                  isCurrent && 'border-primary/60 bg-primary/10 text-primary',
                  isDone && 'border-success/30 bg-success/10 text-success',
                  !isCurrent && !isDone && 'border-border/60 bg-muted/30 text-muted-foreground'
                )}
              >
                <span className="mb-1 block text-nano font-semibold tracking-normal opacity-70">{t('onboarding.progress.step', { count: item.index })}</span>
                <span className="block break-words text-caption leading-tight">{item.label}</span>
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
}
