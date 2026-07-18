import React from 'react';
import { X } from 'lucide-react';
import { Button } from './ui/Button';
import { Input } from './ui/Input';

interface DashboardCreateFormProps {
  title: string;
  value: string;
  placeholder: string;
  confirmLabel: string;
  isSubmitting: boolean;
  onValueChange: (value: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

export const DashboardCreateForm: React.FC<DashboardCreateFormProps> = ({
  title,
  value,
  placeholder,
  confirmLabel,
  isSubmitting,
  onValueChange,
  onConfirm,
  onCancel
}) => (
  <div className="mb-6 p-6 rounded-3xl bg-card border border-primary/30 shadow-2xl shadow-primary/10 animate-in slide-in-from-top-4 duration-500">
    <p className="text-micro font-black uppercase tracking-widest text-primary mb-4">{title}</p>
    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
      <Input
        autoFocus
        className="flex-1 rounded-2xl border-border/80 px-5 py-3 font-bold shadow-inner"
        placeholder={placeholder}
        value={value}
        onChange={event => onValueChange(event.target.value)}
        disabled={isSubmitting}
        onKeyDown={event => {
          if (event.key === 'Enter' && value.trim()) onConfirm();
          if (event.key === 'Escape') onCancel();
        }}
      />
      <div className="flex items-center gap-3">
        <Button variant="primary" onClick={onConfirm} isLoading={isSubmitting} disabled={!value.trim()} className="flex-1 font-black uppercase tracking-widest text-micro px-8">{confirmLabel}</Button>
        <Button variant="secondary" onClick={onCancel} disabled={isSubmitting} className="p-3"><X className="w-4 h-4" /></Button>
      </div>
    </div>
  </div>
);
