import React from 'react';
import { Save } from 'lucide-react';
import { Button } from './ui/Button';

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
    <Button
      disabled={disabled}
      onClick={onClick}
      isLoading={isSubmitting}
      className="hp-type-control w-full gap-4 rounded-panel py-5 shadow-primary-button hover:translate-y-[-1px] hover:shadow-primary-button-hover active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:translate-y-0 disabled:hover:shadow-none"
    >
      {!isSubmitting && <Save className="w-5 h-5" />}
      {label}
    </Button>
  </div>
);
