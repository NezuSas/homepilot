import React from 'react';

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
  <div className="space-y-3 mb-6">
    <label className="text-[9px] font-black uppercase tracking-[0.3em] text-muted-foreground opacity-50 ml-1">{label}</label>
    <input
      type="text"
      value={value}
      onChange={event => onChange(event.target.value)}
      placeholder={placeholder}
      className="w-full h-14 bg-muted/20 border-2 border-border/10 rounded-[1.2rem] px-5 text-xl font-black tracking-tighter focus:border-primary/50 focus:ring-0 transition-all placeholder:opacity-20"
      autoFocus
    />
  </div>
);
