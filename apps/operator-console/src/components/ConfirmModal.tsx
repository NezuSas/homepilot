import React from 'react';
import { cn } from '../lib/utils';
import { Button } from './ui/Button';
import { Modal } from './ui/Modal';
import { useUiLabels } from './ui/uiLabels';

interface ConfirmModalProps extends Omit<React.ComponentProps<typeof Modal>, 'isOpen' | 'onClose' | 'title' | 'description' | 'variant' | 'footer' | 'children' | 'hideCloseButton'> {
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
  className,
  ...modalProps
}) => {
  const labels = useUiLabels();
  const displayConfirm = confirmText || labels.confirm;
  const displayCancel = cancelText || labels.cancel;

  if (!isOpen) return null;

  const buttonVariants: Record<NonNullable<ConfirmModalProps['variant']>, NonNullable<React.ComponentProps<typeof Button>['variant']>> = {
    danger: 'danger',
    warning: 'warning',
    info: 'primary',
  };

  const modalVariants: Record<NonNullable<ConfirmModalProps['variant']>, NonNullable<React.ComponentProps<typeof Modal>['variant']>> = {
    danger: 'danger',
    warning: 'warning',
    info: 'info',
  };

  return (
    <Modal
      {...modalProps}
      isOpen={isOpen}
      onClose={isSubmitting ? undefined : onClose}
      title={title}
      description={description}
      variant={modalVariants[variant]}
      className={cn('max-w-sm', className)}
      hideCloseButton={isSubmitting}
      footer={(
        <div className="grid w-full grid-cols-1 gap-3 p-5 min-[380px]:grid-cols-2 sm:p-8">
          <Button
            disabled={isSubmitting}
            onClick={onClose}
            variant="outline"
            className="w-full"
          >
            {displayCancel}
          </Button>
          <Button
            onClick={onConfirm}
            isLoading={isSubmitting}
            variant={buttonVariants[variant]}
            className="w-full"
          >
            {displayConfirm}
          </Button>
        </div>
      )}
    />
  );
};

export default ConfirmModal;
