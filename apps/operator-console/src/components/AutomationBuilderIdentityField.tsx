import React from 'react';
import { Input } from './ui/Input';

interface AutomationBuilderIdentityFieldProps {
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
}

export const AutomationBuilderIdentityField: React.FC<AutomationBuilderIdentityFieldProps> = ({
  label,
  placeholder,
  value,
  onChange
}) => (
  <div className="mb-6">
    <Input
      label={label}
      type="text"
      value={value}
      onChange={event => onChange(event.target.value)}
      placeholder={placeholder}
      autoFocus
    />
  </div>
);
