import React from 'react';
import { Loader2, Save } from 'lucide-react';

interface AutomationBuilderSubmitButtonProps {
  label: string;
  isSubmitting: boolean;
  disabled: boolean;
  onClick: () => void;
}

export const AutomationBuilderSubmitButton: React.FC<AutomationBuilderSubmitButtonProps> = ({
  label,
  isSubmitting,
  disabled,
  onClick
}) => (
  <div className="pt-2 pb-6">
    <button
      disabled={disabled}
      onClick={onClick}
      className="w-full bg-primary text-primary-foreground py-5 rounded-[2rem] font-black text-xs uppercase tracking-[0.3em] transition-all hover:scale-[1.02] active:scale-95 premium-glow shadow-primary/20 flex items-center justify-center gap-4 disabled:opacity-30 disabled:hover:scale-100"
    >
      {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
      {label}
    </button>
  </div>
);
