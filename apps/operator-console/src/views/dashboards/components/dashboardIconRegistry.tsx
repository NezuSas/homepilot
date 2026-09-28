import type { ComponentType } from 'react';
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
  mdiAirConditioner, mdiAlarm, mdiBlinds, mdiCamera, mdiCat, mdiCctv,
  mdiCeilingFan, mdiCurtains, mdiDog, mdiDoor, mdiFan, mdiFire, mdiGarage,
  mdiGarageOpen, mdiHome, mdiLightbulb, mdiLock, mdiMusic, mdiPool, mdiPower,
  mdiPowerPlug, mdiPump, mdiShield, mdiSolarPanel, mdiSpeaker, mdiTelevision,
  mdiThermometer, mdiWater, mdiWeatherWindy, mdiWindowShutter,
} from '@mdi/js';

type IconComponent = ComponentType<{ className?: string }>;
export interface DashboardIconEntry {
  readonly name: string;
  readonly icon: IconComponent;
  readonly searchText: string;
}

// Named imports keep the bundle limited to this curated catalog.
const LUCIDE_ICONS: Record<string, IconComponent> = {
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

const MATERIAL_PATHS: Record<string, string> = {
  'mdi:air-conditioner': mdiAirConditioner, 'mdi:alarm': mdiAlarm,
  'mdi:blinds': mdiBlinds, 'mdi:camera': mdiCamera, 'mdi:cat': mdiCat,
  'mdi:cctv': mdiCctv, 'mdi:ceiling-fan': mdiCeilingFan,
  'mdi:curtains': mdiCurtains, 'mdi:dog': mdiDog, 'mdi:door': mdiDoor,
  'mdi:fan': mdiFan, 'mdi:fire': mdiFire, 'mdi:garage': mdiGarage,
  'mdi:garage-open': mdiGarageOpen, 'mdi:home': mdiHome,
  'mdi:lightbulb': mdiLightbulb, 'mdi:lock': mdiLock,
  'mdi:music': mdiMusic, 'mdi:pool': mdiPool, 'mdi:power': mdiPower,
  'mdi:power-plug': mdiPowerPlug, 'mdi:pump': mdiPump, 'mdi:shield': mdiShield,
  'mdi:solar-panel': mdiSolarPanel, 'mdi:speaker': mdiSpeaker,
  'mdi:television': mdiTelevision, 'mdi:thermometer': mdiThermometer,
  'mdi:water': mdiWater, 'mdi:weather-windy': mdiWeatherWindy,
  'mdi:window-shutter': mdiWindowShutter,
};

const SEARCH_TERMS: Record<string, string> = {
  AirVent: 'climate air conditioner aire climatizacion', Battery: 'energy energia bateria',
  Blinds: 'blind persiana cortina cover', Camera: 'camara seguridad video',
  DoorClosed: 'door puerta cerrada', DoorOpen: 'door puerta abierta',
  Droplets: 'agua humedad', Fan: 'ventilador clima', Home: 'house hogar casa',
  Lamp: 'luz iluminacion', Lightbulb: 'light luz iluminacion',
  Lock: 'cerradura seguridad', Mic: 'microfono audio',
  Monitor: 'android display pantalla', MousePointerClick: 'accion boton pulsar click',
  Music2: 'musica audio', Plug: 'enchufe toma corriente',
  Power: 'encendido apagado energy energia', Router: 'red wifi internet',
  SolarPanel: 'solar energy energia panel', Sparkles: 'escena automatizacion',
  Sprout: 'jardin plantas', Thermometer: 'temperature temperatura clima',
  Timer: 'horario tiempo rutina', Tv: 'television multimedia',
  Volume2: 'volume volumen audio', WavesLadder: 'piscina agua',
  Wifi: 'red internet', 'mdi:curtains': 'blind cortinas persianas',
  'mdi:pool': 'piscina agua', 'mdi:pump': 'bomba agua',
  'mdi:solar-panel': 'solar energy energia', 'mdi:water': 'agua humedad',
};

function normalizeIconName(value: string): string {
  return value.trim().replace(/^(lucide|mdi)[:\-_\s]*/i, '')
    .replace(/[-_\s]+(.)/g, (_match, letter: string) => letter.toUpperCase())
    .replace(/[^a-zA-Z0-9]/g, '').replace(/Icon$/i, '').toLowerCase();
}

function foldSearch(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function materialIcon(path: string): IconComponent {
  return function MaterialIcon({ className }) {
    return <svg aria-hidden="true" className={className} fill="currentColor" viewBox="0 0 24 24"><path d={path} /></svg>;
  };
}

export const DASHBOARD_ICON_DEFAULTS = {
  action: 'MousePointerClick', light: 'mdi:lightbulb', cover: 'Blinds', camera: 'Camera',
  sensor: 'Gauge', media: 'Music2', room: 'Home', scene: 'Sparkles', clock: 'Clock',
  energy: 'Zap', assistant: 'Bot', device: 'Power', fallback: 'CircleHelp',
} as const;

export const DASHBOARD_ICON_CATALOG: ReadonlyArray<DashboardIconEntry> = [
  ...Object.entries(LUCIDE_ICONS).map(([name, icon]) => ({
    name, icon, searchText: foldSearch(`${normalizeIconName(name)} ${SEARCH_TERMS[name] ?? ''}`),
  })),
  ...Object.entries(MATERIAL_PATHS).map(([name, path]) => ({
    name, icon: materialIcon(path),
    searchText: foldSearch(`${normalizeIconName(name)} ${name.slice(4).replace(/-/g, ' ')} ${SEARCH_TERMS[name] ?? ''}`),
  })),
].sort((a, b) => a.name.localeCompare(b.name));

const ICON_BY_NAME = new Map<string, IconComponent>(DASHBOARD_ICON_CATALOG
  .map((entry): [string, IconComponent] => [entry.name, entry.icon]));
const LUCIDE_BY_NORMALIZED = new Map<string, IconComponent>(Object.entries(LUCIDE_ICONS)
  .map(([name, icon]): [string, IconComponent] => [normalizeIconName(name), icon]));
const MATERIAL_BY_NORMALIZED = new Map<string, IconComponent>(DASHBOARD_ICON_CATALOG
  .filter((entry) => entry.name.startsWith('mdi:'))
  .map((entry): [string, IconComponent] => [normalizeIconName(entry.name), entry.icon]));
const LEGACY_ALIASES: Record<string, string> = {
  assistant: 'Bot', briefcase: 'BriefcaseBusiness', music: 'Music2',
  powerplug: 'Plug', television: 'Tv', weatherwindy: 'Wind',
};

export function isDashboardIconAvailable(value?: string): boolean {
  if (!value?.trim()) return false;
  const raw = value.trim();
  if (ICON_BY_NAME.has(raw)) return true;
  const normalized = normalizeIconName(raw);
  if (/^mdi[:\-_\s]/i.test(raw)) return MATERIAL_BY_NORMALIZED.has(normalized);
  return LUCIDE_BY_NORMALIZED.has(normalized) || MATERIAL_BY_NORMALIZED.has(normalized)
    || Boolean(LEGACY_ALIASES[normalized]);
}

export function getDashboardIconComponent(value?: string): IconComponent {
  const fallback = LUCIDE_ICONS[DASHBOARD_ICON_DEFAULTS.fallback];
  if (!value?.trim()) return fallback;
  const raw = value.trim();
  const normalized = normalizeIconName(raw);
  if (/^mdi[:\-_\s]/i.test(raw)) {
    return ICON_BY_NAME.get(raw) ?? MATERIAL_BY_NORMALIZED.get(normalized) ?? fallback;
  }
  return ICON_BY_NAME.get(raw) ?? LUCIDE_BY_NORMALIZED.get(normalized)
    ?? MATERIAL_BY_NORMALIZED.get(normalized)
    ?? ICON_BY_NAME.get(LEGACY_ALIASES[normalized] ?? '') ?? fallback;
}

export function searchDashboardIcons(query: string): ReadonlyArray<DashboardIconEntry> {
  const terms = foldSearch(query.trim()).split(/\s+/).filter(Boolean);
  if (!terms.length) return DASHBOARD_ICON_CATALOG;
  return DASHBOARD_ICON_CATALOG.filter((entry) => terms.every((term) => entry.searchText.includes(term)));
}

/** Search text never changes persistence; only an explicit choice from the catalog does. */
export function chooseDashboardIcon(name: string, onChange: (name: string) => void): void {
  if (ICON_BY_NAME.has(name)) onChange(name);
}
