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
      className="w-full disabled:cursor-not-allowed disabled:opacity-35"
    >
      {!isSubmitting && <Save className="w-5 h-5" />}
      {label}
    </Button>
  </div>
);
