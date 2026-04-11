import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

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
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'danger',
  isSubmitting = false
}) => {
  if (!isOpen) return null;

  const variantColors = {
    danger: 'bg-red-500 text-white hover:bg-red-600 shadow-red-500/20',
    warning: 'bg-yellow-500 text-white hover:bg-yellow-600 shadow-yellow-500/20',
    info: 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-primary/20'
  };

  const iconColors = {
    danger: 'text-red-500 bg-red-500/10',
    warning: 'text-yellow-500 bg-yellow-500/10',
    info: 'text-primary bg-primary/10'
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-background/80 backdrop-blur-md animate-in fade-in duration-300"
        onClick={isSubmitting ? undefined : onClose}
      />
      
      {/* Modal */}
      <div className="relative w-full max-w-sm bg-card border border-foreground/10 rounded-[2rem] shadow-2xl shadow-black/40 overflow-hidden animate-in zoom-in-95 fade-in slide-in-from-bottom-4 duration-300">
        <div className="p-8 pb-6 flex flex-col items-center text-center">
          <div className={`p-4 rounded-2xl mb-6 ${iconColors[variant]}`}>
            <AlertTriangle className="w-8 h-8" />
          </div>
          
          <h2 className="text-xl font-black text-foreground mb-2">{title}</h2>
          <p className="text-sm font-medium text-foreground/50 leading-relaxed">
            {description}
          </p>
        </div>

        <div className="p-8 pt-0 grid grid-cols-2 gap-3">
          <button
            disabled={isSubmitting}
            onClick={onClose}
            className="px-6 py-3 rounded-xl border border-foreground/10 text-foreground/60 font-bold text-sm hover:bg-foreground/5 transition-all disabled:opacity-50"
          >
            {cancelText}
          </button>
          <button
            disabled={isSubmitting}
            onClick={onConfirm}
            className={`px-6 py-3 rounded-xl font-bold text-sm transition-all hover:scale-[1.02] active:scale-95 shadow-lg disabled:opacity-50 flex items-center justify-center ${variantColors[variant]}`}
          >
            {isSubmitting ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : confirmText}
          </button>
        </div>

        <button 
          disabled={isSubmitting}
          onClick={onClose}
          className="absolute top-6 right-6 p-2 rounded-full hover:bg-foreground/5 transition-colors group"
        >
          <X className="w-5 h-5 text-foreground/20 group-hover:text-foreground/40" />
        </button>
      </div>
    </div>
  );
};

export default ConfirmModal;
