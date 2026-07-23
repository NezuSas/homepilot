import React, { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { cn } from '../../lib/utils';
import { X, AlertTriangle, Info, CheckCircle } from 'lucide-react';
import { IconButton } from './IconButton';

export interface ModalProps {
  isOpen: boolean;
  onClose?: () => void;
  title?: string;
  description?: string;
  children?: React.ReactNode;
  variant?: 'default' | 'info' | 'danger' | 'warning' | 'success';
  layerClassName?: string;
  className?: string;
  headerClassName?: string;
  contentClassName?: string;
  footer?: React.ReactNode;
  footerClassName?: string;
  headerAlign?: 'center' | 'start';
  closeLabel?: string;
  hideCloseButton?: boolean;
}

const variantConfig = {
  default: { icon: Info, colorClass: "text-primary bg-primary/10", borderClass: "border-border/40" },
  info: { icon: Info, colorClass: "text-primary bg-primary/10", borderClass: "border-primary/20 shadow-primary/5" },
  danger: { icon: AlertTriangle, colorClass: "text-danger bg-danger/10", borderClass: "border-danger/20 shadow-danger/5" },
  warning: { icon: AlertTriangle, colorClass: "text-warning bg-warning/10", borderClass: "border-warning/20" },
  success: { icon: CheckCircle, colorClass: "text-success bg-success/10", borderClass: "border-success/20 shadow-success/5" }
};

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  description,
  children,
  variant = 'default',
  layerClassName,
  className,
  headerClassName,
  contentClassName,
  footer,
  footerClassName,
  headerAlign = 'center',
  closeLabel,
  hideCloseButton = false
}) => {
  const { t } = useTranslation();
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    if (!isOpen) return;

    const previousFocusedElement = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    const focusDialog = window.setTimeout(() => dialogRef.current?.focus(), 0);
    document.body.style.overflow = 'hidden';

    return () => {
      window.clearTimeout(focusDialog);
      document.body.style.overflow = 'unset';
      if (previousFocusedElement && document.contains(previousFocusedElement)) {
        previousFocusedElement.focus();
      }
    };
  }, [isOpen]);

  const handleDialogKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape' && onClose) {
      event.preventDefault();
      onClose();
      return;
    }

    if (event.key !== 'Tab') return;

    const focusableElements = dialogRef.current?.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );
    if (!focusableElements || focusableElements.length === 0) {
      event.preventDefault();
      dialogRef.current?.focus();
      return;
    }

    const firstFocusableElement = focusableElements[0];
    const lastFocusableElement = focusableElements[focusableElements.length - 1];
    if (event.shiftKey && document.activeElement === firstFocusableElement) {
      event.preventDefault();
      lastFocusableElement.focus();
    } else if (!event.shiftKey && document.activeElement === lastFocusableElement) {
      event.preventDefault();
      firstFocusableElement.focus();
    }
  };

  if (!isOpen) return null;

  const Icon = variantConfig[variant].icon;

  return createPortal(
    <div className={cn('fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto p-3 py-4 sm:items-center sm:p-4 sm:py-6', layerClassName)}>
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-background/80 backdrop-blur-md animate-in fade-in duration-base"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-describedby={description ? descriptionId : undefined}
        aria-label={!title ? description ?? closeLabel ?? t('common.close') : undefined}
        tabIndex={-1}
        onKeyDown={handleDialogKeyDown}
        className={cn(
          "surface-transition relative my-auto flex min-h-0 min-w-0 w-full max-w-lg flex-col overflow-hidden rounded-modal border bg-card shadow-depth-3 animate-in zoom-in-95 fade-in slide-in-from-bottom-4 duration-base max-h-modal-safe sm:max-h-modal-safe-lg",
          variantConfig[variant].borderClass,
          className
        )}
      >
        <div className="min-h-0 w-full overflow-y-auto custom-scrollbar">
            {(title || description || variant !== 'default') && <div className={cn(
              "flex min-w-0 flex-col p-5 pb-4 pr-14 sm:p-8 sm:pb-6 sm:pr-16",
              headerAlign === 'start' ? 'items-start text-left' : 'items-center text-center',
              headerClassName,
            )}>
                {variant !== 'default' && (
                    <div className={cn("mb-4 rounded-2xl p-3 sm:mb-6 sm:p-4", variantConfig[variant].colorClass)}>
                        <Icon className="h-6 w-6 sm:h-8 sm:w-8" />
                    </div>
                )}
                {title && <h2 id={titleId} className="mb-2 break-words text-panel-title font-black text-foreground">{title}</h2>}
                {description && <p id={descriptionId} className="break-words text-body font-medium leading-relaxed text-muted-foreground">
                    {description}
                </p>}
            </div>}

            {children && (
              <div className={cn("min-w-0 px-5 pb-5 sm:px-8 sm:pb-8", !title && !description && variant === 'default' && "pt-5 sm:pt-8", contentClassName)}>
                  {children}
              </div>
            )}
        </div>

        {footer && (
          <footer className={cn('flex shrink-0 flex-wrap items-center border-t border-border/60', footerClassName)}>
            {footer}
          </footer>
        )}

        {!hideCloseButton && onClose && (
          <IconButton
            icon={X}
            label={closeLabel ?? t('common.close')}
            onClick={onClose}
            variant="ghost"
            className="absolute right-4 top-4 z-10 rounded-pill sm:right-6 sm:top-6"
          />
        )}
      </div>
    </div>,
    document.body
  );
};
