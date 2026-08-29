import { useEffect, useId, useMemo, useRef, useState, type ComponentType } from 'react';
import { createPortal } from 'react-dom';
import {
  Bot,
  Blinds,
  BriefcaseBusiness,
  Camera,
  Cat,
  CircleHelp,
  Clock,
  Dog,
  Fan,
  Gauge,
  Home,
  Key,
  LayoutGrid,
  Lightbulb,
  Lock,
  Music2,
  Plug,
  Power,
  Shield,
  Sparkles,
  Speaker,
  Thermometer,
  Tv,
  Wind,
  Zap,
} from 'lucide-react';
import {
  mdiAirConditioner,
  mdiAlarm,
  mdiBlinds,
  mdiCamera,
  mdiCat,
  mdiCeilingFan,
  mdiDog,
  mdiDoor,
  mdiFan,
  mdiFire,
  mdiGarage,
  mdiHome,
  mdiLightbulb,
  mdiLock,
  mdiMusic,
  mdiPower,
  mdiPowerPlug,
  mdiShield,
  mdiSpeaker,
  mdiTelevision,
  mdiThermometer,
  mdiWeatherWindy,
  mdiWindowShutter,
} from '@mdi/js';
import { useTranslation } from 'react-i18next';
import { cn } from '../../../lib/utils';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';

interface IconPickerProps {
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  className?: string;
}

type IconComponent = ComponentType<{ className?: string }>;

interface IconEntry {
  name: string;
  icon: IconComponent;
  normalized: string;
}

/**
 * The initial dashboard bundle only contains icons that HomePilot presents in
 * its own UI. The Material subset covers persisted Home Assistant aliases
 * used by the shipped dashboard and keeps arbitrary user text intact.
 */
const COMMON_ICON_COMPONENTS: Record<string, IconComponent> = {
  assistant: Bot,
  bot: Bot,
  blinds: Blinds,
  briefcase: BriefcaseBusiness,
  camera: Camera,
  cat: Cat,
  clock: Clock,
  dog: Dog,
  fan: Fan,
  gauge: Gauge,
  home: Home,
  key: Key,
  layoutgrid: LayoutGrid,
  lightbulb: Lightbulb,
  lock: Lock,
  music: Music2,
  plug: Plug,
  powerplug: Plug,
  power: Power,
  shield: Shield,
  sparkles: Sparkles,
  speaker: Speaker,
  thermometer: Thermometer,
  television: Tv,
  tv: Tv,
  weatherwindy: Wind,
  wind: Wind,
  zap: Zap,
};

function normalizeIconName(value: string) {
  return value
    .trim()
    .replace(/^(lucide|mdi)[:\-_\s]*/i, '')
    .replace(/[-_\s]+(.)/g, (_match, letter: string) => letter.toUpperCase())
    .replace(/[^a-zA-Z0-9]/g, '')
    .replace(/Icon$/i, '')
    .toLowerCase();
}

function createMdiIcon(path: string): IconComponent {
  return function MdiIcon({ className }) {
    return (
      <svg aria-hidden="true" className={className} fill="currentColor" viewBox="0 0 24 24">
        <path d={path} />
      </svg>
    );
  };
}

const MATERIAL_ICON_PATHS: Record<string, string> = {
  'mdi:air-conditioner': mdiAirConditioner,
  'mdi:alarm': mdiAlarm,
  'mdi:blinds': mdiBlinds,
  'mdi:camera': mdiCamera,
  'mdi:cat': mdiCat,
  'mdi:ceiling-fan': mdiCeilingFan,
  'mdi:dog': mdiDog,
  'mdi:door': mdiDoor,
  'mdi:fan': mdiFan,
  'mdi:fire': mdiFire,
  'mdi:garage': mdiGarage,
  'mdi:home': mdiHome,
  'mdi:lightbulb': mdiLightbulb,
  'mdi:lock': mdiLock,
  'mdi:music': mdiMusic,
  'mdi:power': mdiPower,
  'mdi:power-plug': mdiPowerPlug,
  'mdi:shield': mdiShield,
  'mdi:speaker': mdiSpeaker,
  'mdi:television': mdiTelevision,
  'mdi:thermometer': mdiThermometer,
  'mdi:weather-windy': mdiWeatherWindy,
  'mdi:window-shutter': mdiWindowShutter,
};

const MATERIAL_ICON_ENTRIES: IconEntry[] = Object.entries(MATERIAL_ICON_PATHS).map(([name, path]) => ({
  name,
  icon: createMdiIcon(path),
  normalized: normalizeIconName(name),
}));

const MATERIAL_ICON_COMPONENTS: Record<string, IconComponent> = Object.fromEntries(
  MATERIAL_ICON_ENTRIES.map((entry) => [entry.normalized, entry.icon])
);

