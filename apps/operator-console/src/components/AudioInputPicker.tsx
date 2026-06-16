import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronUp, SlidersHorizontal } from 'lucide-react';
import { cn } from '../lib/utils';

export interface AudioInputOption {
  id: string;
  label: string;
}

interface AudioInputPickerProps {
  devices: AudioInputOption[];
  selectedDeviceId: string;
  label: string;
  disabled?: boolean;
  onChange: (deviceId: string) => void;
}

const normalizeAudioInputLabel = (label: string): string => {
  const cleanLabel = label
    .replace(/\b(default|communications|comunicaciones)\b/gi, '')
    .replace(/\b(micr[oó]fono|microphone|array|matriz|mezcla|stereo|audio)\b/gi, '')
    .replace(/[()[\]{}]/g, ' ')
    .replace(/^[\s:._|/\\-]+|[\s:._|/\\-]+$/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();

  return cleanLabel.length > 1 ? cleanLabel : label;
};

export const AudioInputPicker: React.FC<AudioInputPickerProps> = ({
  devices,
  selectedDeviceId,
  label,
  disabled = false,
  onChange
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedDevice = useMemo(
    () => devices.find(device => device.id === selectedDeviceId) || devices[0],
    [devices, selectedDeviceId]
  );

  const selectedLabel = selectedDevice ? normalizeAudioInputLabel(selectedDevice.label) : label;

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('pointerdown', closeOnOutsidePointer);
    document.addEventListener('keydown', closeOnEscape);

    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePointer);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [isOpen]);

  if (devices.length <= 1) {
    return null;
  }

  return (
    <div ref={containerRef} className="relative block shrink-0">
      <button
        type="button"
        disabled={disabled}
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        title={selectedLabel}
        onClick={() => setIsOpen(current => !current)}
        className={cn(
          'control-transition flex h-10 w-[9.25rem] items-center gap-2 rounded-xl border px-3 sm:w-[10.5rem]',
          'border-border/70 bg-background/50 text-foreground shadow-sm hover:border-primary/35 hover:bg-muted/55',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-1 focus-visible:ring-offset-background',
          'disabled:pointer-events-none disabled:opacity-50'
        )}
      >
        <SlidersHorizontal className="h-3.5 w-3.5 shrink-0 text-primary" />
        <span className="min-w-0 flex-1 truncate text-left text-[10px] font-bold uppercase tracking-wider">
          {selectedLabel}
        </span>
        <ChevronUp className={cn('h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform', isOpen && 'rotate-180')} />
      </button>

      {isOpen && (
        <div className="absolute bottom-full right-0 z-50 mb-2 w-[min(20rem,calc(100vw-2rem))] overflow-hidden rounded-panel border border-border/70 bg-popover/95 shadow-depth-3 backdrop-blur-xl">
          <div className="border-b border-border/50 px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/80">
            {label}
          </div>
          <div role="listbox" aria-label={label} className="max-h-64 overflow-y-auto p-1.5">
            {devices.map(device => {
              const isSelected = device.id === selectedDevice?.id;
              const deviceLabel = normalizeAudioInputLabel(device.label);

              return (
                <button
                  key={device.id}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  title={device.label}
                  onClick={() => {
                    onChange(device.id);
                    setIsOpen(false);
                  }}
                  className={cn(
                    'control-transition flex w-full items-center gap-2 rounded-control px-3 py-2.5 text-left',
                    'text-xs font-semibold text-foreground hover:bg-muted/70 focus-visible:bg-muted/70 focus-visible:outline-none',
                    isSelected && 'bg-primary/12 text-primary shadow-inner'
                  )}
                >
                  <span className="min-w-0 flex-1 truncate">{deviceLabel}</span>
                  {isSelected && <Check className="h-3.5 w-3.5 shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
