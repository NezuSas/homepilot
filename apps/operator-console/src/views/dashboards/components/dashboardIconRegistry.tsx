import { useEffect, useState, type ComponentType } from 'react';
import {
  AirVent, AlarmClock, AppWindow, Battery, BatteryCharging, Bed, Bell, Blinds, Bluetooth,
  Bot, BriefcaseBusiness, Cable, Camera, Car, Cat, CircleHelp, CirclePower, Clock,
  CloudRain, Coffee, Compass, Cpu, Dog, DoorClosed, DoorOpen, Droplets, Fan, Flame,
  Flashlight, Flower2, Gauge, Hammer, HardDrive, Headphones, Home, Key, Lamp,
  LampCeiling, Laptop, LayoutGrid, Leaf, Lightbulb, Lock, LockOpen, MapPin, Mic,
  Monitor, Moon, MousePointerClick, Music2, Network, PanelTop, Plug, PlugZap, Power,
  Radio, Refrigerator, Router, Server, Settings, Shield, ShieldAlert, ShowerHead,
  SlidersHorizontal, Smartphone, SolarPanel, Sparkles, Speaker, Sprout, Sun,
  Thermometer, Timer, ToggleLeft, ToggleRight, TreePine, Tv, UserRound, Users,
  Volume, Volume2, VolumeX, WashingMachine, Waves, WavesLadder, Webcam, Wifi,
  WifiOff, Wind, Wrench, Zap,
} from 'lucide-react';
import {
  mdiAirConditioner, mdiAlarm, mdiAutoFix, mdiBlinds, mdiCamera, mdiCat,
  mdiCeilingFan, mdiClockOutline, mdiCursorDefaultClick, mdiDog, mdiDoor,
  mdiFan, mdiFire, mdiFlash, mdiGarage, mdiGauge, mdiHome,
  mdiLightbulb, mdiLock, mdiMusic, mdiPower, mdiPowerPlug, mdiRobot,
  mdiShield, mdiSpeaker, mdiTelevision, mdiThermometer, mdiWeatherWindy,
  mdiWindowShutter,
} from '@mdi/js';

type IconComponent = ComponentType<{ className?: string }>;
export interface DashboardMdiEntry {
  readonly name: string;
  readonly path: string;
  readonly searchText: string;
}
export interface DashboardMdiCatalog {
  readonly entries: ReadonlyArray<DashboardMdiEntry>;
  readonly byName: ReadonlyMap<string, DashboardMdiEntry>;
}

// Only common paths needed by a normal Dashboard are imported eagerly. The
// complete @mdi/js library is loaded from its separate CommonJS entry below.
const CORE_MDI_PATHS: Record<string, string> = {
  'mdi:air-conditioner': mdiAirConditioner, 'mdi:alarm': mdiAlarm,
  'mdi:auto-fix': mdiAutoFix, 'mdi:blinds': mdiBlinds, 'mdi:camera': mdiCamera,
  'mdi:cat': mdiCat, 'mdi:ceiling-fan': mdiCeilingFan,
  'mdi:clock-outline': mdiClockOutline, 'mdi:cursor-default-click': mdiCursorDefaultClick,
  'mdi:dog': mdiDog, 'mdi:door': mdiDoor, 'mdi:fan': mdiFan,
  'mdi:fire': mdiFire, 'mdi:flash': mdiFlash, 'mdi:garage': mdiGarage,
  'mdi:gauge': mdiGauge,
  'mdi:home': mdiHome, 'mdi:lightbulb': mdiLightbulb, 'mdi:lock': mdiLock,
  'mdi:music': mdiMusic, 'mdi:power': mdiPower, 'mdi:power-plug': mdiPowerPlug,
  'mdi:robot': mdiRobot, 'mdi:shield': mdiShield, 'mdi:speaker': mdiSpeaker,
  'mdi:television': mdiTelevision, 'mdi:thermometer': mdiThermometer,
  'mdi:weather-windy': mdiWeatherWindy, 'mdi:window-shutter': mdiWindowShutter,
};

export const DASHBOARD_ICON_DEFAULTS = {
  action: 'mdi:cursor-default-click', light: 'mdi:lightbulb',
  cover: 'mdi:blinds', camera: 'mdi:camera', sensor: 'mdi:gauge',
  media: 'mdi:music', room: 'mdi:home', scene: 'mdi:auto-fix',
  clock: 'mdi:clock-outline', energy: 'mdi:flash',
  assistant: 'mdi:robot', device: 'mdi:power',
} as const;
export const DASHBOARD_FALLBACK_ICON = CircleHelp;

