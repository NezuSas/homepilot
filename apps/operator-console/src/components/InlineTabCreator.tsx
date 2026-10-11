import React, { useEffect, useRef, useState } from 'react';
import { Check, X } from 'lucide-react';
import { cn } from '../lib/utils';
import { IconButton } from './ui/IconButton';
import { Input } from './ui/Input';

interface InlineTabCreatorProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onChange'> {
  onConfirm: (title: string) => void;
  onCancel: () => void;
  placeholder: string;
  confirmLabel: string;
  cancelLabel: string;
  initialValue?: string;
}

export const InlineTabCreator: React.FC<InlineTabCreatorProps> = ({
  onConfirm,
  onCancel,
  placeholder,
  confirmLabel,
  cancelLabel,
  initialValue = '',
  className,
  ...rootProps
}) => {
  const [value, setValue] = useState(initialValue);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleConfirm = () => {
    if (value.trim()) {
      onConfirm(value.trim());
    }
  };

  return (
    <div {...rootProps} className={cn('flex min-w-56 max-w-full shrink-0 items-center gap-1.5 rounded-xl border border-primary/30 bg-primary/10 px-2 py-1.5 animate-in zoom-in-95 duration-150', className)}>
      <Input
        ref={inputRef}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') handleConfirm();
          if (event.key === 'Escape') onCancel();
        }}
        placeholder={placeholder}
        aria-label={placeholder}
        containerClassName="min-w-0 flex-1 sm:w-36 sm:flex-none"
      />
      <IconButton icon={Check} label={confirmLabel} onClick={handleConfirm} disabled={!value.trim()} variant="ghost" size="sm" className="text-primary hover:text-primary" />
      <IconButton icon={X} label={cancelLabel} onClick={onCancel} variant="ghost" size="sm" />
    </div>
  );
};
