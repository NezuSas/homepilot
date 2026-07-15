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
  <div className="mb-6 space-y-3">
    <label className="ml-1 text-[9px] font-black uppercase tracking-[0.3em] text-muted-foreground">{label}</label>
    <input
      type="text"
      value={value}
      onChange={event => onChange(event.target.value)}
      placeholder={placeholder}
      className="h-14 w-full rounded-[1.2rem] border border-border/60 bg-background/80 px-5 text-xl font-black tracking-tighter text-foreground shadow-sm outline-none transition-all placeholder:text-muted-foreground/45 focus:border-primary/55 focus:bg-card focus:shadow-[0_0_0_4px_hsl(var(--primary)/0.10)]"
      autoFocus
    />
  </div>
);
