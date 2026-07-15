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
  <div className="pb-4 pt-2">
    <button
      disabled={disabled}
      onClick={onClick}
      className="flex w-full items-center justify-center gap-4 rounded-[2rem] bg-primary py-5 text-xs font-black uppercase tracking-[0.3em] text-primary-foreground shadow-[0_18px_38px_hsl(var(--primary)/0.24)] transition-all hover:translate-y-[-1px] hover:shadow-[0_22px_46px_hsl(var(--primary)/0.28)] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:translate-y-0 disabled:hover:shadow-none"
    >
      {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
      {label}
    </button>
  </div>
);
