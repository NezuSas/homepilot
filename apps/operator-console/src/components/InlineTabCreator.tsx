import React, { useEffect, useRef, useState } from 'react';
import { Check, X } from 'lucide-react';

interface InlineTabCreatorProps {
  onConfirm: (title: string) => void;
  onCancel: () => void;
  placeholder: string;
  initialValue?: string;
}

export const InlineTabCreator: React.FC<InlineTabCreatorProps> = ({
  onConfirm,
  onCancel,
  placeholder,
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
      <input
        ref={inputRef}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') handleConfirm();
          if (event.key === 'Escape') onCancel();
        }}
        placeholder={placeholder}
        className="w-28 bg-transparent text-caption font-bold text-foreground outline-none placeholder:text-muted-foreground/50"
      />
      <button onClick={handleConfirm} disabled={!value.trim()} className="p-0.5 rounded-md text-primary hover:bg-primary/20 disabled:opacity-30 transition-colors">
        <Check className="w-3 h-3" />
      </button>
      <button onClick={onCancel} className="p-0.5 rounded-md text-muted-foreground hover:bg-muted transition-colors">
        <X className="w-3 h-3" />
      </button>
    </div>
  );
};
