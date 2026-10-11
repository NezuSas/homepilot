import React from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle } from 'lucide-react';
import { AlertBanner } from '../../components/ui/AlertBanner';
import { Button } from '../../components/ui/Button';
import type { NativeCameraNotice } from './types';

interface NativeCameraNoticeToastProps {
  notice: NativeCameraNotice;
  onDismiss: () => void;
}

export const NativeCameraNoticeToast: React.FC<NativeCameraNoticeToastProps> = ({ notice, onDismiss }) => {
  const { t } = useTranslation();
  return (
    <div className="fixed left-3 right-3 top-[calc(env(safe-area-inset-top)+0.75rem)] z-[140] w-auto sm:left-auto sm:right-6 sm:top-6 sm:w-native-camera-toast">
      <AlertBanner
        variant={notice.variant}
        icon={AlertTriangle}
        message={notice.message}
        action={(
          <Button
            type="button"
            variant="outline"
            size="xs"
            className="border-current/20 text-current hover:bg-current/10"
            onClick={onDismiss}
          >
            {t('common.close', 'Cerrar')}
          </Button>
        )}
      />
    </div>
  );
};
