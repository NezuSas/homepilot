import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Check, ChevronUp, SlidersHorizontal } from 'lucide-react';
import { cn } from '../lib/utils';
import { Button } from './ui/Button';

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
  const [focusedOptionIndex, setFocusedOptionIndex] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef(new Map<string, HTMLButtonElement>());
  const listboxId = useId();

  const selectedDevice = useMemo(
    () => devices.find(device => device.id === selectedDeviceId) || devices[0],
    [devices, selectedDeviceId]
  );

  const selectedLabel = selectedDevice ? normalizeAudioInputLabel(selectedDevice.label) : label;

  const focusOption = (index: number) => {
    const normalizedIndex = (index + devices.length) % devices.length;
    const option = devices[normalizedIndex];

    if (!option) {
      return;
    }

    optionRefs.current.get(option.id)?.focus();
  };

  const closeMenu = (restoreFocus = false) => {
    setIsOpen(false);
    setFocusedOptionIndex(null);

    if (restoreFocus) {
      requestAnimationFrame(() => triggerRef.current?.focus());
    }
  };

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        closeMenu();
      }
    };

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeMenu(true);
      }
    };

    document.addEventListener('pointerdown', closeOnOutsidePointer);
    document.addEventListener('keydown', closeOnEscape);

    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePointer);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || focusedOptionIndex === null) {
      return;
    }

    const frame = requestAnimationFrame(() => focusOption(focusedOptionIndex));
    return () => cancelAnimationFrame(frame);
  }, [focusedOptionIndex, isOpen, devices]);

  if (devices.length <= 1) {
    return null;
  }

  return (
    <div ref={containerRef} className="relative block min-w-0 max-w-full shrink-0">
      <Button
        ref={triggerRef}
        variant="secondary"
        size="sm"
        disabled={disabled}
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={isOpen ? listboxId : undefined}
        title={selectedLabel}
        onClick={() => {
          setIsOpen(current => !current);
          setFocusedOptionIndex(null);
        }}
        onKeyDown={event => {
          if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') {
            return;
          }

          event.preventDefault();
          const selectedIndex = Math.max(0, devices.findIndex(device => device.id === selectedDevice?.id));
          setFocusedOptionIndex(event.key === 'ArrowDown' ? selectedIndex : selectedIndex - 1);
          setIsOpen(true);
        }}
        className={cn(
          'h-10 max-w-full w-audio-picker-sm justify-start rounded-xl border-transparent bg-background/55 px-3 shadow-sm hover:border-primary/35 hover:bg-background/80',
          'sm:w-audio-picker-md md:w-audio-picker-lg'
        )}
      >
        <SlidersHorizontal className="h-3.5 w-3.5 shrink-0 text-primary" />
        <span className="min-w-0 flex-1 truncate text-left text-micro font-bold uppercase tracking-wider">
          {selectedLabel}
        </span>
        <ChevronUp className={cn('h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform', isOpen && 'rotate-180')} />
      </Button>

      {isOpen && (
        <div className="absolute bottom-full right-0 z-[80] mb-2 w-popover-responsive max-w-[calc(100vw-1.5rem)] origin-bottom-right overflow-hidden rounded-panel border border-border/70 bg-popover/95 shadow-depth-3 backdrop-blur-xl">
          <div className="border-b border-border/50 px-3 py-2 text-micro font-bold uppercase tracking-widest text-muted-foreground/80">
            {label}
          </div>
          <div id={listboxId} role="listbox" aria-label={label} className="max-h-[min(16rem,calc(100dvh-10rem))] overflow-y-auto overscroll-contain p-1.5">
            {devices.map(device => {
              const isSelected = device.id === selectedDevice?.id;
              const deviceLabel = normalizeAudioInputLabel(device.label);
              const deviceIndex = devices.findIndex(candidate => candidate.id === device.id);

              return (
                <Button
                  key={device.id}
                  ref={element => {
                    if (element) {
                      optionRefs.current.set(device.id, element);
                    } else {
                      optionRefs.current.delete(device.id);
                    }
                  }}
                  variant="ghost"
                  size="sm"
                  role="option"
                  aria-selected={isSelected}
                  title={device.label}
                  onClick={() => {
                    onChange(device.id);
                    closeMenu(true);
                  }}
                  onKeyDown={event => {
                    if (event.key === 'Escape') {
                      event.preventDefault();
                      closeMenu(true);
                      return;
                    }

                    if (event.key === 'ArrowDown' || event.key === 'ArrowUp' || event.key === 'Home' || event.key === 'End') {
                      event.preventDefault();
                      const nextIndex = event.key === 'ArrowDown'
                        ? deviceIndex + 1
                        : event.key === 'ArrowUp'
                          ? deviceIndex - 1
                          : event.key === 'Home'
                            ? 0
                            : devices.length - 1;
                      focusOption(nextIndex);
                    }
                  }}
                  className={cn(
                    'w-full justify-start gap-2 rounded-control px-3 py-2.5 text-left',
                    'text-caption font-semibold text-foreground hover:bg-muted/70 focus-visible:bg-muted/70',
                    isSelected && 'bg-primary/12 text-primary shadow-inner'
                  )}
                >
                  <span className="min-w-0 flex-1 break-words text-left leading-snug">{deviceLabel}</span>
                  {isSelected && <Check className="h-3.5 w-3.5 shrink-0" />}
                </Button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