// Existing Lucide values remain renderable, but are never offered for new choices.
const LEGACY_LUCIDE: Record<string, IconComponent> = {
  AirVent, AlarmClock, AppWindow, Battery, BatteryCharging, Bed, Bell, Blinds, Bluetooth,
  Bot, BriefcaseBusiness, Cable, Camera, Car, Cat, CircleHelp, CirclePower, Clock,
  CloudRain, Coffee, Compass, Cpu, Dog, DoorClosed, DoorOpen, Droplets, Fan, Flame,
  Flashlight, Flower2, Gauge, Hammer, HardDrive, Headphones, Home, Key, Lamp,
  LampCeiling, Laptop, LayoutGrid, Leaf, Lightbulb, Lock, LockOpen, MapPin, Mic,
  Monitor, Moon, MousePointerClick, Music2, Network, PanelTop, Plug, PlugZap, Power,
  Radio, Refrigerator, Router, Server, Settings, Shield, ShieldAlert, ShowerHead,
  SlidersHorizontal, Smartphone, SolarPanel, Sparkles, Speaker, Sprout, Sun,
  Thermometer, Timer, ToggleLeft, ToggleRight, TreePine, Tv, UserRound, Users,
  Volume, Volume2, VolumeX, WashingMachine, Waves, WavesLadder, Webcam, Wifi,
  WifiOff, Wind, Wrench, Zap,
};
const LEGACY_ALIASES: Record<string, string> = {
  assistant: 'Bot', briefcase: 'BriefcaseBusiness', music: 'Music2',
  powerplug: 'Plug', television: 'Tv', weatherwindy: 'Wind',
};

// Small HomePilot-specific search vocabulary; all other icons remain searchable
// by their real MDI names. No per-icon hand-maintained library is required.
const SEARCH_ALIASES: ReadonlyArray<readonly [RegExp, string]> = [
  [/camera|cctv/, 'camara seguridad'],
  [/lightbulb|lamp/, 'luz bombillo iluminacion'],
  [/door|gate/, 'puerta'],
  [/lock|key/, 'cerradura seguridad'],
  [/wifi|network|router/, 'red network internet'],
  [/battery/, 'bateria energia energy'],
  [/solar/, 'panel energia energy'],
  [/flash|lightning|power/, 'energia energy encendido'],
  [/volume|speaker/, 'volumen audio'],
  [/television|tv|video/, 'television tv media'],
  [/blind|curtain|shutter/, 'persiana cortina'],
  [/thermometer|temperature|air-conditioner/, 'temperatura temperature clima'],
  [/water|droplet/, 'agua'],
  [/pump/, 'bomba'],
  [/pool/, 'piscina'],
  [/alarm/, 'alarma'],
  [/shield|security|lock/, 'seguridad security'],
  [/sensor/, 'sensor'],
];

function foldSearch(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function normalizeLegacyName(value: string): string {
  return value.trim().replace(/^lucide[:\-_\s]*/i, '')
    .replace(/[-_\s]+(.)/g, (_match, letter: string) => letter.toUpperCase())
    .replace(/[^a-zA-Z0-9]/g, '').replace(/Icon$/i, '').toLowerCase();
}

function mdiExportToName(exportName: string): string {
  return `mdi:${exportName.slice(3)
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1-$2')
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/([a-zA-Z])([0-9])/g, '$1-$2').toLowerCase()}`;
}

const CANONICAL_MDI = /^mdi:[a-z0-9]+(?:-[a-z0-9]+)*$/;
let catalogPromise: Promise<DashboardMdiCatalog> | null = null;
let loadedCatalog: DashboardMdiCatalog | null = null;

export function getLoadedDashboardMdiCatalog(): DashboardMdiCatalog | null {
  return loadedCatalog;
}

export function loadDashboardMdiCatalog(): Promise<DashboardMdiCatalog> {
  if (!catalogPromise) {
    // A separate physical package entry prevents this full 7k-icon library
    // from sharing the eager, tree-shaken ESM module used for defaults.
    catalogPromise = import('@mdi/js/commonjs/mdi.js').then((module) => {
      const namespace = module as unknown as Record<string, unknown>;
      const exports = namespace.default && typeof namespace.default === 'object'
        ? namespace.default as Record<string, unknown> : namespace;
      const discovered: DashboardMdiEntry[] = Object.entries(exports)
        .filter((entry): entry is [string, string] => /^mdi[A-Z]/.test(entry[0]) && typeof entry[1] === 'string')
        .map(([exportName, path]) => {
          const name = mdiExportToName(exportName);
          const slug = name.slice(4).replace(/-/g, ' ');
          const aliases = SEARCH_ALIASES.filter(([pattern]) => pattern.test(name))
            .map(([, terms]) => terms).join(' ');
          return { name, path, searchText: foldSearch(`${name} ${slug} ${aliases}`) };
        });
      if (discovered.length < 1000) throw new Error('MDI_CATALOG_INVALID');
      const byName = new Map(discovered.map((entry): [string, DashboardMdiEntry] => [entry.name, entry]));
      const entries = [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));
      loadedCatalog = { entries, byName };
      return loadedCatalog;
    }).catch((error: unknown) => {
      catalogPromise = null;
      throw error;
    });
  }
  return catalogPromise;
}

