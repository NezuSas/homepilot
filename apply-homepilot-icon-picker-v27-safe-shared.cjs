// HomePilot V27 - Safe modular IconPicker + WidgetInspector migration
// Run from repo root:
// node .\apply-homepilot-icon-picker-v27-safe-shared.cjs
//
// Fixes:
// 1) Replaces dynamic lucide export rendering with a safe curated IconPicker to avoid React error #31.
// 2) Keeps the same UX as the previous WidgetInspector icon field: input + dropdown + scroll.
// 3) Uses IconPicker inside SectionWidget.
// 4) Attempts to migrate WidgetInspector to the same IconPicker.
// If the WidgetInspector pattern is different, the script leaves a warning and build will tell us what remains.

const fs = require("fs");
const path = require("path");

const iconPickerPath = "apps/operator-console/src/views/dashboards/components/IconPicker.tsx";
const sectionPath = "apps/operator-console/src/views/dashboards/widgets/SectionWidget.tsx";
const inspectorPath = "apps/operator-console/src/views/dashboards/WidgetInspector.tsx";

fs.mkdirSync(path.dirname(iconPickerPath), { recursive: true });

const iconPicker = `import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  AirVent,
  AlarmClock,
  Bell,
  Bot,
  Camera,
  Car,
  CircleHelp,
  Cloud,
  Coffee,
  DoorOpen,
  Fan,
  Flame,
  Gauge,
  Home,
  Lamp,
  Lightbulb,
  LightbulbOff,
  Lock,
  Moon,
  Plug,
  Power,
  Radio,
  Router,
  Search,
  Shield,
  Snowflake,
  Speaker,
  Sun,
  Thermometer,
  ToggleLeft,
  Tv,
  Unlock,
  Waves,
  Wifi,
  Wind,
  Zap,
} from 'lucide-react';
import { cn } from '../../../lib/utils';

interface IconPickerProps {
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  className?: string;
}

type IconComponent = React.ComponentType<{ className?: string }>;

const ICONS: { name: string; icon: IconComponent; aliases?: string[] }[] = [
  { name: 'Lightbulb', icon: Lightbulb, aliases: ['Foco', 'Luz', 'Bulb'] },
  { name: 'LightbulbIcon', icon: Lightbulb, aliases: ['LucideLightbulb'] },
  { name: 'LightbulbOff', icon: LightbulbOff, aliases: ['Luz apagada'] },
  { name: 'LightbulbOffIcon', icon: LightbulbOff },
  { name: 'Power', icon: Power, aliases: ['Encendido', 'Switch'] },
  { name: 'PowerIcon', icon: Power },
  { name: 'Plug', icon: Plug, aliases: ['Enchufe', 'Outlet'] },
  { name: 'PlugIcon', icon: Plug },
  { name: 'Sun', icon: Sun, aliases: ['Sol', 'Dia'] },
  { name: 'Moon', icon: Moon, aliases: ['Luna', 'Noche'] },
  { name: 'Fan', icon: Fan, aliases: ['Ventilador'] },
  { name: 'Camera', icon: Camera, aliases: ['Camara', 'CCTV'] },
  { name: 'Tv', icon: Tv, aliases: ['Television'] },
  { name: 'Wifi', icon: Wifi, aliases: ['WiFi', 'Internet'] },
  { name: 'Router', icon: Router, aliases: ['Red'] },
  { name: 'Shield', icon: Shield, aliases: ['Seguridad'] },
  { name: 'Lock', icon: Lock, aliases: ['Cerradura'] },
  { name: 'Unlock', icon: Unlock },
  { name: 'Home', icon: Home, aliases: ['Casa'] },
  { name: 'DoorOpen', icon: DoorOpen, aliases: ['Puerta'] },
  { name: 'Thermometer', icon: Thermometer, aliases: ['Temperatura'] },
  { name: 'Snowflake', icon: Snowflake, aliases: ['Frio', 'Aire'] },
  { name: 'Flame', icon: Flame, aliases: ['Calor'] },
  { name: 'Wind', icon: Wind, aliases: ['Viento'] },
  { name: 'AirVent', icon: AirVent, aliases: ['Aire acondicionado'] },
  { name: 'Speaker', icon: Speaker, aliases: ['Audio'] },
  { name: 'Radio', icon: Radio },
  { name: 'Bell', icon: Bell, aliases: ['Alarma'] },
  { name: 'AlarmClock', icon: AlarmClock, aliases: ['Reloj'] },
  { name: 'Bot', icon: Bot, aliases: ['AI', 'Asistente'] },
  { name: 'Car', icon: Car, aliases: ['Garage', 'Auto'] },
  { name: 'Coffee', icon: Coffee, aliases: ['Cocina'] },
  { name: 'Lamp', icon: Lamp },
  { name: 'Cloud', icon: Cloud, aliases: ['Clima'] },
  { name: 'Gauge', icon: Gauge, aliases: ['Medidor'] },
  { name: 'Waves', icon: Waves, aliases: ['Agua'] },
  { name: 'Zap', icon: Zap, aliases: ['Energia'] },
  { name: 'ToggleLeft', icon: ToggleLeft, aliases: ['Toggle'] },
];

function normalizeIconName(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/^lucide[-_\\s]*/i, '')
    .replace(/icon$/i, '')
    .replace(/[^a-z0-9]/g, '');
}

function findIcon(value?: string): IconComponent {
  const normalized = normalizeIconName(value || '');
  if (!normalized) return CircleHelp;

  return (
    ICONS.find((item) => normalizeIconName(item.name) === normalized)?.icon ||
    ICONS.find((item) => item.aliases?.some((alias) => normalizeIconName(alias) === normalized))?.icon ||
    ICONS.find((item) => normalizeIconName(item.name).includes(normalized))?.icon ||
    CircleHelp
  );
}

export function IconPicker({
  value = '',
  onChange,
  placeholder = 'Ej: Lightbulb, Power, Tv, Gata, Perro',
  label = 'Icono (opcional)',
  className,
}: IconPickerProps) {
  const iconInputRef = useRef<HTMLInputElement | null>(null);
  const [iconQuery, setIconQuery] = useState(value);
  const [dropdownPos, setDropdownPos] = useState<{ left: number; top: number; width: number } | null>(null);

  useEffect(() => {
    setIconQuery(value);
  }, [value]);

  const SelectedIcon = findIcon(iconQuery);

  const filteredIcons = useMemo(() => {
    const q = normalizeIconName(iconQuery);

    if (!q) return ICONS;

    return ICONS.filter((item) => {
      const haystack = [item.name, ...(item.aliases || [])].map(normalizeIconName).join(' ');
      return haystack.includes(q);
    });
  }, [iconQuery]);

  const computeDropdownPos = () => {
    const rect = iconInputRef.current?.getBoundingClientRect();
    if (!rect) return;

    setDropdownPos({
      left: rect.left,
      top: rect.bottom + 8,
      width: rect.width,
    });
  };

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
            filteredIcons.map((item) => {
              const Icon = item.icon;
              const selected = normalizeIconName(item.name) === normalizeIconName(iconQuery);

              return (
                <button
                  key={item.name}
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    setIconQuery(item.name);
                    onChange(item.name);
                    setDropdownPos(null);
                  }}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm font-black transition',
                    selected ? 'bg-primary/15 text-primary' : 'text-foreground hover:bg-muted/60'
                  )}
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  <span>{item.name}</span>
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
          ref={iconInputRef}
          type="text"
          className="h-10 w-full rounded-xl border border-border/60 bg-card pl-10 pr-3 text-sm text-foreground transition-colors focus:border-primary/50 focus:outline-none"
          placeholder={placeholder}
          value={iconQuery}
          onFocus={computeDropdownPos}
          onChange={(event) => {
            const val = event.target.value;
            setIconQuery(val);
            onChange(val);
            setTimeout(computeDropdownPos, 0);
          }}
          onBlur={() => setTimeout(() => setDropdownPos(null), 200)}
        />

        <SelectedIcon className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
      </div>

      {dropdown}
    </div>
  );
}
`;

