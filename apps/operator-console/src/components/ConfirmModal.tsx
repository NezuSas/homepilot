import React from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, X } from 'lucide-react';
import { Button } from './ui/Button';
import { IconButton } from './ui/IconButton';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info';
  isSubmitting?: boolean;
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmText,
  cancelText,
  variant = 'danger',
  isSubmitting = false,
}) => {
  const { t } = useTranslation();
  const displayConfirm = confirmText || t('common.confirm');
  const displayCancel = cancelText || t('common.cancel');

  if (!isOpen) return null;

  const variantColors = {
    danger: 'bg-danger text-danger-foreground hover:bg-danger/90 shadow-danger/20',
    warning: 'bg-warning text-warning-foreground hover:bg-warning/90 shadow-warning/20',
    info: 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-primary/20',
  };

  const iconColors = {
    danger: 'text-danger bg-danger/10',
    warning: 'text-warning bg-warning/10',
    info: 'text-primary bg-primary/10',
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4">
      <div
        className="absolute inset-0 bg-background/80 backdrop-blur-md animate-in fade-in duration-300"
        onClick={isSubmitting ? undefined : onClose}
      />

      <div className="relative w-full max-w-sm bg-card border border-foreground/10 rounded-modal shadow-depth-3 overflow-hidden animate-in zoom-in-95 fade-in slide-in-from-bottom-4 duration-300">
        <div className="flex flex-col items-center p-5 pb-4 text-center sm:p-8 sm:pb-6">
          <div className={`mb-4 rounded-2xl p-3 sm:mb-6 sm:p-4 ${iconColors[variant]}`}>
            <AlertTriangle className="h-6 w-6 sm:h-8 sm:w-8" />
          </div>

          <h2 className="text-panel-title font-black text-foreground mb-2">{title}</h2>
          <p className="text-body font-medium text-foreground/50 leading-relaxed">
            {description}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 p-5 pt-0 min-[380px]:grid-cols-2 sm:p-8 sm:pt-0">
          <Button
            disabled={isSubmitting}
            onClick={onClose}
            variant="outline"
            className="w-full rounded-xl px-5 py-3 text-body font-bold text-foreground/60"
          >
            {displayCancel}
          </Button>
          <Button
            onClick={onConfirm}
            isLoading={isSubmitting}
            className={`w-full rounded-xl px-5 py-3 text-body font-bold shadow-lg ${variantColors[variant]}`}
          >{displayConfirm}</Button>
        </div>

        <IconButton
          icon={X}
          label={t('common.close')}
          variant="ghost"
          size="md"
          disabled={isSubmitting}
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full text-foreground/30 sm:right-6 sm:top-6"
        />
      </div>
    </div>,
    document.body
  );
};

export default ConfirmModal;
