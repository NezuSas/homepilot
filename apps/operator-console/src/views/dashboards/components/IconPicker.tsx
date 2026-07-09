import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import * as LucideIcons from 'lucide-react';
import { CircleHelp } from 'lucide-react';
import { cn } from '../../../lib/utils';

interface IconPickerProps {
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  className?: string;
}

type LucideComponent = React.ComponentType<{ className?: string }>;

const RESERVED_EXPORTS = new Set([
  'createLucideIcon',
  'default',
  'icons',
]);

function normalizeIconName(value: string) {
  return value
    .trim()
    .replace(/^lucide[-_s]*/i, '')
    .replace(/[-_s]+(.)/g, (_, letter: string) => letter.toUpperCase())
    .replace(/[^a-zA-Z0-9]/g, '');
}

function toPascalCase(value: string) {
  const normalized = normalizeIconName(value);
  if (!normalized) return '';

  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function isIconExport(name: string, value: unknown) {
  if (RESERVED_EXPORTS.has(name)) return false;
  if (name.endsWith('Icon')) return false;

  return typeof value === 'function';
}

const iconEntries = Object.entries(LucideIcons)
  .filter(([name, value]) => isIconExport(name, value))
  .map(([name, component]) => ({
    name,
    component: component as LucideComponent,
    normalized: normalizeIconName(name).toLowerCase(),
  }))
  .sort((a, b) => a.name.localeCompare(b.name));

function findIconComponent(value?: string): LucideComponent {
  const safeValue = value?.trim();
  if (!safeValue) return CircleHelp;

  const exact = iconEntries.find((entry) => entry.name === safeValue);
  if (exact) return exact.component;

  const pascal = toPascalCase(safeValue);
  const pascalMatch = iconEntries.find((entry) => entry.name === pascal);
  if (pascalMatch) return pascalMatch.component;

  const normalized = normalizeIconName(safeValue).toLowerCase();
  const normalizedMatch = iconEntries.find((entry) => entry.normalized === normalized);
  if (normalizedMatch) return normalizedMatch.component;

  return CircleHelp;
}

export function IconPicker({
  value = '',
  onChange,
  placeholder = 'Ej: Lightbulb, Power, Tv, Gata, Perro',
  label = 'Icono (opcional)',
  className,
}: IconPickerProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [query, setQuery] = useState(value);
  const [dropdownPos, setDropdownPos] = useState<{ left: number; top: number; width: number } | null>(null);

  useEffect(() => {
    setQuery(value);
  }, [value]);

  const SelectedIcon = findIconComponent(query);

  const filteredIcons = useMemo(() => {
    const q = normalizeIconName(query).toLowerCase();

    if (!q) return iconEntries.slice(0, 80);

    const startsWith = iconEntries.filter((entry) => entry.normalized.startsWith(q));
    const includes = iconEntries.filter((entry) => !entry.normalized.startsWith(q) && entry.normalized.includes(q));

    return [...startsWith, ...includes].slice(0, 80);
  }, [query]);

  const computeDropdownPos = () => {
    const rect = inputRef.current?.getBoundingClientRect();
    if (!rect) return;

    setDropdownPos({
      left: rect.left,
      top: rect.bottom + 8,
      width: rect.width,
    });
  };

  useEffect(() => {
    if (!dropdownPos) return;

    const onReposition = () => computeDropdownPos();

    window.addEventListener('resize', onReposition);
    window.addEventListener('scroll', onReposition, true);

    return () => {
      window.removeEventListener('resize', onReposition);
      window.removeEventListener('scroll', onReposition, true);
    };
  }, [dropdownPos]);

  const dropdown = dropdownPos && typeof document !== 'undefined'
    ? createPortal(
        <div
          className="fixed z-[100000] max-h-64 overflow-y-auto rounded-2xl border border-border/60 bg-popover p-2 shadow-2xl"
          style={{
            left: dropdownPos.left,
            top: dropdownPos.top,
            width: dropdownPos.width,
          }}
        >
          {filteredIcons.length > 0 ? (
            filteredIcons.map((entry) => {
              const Icon = entry.component;
              const isSelected = normalizeIconName(entry.name).toLowerCase() === normalizeIconName(query).toLowerCase();

              return (
                <button
                  key={entry.name}
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    setQuery(entry.name);
                    onChange(entry.name);
                    setDropdownPos(null);
                  }}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm font-black transition',
                    isSelected ? 'bg-primary/15 text-primary' : 'text-foreground hover:bg-muted/60'
                  )}
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  <span>{entry.name}</span>
                </button>
              );
            })
          ) : (
            <div className="px-3 py-6 text-center text-sm font-semibold text-muted-foreground">
              No se encontraron iconos.
            </div>
          )}
        </div>,
        document.body
      )
    : null;

  return (
    <div className={cn('space-y-2', className)}>
      {label ? (
        <span className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground">
          {label}
        </span>
      ) : null}

      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          className="h-10 w-full rounded-xl border border-border/60 bg-card pl-10 pr-3 text-sm text-foreground transition-colors focus:border-primary/50 focus:outline-none"
          placeholder={placeholder}
          value={query}
          onFocus={computeDropdownPos}
          onChange={(event) => {
            const nextValue = event.target.value;
            setQuery(nextValue);
            onChange(nextValue);
            window.setTimeout(computeDropdownPos, 0);
          }}
          onBlur={() => window.setTimeout(() => setDropdownPos(null), 200)}
        />

        <SelectedIcon className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
      </div>

      {dropdown}
    </div>
  );
}
