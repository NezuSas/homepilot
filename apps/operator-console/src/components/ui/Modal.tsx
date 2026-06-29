import React, { useEffect } from 'react';
import { cn } from '../../lib/utils';
import { X, AlertTriangle, Info, CheckCircle } from 'lucide-react';
import { IconButton } from './IconButton';

export interface ModalProps {
  isOpen: boolean;
  onClose?: () => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
  variant?: 'default' | 'danger' | 'warning' | 'success';
  className?: string;
  hideCloseButton?: boolean;
}

const variantConfig = {
  default: { icon: Info, colorClass: "text-primary bg-primary/10", borderClass: "border-border/40" },
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
  className,
  hideCloseButton = false
}) => {

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const Icon = variantConfig[variant].icon;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto p-3 py-4 sm:items-center sm:p-4 sm:py-6">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-background/80 backdrop-blur-md animate-in fade-in duration-base"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className={cn(
          "surface-transition relative my-auto w-full max-w-lg bg-card border rounded-modal shadow-depth-3 overflow-hidden animate-in zoom-in-95 fade-in slide-in-from-bottom-4 duration-base flex flex-col max-h-[calc(100vh-2rem)] sm:max-h-[calc(100vh-3rem)]",
          variantConfig[variant].borderClass,
          className
        )}
      >
        <div className="min-h-0 w-full overflow-y-auto custom-scrollbar">
            {(title || description || variant !== 'default') && <div className={cn("flex flex-col items-center p-5 pb-4 text-center sm:p-8 sm:pb-6")}>
                {variant !== 'default' && (
                    <div className={cn("mb-4 rounded-2xl p-3 sm:mb-6 sm:p-4", variantConfig[variant].colorClass)}>
                        <Icon className="h-6 w-6 sm:h-8 sm:w-8" />
                    </div>
                )}
                {title && <h2 className="text-xl font-black text-foreground mb-2">{title}</h2>}
                {description && <p className="text-sm font-medium text-muted-foreground leading-relaxed">
                    {description}
                </p>}
            </div>}

            <div className={cn("px-5 pb-5 sm:px-8 sm:pb-8", !title && !description && variant === 'default' && "pt-5 sm:pt-8")}>
                {children}
            </div>
        </div>

        {!hideCloseButton && onClose && (
          <IconButton
            icon={X}
            label="Close modal"
            onClick={onClose}
            variant="ghost"
            className="absolute right-4 top-4 z-10 rounded-pill sm:right-6 sm:top-6"
          />
        )}
      </div>
    </div>
  );
};