const ICON_CATALOG: IconEntry[] = [
  ...Object.entries(COMMON_ICON_COMPONENTS).map(([name, icon]) => ({ name, icon, normalized: normalizeIconName(name) })),
  ...MATERIAL_ICON_ENTRIES,
].sort((left, right) => left.name.localeCompare(right.name));

export function getDashboardIconComponent(value?: string): IconComponent {
  const rawValue = value?.trim() || '';
  const normalized = normalizeIconName(rawValue);
  if (!normalized) return CircleHelp;

  if (/^mdi[:\-_\s]/i.test(rawValue)) {
    return MATERIAL_ICON_COMPONENTS[normalized] || CircleHelp;
  }

  return COMMON_ICON_COMPONENTS[normalized] || MATERIAL_ICON_COMPONENTS[normalized] || CircleHelp;
}

export function IconPicker({
  value = '',
  onChange,
  placeholder,
  label,
  className,
}: IconPickerProps) {
  const { t } = useTranslation();
  const listboxId = useId();
  const iconInputRef = useRef<HTMLInputElement | null>(null);
  const [iconQuery, setIconQuery] = useState(value);
  const [dropdownPos, setDropdownPos] = useState<{ left: number; top: number; width: number } | null>(null);

  useEffect(() => {
    setIconQuery(value);
  }, [value]);

  const SelectedIcon = getDashboardIconComponent(iconQuery);
  const resolvedPlaceholder = placeholder ?? t('dashboard.editor.sections.icon_picker_placeholder');
  const resolvedLabel = label ?? t('dashboard.editor.sections.icon_picker_label');

  const filteredIcons = useMemo(() => {
    const query = normalizeIconName(iconQuery);

    if (!query) return ICON_CATALOG;

    const startsWith = ICON_CATALOG.filter((item) => item.normalized.startsWith(query));
    const includes = ICON_CATALOG.filter((item) => !item.normalized.startsWith(query) && item.normalized.includes(query));

    return [...startsWith, ...includes];
  }, [iconQuery]);

  const computeDropdownPos = () => {
    const rect = iconInputRef.current?.getBoundingClientRect();
    if (!rect) return;

    const maxWidth = Math.max(0, window.innerWidth - 24);
    const width = Math.min(rect.width, maxWidth);

    setDropdownPos({
      left: Math.max(12, Math.min(rect.left, window.innerWidth - width - 12)),
      top: rect.bottom + 8,
      width,
    });
  };

  useEffect(() => {
    if (!dropdownPos) return;

    const updatePosition = () => computeDropdownPos();

    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);

    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [dropdownPos]);

  const dropdown = dropdownPos && typeof document !== 'undefined'
    ? createPortal(
        <div
          id={listboxId}
          role="listbox"
          aria-label={resolvedLabel}
          className="fixed z-[100000] max-h-64 overflow-y-auto rounded-2xl border border-border/60 bg-popover p-2 shadow-2xl"
          style={{
            left: dropdownPos.left,
            top: dropdownPos.top,
            width: dropdownPos.width,
          }}
        >
          {filteredIcons.length > 0 ? (
            filteredIcons.map((item) => {
              const Icon = item.icon;
              const selected = item.normalized === normalizeIconName(iconQuery);

              return (
                <Button
                  key={item.name}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    setIconQuery(item.name);
                    onChange(item.name);
                    setDropdownPos(null);
                  }}
                  className={cn(
                    'w-full justify-start gap-3 rounded-xl px-3 text-left text-body font-black',
                    selected ? 'bg-primary/15 text-primary' : 'text-foreground hover:bg-muted/60'
                  )}
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  <span>{item.name}</span>
                </Button>
              );
            })
          ) : (
            <div className="px-3 py-6 text-center text-body font-semibold text-muted-foreground">
              {t('dashboard.editor.sections.icon_picker_empty')}
            </div>
          )}
        </div>,
        document.body
      )
    : null;

  return (
    <div className={cn('space-y-2', className)}>
      <Input
        ref={iconInputRef}
        type="text"
        label={resolvedLabel}
        placeholder={resolvedPlaceholder}
        value={iconQuery}
        icon={<SelectedIcon className="h-5 w-5" />}
        onFocus={computeDropdownPos}
        aria-autocomplete="list"
        aria-controls={dropdownPos ? listboxId : undefined}
        aria-expanded={Boolean(dropdownPos)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            setDropdownPos(null);
            return;
          }

          if (event.key === 'ArrowDown' && !dropdownPos) {
            event.preventDefault();
            computeDropdownPos();
          }
        }}
        onChange={(event) => {
          const nextValue = event.target.value;
          setIconQuery(nextValue);
          onChange(nextValue);
          setTimeout(computeDropdownPos, 0);
        }}
        onBlur={() => setTimeout(() => setDropdownPos(null), 200)}
        className="border-border/60 bg-card text-foreground"
      />

      {dropdown}
    </div>
  );
}