fs.writeFileSync(iconPickerPath, iconPicker, "utf8");

function patchSectionWidget() {
  let s = fs.readFileSync(sectionPath, "utf8");

  if (!s.includes("components/IconPicker")) {
    s = s.replace(
      "import type { DashboardWidgetConfig, WidgetType } from '../types';",
      "import type { DashboardWidgetConfig, WidgetType } from '../types';\nimport { IconPicker } from '../components/IconPicker';"
    );
  }

  s = s.replace(/\n\s*const \[iconQuery, setIconQuery\] = useState\([^;]+;/g, "");
  s = s.replace(/\n\s*const \[isIconPickerOpen, setIsIconPickerOpen\] = useState\([^;]+;/g, "");
  s = s.replace(/\n\s*setIconQuery\([^;]+;/g, "");

  const startNeedle = "            {(cardDraft.kind === 'light' || cardDraft.kind === 'device' || cardDraft.kind === 'cover') ? (";
  const endNeedle = "            {isBindableKind(cardDraft.kind) ? (";
  const start = s.indexOf(startNeedle);
  const end = s.indexOf(endNeedle, start);

  if (start >= 0 && end > start) {
    const replacement = `            {(cardDraft.kind === 'light' || cardDraft.kind === 'device' || cardDraft.kind === 'cover') ? (
              <IconPicker
                value={cardDraft.icon}
                onChange={(icon) => setCardDraft((draft) => ({ ...draft, icon }))}
              />
            ) : null}

`;
    s = s.slice(0, start) + replacement + s.slice(end);
  } else {
    console.warn("WARNING: Could not find SectionWidget icon block. It may already be patched.");
  }

  fs.writeFileSync(sectionPath, s, "utf8");
}

function patchWidgetInspector() {
  if (!fs.existsSync(inspectorPath)) {
    console.warn("WARNING: WidgetInspector.tsx not found.");
    return;
  }

  let s = fs.readFileSync(inspectorPath, "utf8");

  if (!s.includes("components/IconPicker")) {
    s = s.replace(
      /import ([^;]+) from ['"]\.\/types['"];?/,
      (match) => `${match}\nimport { IconPicker } from './components/IconPicker';`
    );

    if (!s.includes("components/IconPicker")) {
      s = s.replace(
        /(import[\s\S]*?from ['"][^'"]+['"];?\n)/,
        `$1import { IconPicker } from './components/IconPicker';\n`
      );
    }
  }

  // Replace the specific input block the user pasted.
  const inputRegex = /<input\s+ref=\{iconInputRef\}\s+type="text"[\s\S]*?onBlur=\{\(\) => setTimeout\(\(\) => setDropdownPos\(null\), 200\)\}\s*\/>/;

  if (inputRegex.test(s)) {
    s = s.replace(
      inputRegex,
      `<IconPicker
                  value={appearance.icon || ''}
                  label=""
                  onChange={(val) => {
                    onUpdate(safeWidget.id, { appearance: { ...appearance, icon: val } });
                  }}
                />`
    );
  } else {
    console.warn("WARNING: WidgetInspector icon input pattern was not found. Paste its icon block if it still uses old code.");
  }

  // Remove common old dropdown rendering blocks if they became unused is too risky automatically.
  // Keep old state/hooks for now if referenced elsewhere; TypeScript will tell us if any are unused.

  fs.writeFileSync(inspectorPath, s, "utf8");
}

patchSectionWidget();
patchWidgetInspector();

console.log("V27 safe shared IconPicker applied.");
console.log("Run: npm run build --workspace=apps/operator-console");
