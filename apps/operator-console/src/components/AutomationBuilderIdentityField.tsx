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
      className="hp-type-field h-14 rounded-field border-border/60 bg-background/80 px-5 placeholder:text-muted-foreground/45 focus:border-primary/55 focus:bg-card focus:shadow-primary-focus"
      autoFocus
    />
  </div>
);
