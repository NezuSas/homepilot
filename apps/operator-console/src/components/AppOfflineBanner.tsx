import { ShieldAlert } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { AlertBanner } from './ui/AlertBanner';
import { Button } from './ui/Button';
import { PageFrame } from './ui/PageFrame';

interface AppOfflineBannerProps {
  onRetry: () => void;
}

export function AppOfflineBanner({ onRetry }: AppOfflineBannerProps) {
  const { t } = useTranslation();

  return (
    <PageFrame className="animate-in fade-in slide-in-from-top-4 pb-0 duration-500">
      <AlertBanner
        variant="danger"
        icon={ShieldAlert}
        title={t('system.connection_lost')}
        message={t('system.unreachable_msg')}
        action={<Button variant="danger" size="sm" onClick={onRetry}>{t('system.retry')}</Button>}
      />
    </PageFrame>
  );
}
