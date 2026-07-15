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
      className="hp-type-control flex w-full items-center justify-center gap-4 rounded-panel bg-primary py-5 text-primary-foreground shadow-primary-button transition-all hover:translate-y-[-1px] hover:shadow-primary-button-hover active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:translate-y-0 disabled:hover:shadow-none"
    >
      {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
      {label}
    </button>
  </div>
);
