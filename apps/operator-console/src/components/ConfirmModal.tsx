import React from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from './ui/Button';
import { Modal } from './ui/Modal';

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

  const variantColors: Record<NonNullable<ConfirmModalProps['variant']>, string> = {
    danger: 'bg-danger text-danger-foreground hover:bg-danger/90 shadow-danger/20',
    warning: 'bg-warning text-warning-foreground hover:bg-warning/90 shadow-warning/20',
    info: 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-primary/20',
  };

  const modalVariants: Record<NonNullable<ConfirmModalProps['variant']>, NonNullable<React.ComponentProps<typeof Modal>['variant']>> = {
    danger: 'danger',
    warning: 'warning',
    info: 'info',
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={isSubmitting ? undefined : onClose}
      title={title}
      description={description}
      variant={modalVariants[variant]}
      className="max-w-sm"
      hideCloseButton={isSubmitting}
      footer={(
        <div className="grid w-full grid-cols-1 gap-3 p-5 min-[380px]:grid-cols-2 sm:p-8">
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
          >
            {displayConfirm}
          </Button>
        </div>
      )}
    />
  );
};

export default ConfirmModal;
