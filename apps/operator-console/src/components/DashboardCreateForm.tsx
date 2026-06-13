import React from 'react';
import { X } from 'lucide-react';
import { Button } from './ui/Button';

interface DashboardCreateFormProps {
  title: string;
  value: string;
  placeholder: string;
  confirmLabel: string;
  onValueChange: (value: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

export const DashboardCreateForm: React.FC<DashboardCreateFormProps> = ({
  title,
  value,
  placeholder,
  confirmLabel,
  onValueChange,
  onConfirm,
  onCancel
}) => (
  <div className="mb-6 p-6 rounded-3xl bg-card border border-primary/30 shadow-2xl shadow-primary/10 animate-in slide-in-from-top-4 duration-500">
    <p className="text-[10px] font-black uppercase tracking-widest text-primary mb-4">{title}</p>
    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
      <input
        autoFocus
        className="flex-1 bg-background border border-border/80 rounded-2xl px-5 py-3 text-sm font-bold focus:outline-none focus:border-primary transition-all shadow-inner"
        placeholder={placeholder}
        value={value}
        onChange={event => onValueChange(event.target.value)}
        onKeyDown={event => {
          if (event.key === 'Enter') onConfirm();
          if (event.key === 'Escape') onCancel();
        }}
      />
      <div className="flex items-center gap-3">
        <Button variant="primary" onClick={onConfirm} className="flex-1 font-black uppercase tracking-widest text-[10px] px-8">{confirmLabel}</Button>
        <Button variant="secondary" onClick={onCancel} className="p-3"><X className="w-4 h-4" /></Button>
      </div>
    </div>
  </div>
);
