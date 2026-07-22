import React, { useEffect, useRef, useState } from 'react';
import { Check, X } from 'lucide-react';
import { IconButton } from './ui/IconButton';
import { Input } from './ui/Input';

interface InlineTabCreatorProps {
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
    <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-xl bg-primary/10 border border-primary/30 animate-in zoom-in-95 duration-150">
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
        containerClassName="w-28 shrink-0"
        className="h-7 rounded-md border-0 bg-transparent px-0 py-0 text-caption font-bold shadow-none placeholder:text-muted-foreground/50 focus-visible:border-0 focus-visible:ring-0 focus-visible:shadow-none"
      />
      <IconButton icon={Check} label={confirmLabel} onClick={handleConfirm} disabled={!value.trim()} variant="ghost" size="sm" className="h-7 w-7 text-primary hover:text-primary" />
      <IconButton icon={X} label={cancelLabel} onClick={onCancel} variant="ghost" size="sm" className="h-7 w-7" />
    </div>
  );
};
