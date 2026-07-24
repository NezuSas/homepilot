import React, { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';
import { IconButton } from './IconButton';

export interface DrawerProps {
  isOpen: boolean;
  onClose?: () => void;
  children: React.ReactNode;
  ariaLabel?: string;
  title?: string;
  description?: string;
  layerClassName?: string;
  panelClassName?: string;
  backdropClassName?: string;
  closeLabel?: string;
  hideCloseButton?: boolean;
}

export const Drawer: React.FC<DrawerProps> = ({
  isOpen,
  onClose,
  children,
  ariaLabel,
  title,
  description,
  layerClassName,
  panelClassName,
  backdropClassName,
  closeLabel,
  hideCloseButton = false,
}) => {
  const { t } = useTranslation();
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    if (!isOpen) return;

    const previousFocusedElement = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    const focusPanel = window.setTimeout(() => panelRef.current?.focus(), 0);
    document.body.style.overflow = 'hidden';

    return () => {
      window.clearTimeout(focusPanel);
      document.body.style.overflow = 'unset';
      if (previousFocusedElement && document.contains(previousFocusedElement)) {
        previousFocusedElement.focus();
      }
    };
  }, [isOpen]);

  const handlePanelKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape' && onClose) {
      event.preventDefault();
      onClose();
      return;
    }

    if (event.key !== 'Tab') return;

    const focusableElements = panelRef.current?.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );
    if (!focusableElements || focusableElements.length === 0) {
      event.preventDefault();
      panelRef.current?.focus();
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

  return createPortal(
    <div className={cn('fixed inset-0 z-[100] flex justify-end overflow-hidden', layerClassName)}>
      <div
        aria-hidden="true"
        className={cn('absolute inset-0 bg-background/40 backdrop-blur-sm animate-in fade-in duration-base', backdropClassName)}
        onClick={onClose}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-describedby={description ? descriptionId : undefined}
        aria-label={!title ? ariaLabel ?? closeLabel ?? t('common.close') : undefined}
        tabIndex={-1}
        onKeyDown={handlePanelKeyDown}
        className={cn(
          'surface-transition relative flex h-full min-h-0 w-full max-w-2xl flex-col overflow-hidden border-l border-border bg-card shadow-depth-3 animate-in slide-in-from-right duration-base',
          panelClassName,
        )}
      >
        {title && <h2 id={titleId} className="sr-only">{title}</h2>}
        {description && <p id={descriptionId} className="sr-only">{description}</p>}
        {children}
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
    document.body,
  );
};
