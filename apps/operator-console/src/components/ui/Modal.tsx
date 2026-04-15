import React, { useEffect } from 'react';
import { cn } from '../../lib/utils';
import { X, AlertTriangle, Info, CheckCircle } from 'lucide-react';

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
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-background/80 backdrop-blur-md animate-in fade-in duration-300"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className={cn(
          "relative w-full max-w-lg bg-card border rounded-[2rem] shadow-2xl shadow-black/40 overflow-hidden animate-in zoom-in-95 fade-in slide-in-from-bottom-4 duration-300 flex flex-col max-h-[90vh]",
          variantConfig[variant].borderClass,
          className
        )}
      >
        <div className="overflow-y-auto w-full custom-scrollbar">
            {(title || description || variant !== 'default') && <div className={cn("p-8 pb-6 flex flex-col items-center text-center")}>
                {variant !== 'default' && (
                    <div className={cn("p-4 rounded-2xl mb-6", variantConfig[variant].colorClass)}>
                        <Icon className="w-8 h-8" />
                    </div>
                )}
                {title && <h2 className="text-xl font-black text-foreground mb-2">{title}</h2>}
                {description && <p className="text-sm font-medium text-muted-foreground leading-relaxed">
                    {description}
                </p>}
            </div>}

            <div className={cn("px-8 pb-8", !title && !description && variant === 'default' && "pt-8")}>
                {children}
            </div>
        </div>

        {!hideCloseButton && onClose && (
          <button 
            onClick={onClose}
            className="absolute top-6 right-6 p-2 rounded-full hover:bg-foreground/5 transition-colors group z-10"
          >
            <X className="w-5 h-5 text-muted-foreground group-hover:text-foreground/80 transition-colors" />
          </button>
        )}
      </div>
    </div>
  );
};