export function searchDashboardMdiIcons(query: string, catalog: DashboardMdiCatalog): ReadonlyArray<DashboardMdiEntry> {
  const terms = foldSearch(query.trim()).split(/\s+/).filter(Boolean);
  if (!terms.length) return catalog.entries;
  return catalog.entries.filter((entry) => terms.every((term) => entry.searchText.includes(term)));
}

export function limitDashboardMdiIcons(
  entries: ReadonlyArray<DashboardMdiEntry>, selected: string, limit: number,
): ReadonlyArray<DashboardMdiEntry> {
  if (limit <= 0) return [];
  const selectedIndex = entries.findIndex((entry) => entry.name === selected);
  if (selectedIndex < 0 || selectedIndex < limit) return entries.slice(0, limit);
  return [entries[selectedIndex], ...entries.slice(0, limit - 1)];
}

export function DashboardMdiIcon({ path, className }: { path: string; className?: string }) {
  return <svg aria-hidden="true" className={className} fill="currentColor" viewBox="0 0 24 24"><path d={path} /></svg>;
}

const mdiComponents = new Map<string, IconComponent>();
function mdiComponent(path: string): IconComponent {
  let component = mdiComponents.get(path);
  if (!component) {
    component = function MdiIcon({ className }) { return <DashboardMdiIcon path={path} className={className} />; };
    mdiComponents.set(path, component);
  }
  return component;
}

const fallbackComponent = DASHBOARD_FALLBACK_ICON;
export function getDashboardFallbackIconComponent(): IconComponent { return fallbackComponent; }

const legacyByNormalized = new Map(Object.entries(LEGACY_LUCIDE)
  .map(([name, icon]): [string, IconComponent] => [normalizeLegacyName(name), icon]));
const dynamicMdiComponents = new Map<string, IconComponent>();

function dynamicMdiComponent(name: string): IconComponent {
  let component = dynamicMdiComponents.get(name);
  if (!component) {
    component = function DeferredMdiIcon({ className }) {
      const [path, setPath] = useState(() => loadedCatalog?.byName.get(name)?.path ?? null);
      useEffect(() => {
        let active = true;
        void loadDashboardMdiCatalog().then((catalog) => {
          if (active) setPath(catalog.byName.get(name)?.path ?? null);
        }).catch(() => { if (active) setPath(null); });
        return () => { active = false; };
      }, []);
      return path
        ? <DashboardMdiIcon path={path} className={className} />
        : <DASHBOARD_FALLBACK_ICON className={className} />;
    };
    dynamicMdiComponents.set(name, component);
  }
  return component;
}

/** null means a canonical MDI is awaiting the lazy catalog before validation. */
export function isDashboardIconAvailable(value?: string, catalog = loadedCatalog): boolean | null {
  if (!value?.trim()) return false;
  const raw = value.trim();
  if (raw.startsWith('mdi:')) {
    if (!CANONICAL_MDI.test(raw)) return false;
    if (CORE_MDI_PATHS[raw]) return true;
    return catalog ? catalog.byName.has(raw) : null;
  }
  const normalized = normalizeLegacyName(raw);
  return legacyByNormalized.has(normalized) || Boolean(LEGACY_ALIASES[normalized]);
}

export function getDashboardIconComponent(value?: string): IconComponent {
  const raw = value?.trim() ?? '';
  if (raw.startsWith('mdi:')) {
    if (!CANONICAL_MDI.test(raw)) return fallbackComponent;
    const path = CORE_MDI_PATHS[raw] ?? loadedCatalog?.byName.get(raw)?.path;
    if (path) return mdiComponent(path);
    return loadedCatalog ? fallbackComponent : dynamicMdiComponent(raw);
  }
  const normalized = normalizeLegacyName(raw);
  return legacyByNormalized.get(normalized)
    ?? LEGACY_LUCIDE[LEGACY_ALIASES[normalized] ?? ''] ?? fallbackComponent;
}

/** Search never persists a value; only a selected MDI entry may commit one. */
export function chooseDashboardIcon(name: string, onChange: (name: string) => void, catalog = loadedCatalog): void {
  if (name.startsWith('mdi:') && CANONICAL_MDI.test(name)
    && (CORE_MDI_PATHS[name] || catalog?.byName.has(name))) onChange(name);
}
