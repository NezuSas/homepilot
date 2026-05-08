import React from 'react';
import { cn } from '../../lib/utils';
import { Select } from './Select';
import { Loader2 } from 'lucide-react';

export interface SelectOption {
  value: string;
  label: string;
  /** Reserved for future custom searchable/select menu rendering. Not displayed by native option. */
  description?: string;
}

export interface SelectFieldProps {
  id?: string;
  label?: string;
  description?: string;
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
  loading?: boolean;
  error?: string | null;
  helperText?: string;
  className?: string;
  required?: boolean;
  placeholder?: string;
  title?: string;
  variant?: 'default' | 'small' | 'primary' | 'ghost';
  fullWidth?: boolean;
}

/**
 * SelectField
 * 
 * Reusable high-level selector component that handles:
 * - Option array rendering
 * - Loading states
 * - Error states and helper texts
 * - Labels and descriptions
 * - HomePilot visual style consistency
 * 
 * Preferred over raw <select> for all feature views.
 * Select (primitive) should only be used for low-level custom composition.
 */
export const SelectField: React.FC<SelectFieldProps> = ({
  id,
  label,
  description,
  value,
  options,
  onChange,
  disabled,
  loading,
  error,
  helperText,
  className,
  required,
  placeholder,
  title,
  variant = 'default',
  fullWidth = true
}) => {
  return (
    <div className={cn("flex flex-col gap-1", fullWidth ? "w-full" : "w-auto", className)}>
      <Select
        id={id}
        label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled || loading}
        error={error || undefined}
        helperText={helperText}
        required={required}
        title={title}
        variant={variant}
      >
        {placeholder && (
          <option value="" disabled>
            {loading ? 'Cargando...' : placeholder}
          </option>
        )}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </Select>
      
      {description && !error && !helperText && (
        <p className="text-[10px] text-muted-foreground/60 ml-1 leading-tight">
          {description}
        </p>
      )}

      {loading && !disabled && (
        <div className="flex items-center gap-2 mt-1 ml-1 animate-in fade-in">
          <Loader2 className="w-3 h-3 animate-spin text-primary/60" />
          <span className="text-[9px] font-black uppercase tracking-widest text-primary/40">
            Cargando...
          </span>
        </div>
      )}
    </div>
  );
};
