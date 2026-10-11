import { Clock, Gauge } from 'lucide-react';
import { DateField } from '../components/ui/DateField';
import { Input, SearchInput } from '../components/ui/Input';
import { MeasurementUnitSelect } from '../components/ui/MeasurementUnitSelect';
import { NumberInput } from '../components/ui/NumberInput';
import { RangeInput } from '../components/ui/RangeInput';
import { SearchFilterBar } from '../components/ui/SearchFilterBar';
import { SearchableSelectField } from '../components/ui/SearchableSelectField';
import { SegmentedControl } from '../components/ui/SegmentedControl';
import { SelectableOptionCard } from '../components/ui/SelectableOptionCard';
import { Textarea } from '../components/ui/Textarea';
import { ToggleSwitch } from '../components/ui/ToggleSwitch';
import { DemoGrid, DemoItem, noop, type BookDemo } from './demoKit';

const rooms = [
  { value: 'sala', label: 'Sala', description: 'Planta baja', group: 'Planta baja' },
  { value: 'cocina', label: 'Cocina', description: 'Planta baja', group: 'Planta baja' },
  { value: 'dormitorio', label: 'Dormitorio principal', description: 'Planta alta', group: 'Planta alta' },
  { value: 'estudio', label: 'Estudio', description: 'Planta alta', group: 'Planta alta' },
  { value: 'garaje', label: 'Garaje', group: 'Exterior' },
];

const modes = [
  { value: 'auto', label: 'Automático' },
  { value: 'cool', label: 'Frío' },
  { value: 'heat', label: 'Calor' },
  { value: 'off', label: 'Apagado', disabled: true },
];

const iconModes = [
  { value: 'auto', label: 'Auto', icon: Gauge },
  { value: 'cool', label: 'Frío', icon: Gauge },
  { value: 'heat', label: 'Calor', icon: Gauge },
];

const sections = [
  { value: 'a', label: 'Resumen general' },
  { value: 'b', label: 'Dispositivos conectados' },
  { value: 'c', label: 'Automatizaciones activas' },
  { value: 'd', label: 'Historial' },
];

const filters = [
  { value: 'all', label: 'Todas' },
  { value: 'active', label: 'Activas' },
  { value: 'draft', label: 'Borradores' },
];

export const formsDemos: Record<string, BookDemo> = {
  'Input': { render: () => (
    <DemoGrid>
      <DemoItem caption="Con etiqueta"><Input label="Nombre del dispositivo" placeholder="Lámpara de la sala" /></DemoItem>
      <DemoItem caption="Con ayuda"><Input label="Dirección IP" defaultValue="192.168.1.24" helperText="Se detecta en la red local." /></DemoItem>
      <DemoItem caption="Con icono"><Input label="Zona horaria" icon={<Clock className="size-4" />} defaultValue="America/Guayaquil" /></DemoItem>
      <DemoItem caption="Con error"><Input label="Correo" defaultValue="casa@" error="Introduce un correo válido." /></DemoItem>
      <DemoItem caption="Deshabilitado"><Input label="Identificador" defaultValue="hp-0042" disabled /></DemoItem>
      <DemoItem caption="Búsqueda"><SearchInput placeholder="Buscar dispositivos" /></DemoItem>
    </DemoGrid>
  ) },
  'Textarea': { render: () => (
    <DemoGrid columns="md:grid-cols-2 xl:grid-cols-3">
      <DemoItem caption="Predeterminado"><Textarea label="Notas" placeholder="Describe la rutina de la noche" /></DemoItem>
      <DemoItem caption="Con ayuda"><Textarea label="Descripción" defaultValue="Apaga las luces y cierra las cortinas." helperText="Máximo 200 caracteres." /></DemoItem>
      <DemoItem caption="Con error"><Textarea label="Motivo" error="Este campo es obligatorio." /></DemoItem>
      <DemoItem caption="Deshabilitado"><Textarea label="Bitácora" defaultValue="Solo lectura." disabled /></DemoItem>
    </DemoGrid>
  ) },
  'NumberInput': { render: () => (
    <DemoGrid>
      <DemoItem caption="Valor"><NumberInput label="Temperatura objetivo" value={22} onValueChange={noop} min={16} max={30} /></DemoItem>
      <DemoItem caption="Vacío"><NumberInput label="Duración (min)" onValueChange={noop} placeholder="0" /></DemoItem>
      <DemoItem caption="Con ayuda"><NumberInput label="Umbral de humedad" value={55} onValueChange={noop} helperText="Entre 30 y 80 por ciento." /></DemoItem>
      <DemoItem caption="Con error"><NumberInput label="Potencia (W)" value={-5} onValueChange={noop} error="Debe ser positivo." /></DemoItem>
      <DemoItem caption="Deshabilitado"><NumberInput label="Reintentos" value={3} onValueChange={noop} disabled /></DemoItem>
    </DemoGrid>
  ) },
  'DateField': { render: () => (
    <DemoGrid>
      <DemoItem caption="Vacío"><DateField label="Fecha de inicio" placeholderLabel="Elige una fecha" /></DemoItem>
      <DemoItem caption="Con valor"><DateField label="Fecha de fin" value="2026-12-24" onChange={noop} /></DemoItem>
      <DemoItem caption="Con error"><DateField label="Vencimiento" error="La fecha ya pasó." placeholderLabel="Elige una fecha" /></DemoItem>
    </DemoGrid>
  ) },
  'RangeInput': { render: () => (
    <DemoGrid>
      <DemoItem caption="Con límites"><RangeInput value={65} min={0} max={100} onValueChange={noop} showBounds formatValue={value => `${value}%`} aria-label="Brillo" /></DemoItem>
      <DemoItem caption="Sin límites"><RangeInput value={30} min={0} max={100} onValueChange={noop} aria-label="Volumen" /></DemoItem>
      <DemoItem caption="Deshabilitado"><RangeInput value={40} min={0} max={100} onValueChange={noop} disabled showBounds aria-label="Intensidad" /></DemoItem>
    </DemoGrid>
  ) },
  'SegmentedControl': { render: () => (
    <DemoGrid columns="md:grid-cols-2">
      <DemoItem caption="Neutral"><SegmentedControl label="Modo" value="auto" options={modes} onChange={noop} /></DemoItem>
      <DemoItem caption="Primario con iconos"><SegmentedControl label="Vista" tone="primary" value="cool" options={iconModes} onChange={noop} /></DemoItem>
      <DemoItem caption="Desplazable"><SegmentedControl label="Secciones" layout="scroll" value="b" options={sections} onChange={noop} /></DemoItem>
    </DemoGrid>
  ) },
  'ToggleSwitch': { render: () => (
    <DemoGrid columns="grid-cols-2 sm:grid-cols-3 xl:grid-cols-6">
      <DemoItem caption="Apagado"><ToggleSwitch label="Luz de la sala" checked={false} onCheckedChange={noop} /></DemoItem>
      <DemoItem caption="Encendido"><ToggleSwitch label="Alarma" checked onCheckedChange={noop} /></DemoItem>
      <DemoItem caption="Pequeño"><ToggleSwitch label="Modo noche" size="sm" checked onCheckedChange={noop} /></DemoItem>
      <DemoItem caption="Cargando"><ToggleSwitch label="Riego" checked isLoading onCheckedChange={noop} /></DemoItem>
      <DemoItem caption="Deshabilitado"><ToggleSwitch label="Cerradura" checked={false} disabled onCheckedChange={noop} /></DemoItem>
      <DemoItem caption="Activo bloqueado"><ToggleSwitch label="Cámara" checked disabled onCheckedChange={noop} /></DemoItem>
    </DemoGrid>
  ) },
  'SelectableOptionCard': { render: () => (
    <DemoGrid>
      <DemoItem caption="Seleccionada"><SelectableOptionCard checked title="Modo ahorro" description="Reduce el consumo cuando no hay nadie en casa." /></DemoItem>
      <DemoItem caption="Sin seleccionar"><SelectableOptionCard checked={false} title="Modo confort" description="Mantiene la temperatura estable todo el día." /></DemoItem>
      <DemoItem caption="Sin descripción"><SelectableOptionCard checked={false} title="Solo manual" /></DemoItem>
      <DemoItem caption="Deshabilitada"><SelectableOptionCard checked={false} disabled title="Modo vacaciones" description="Disponible con la suscripción Cloud." /></DemoItem>
    </DemoGrid>
  ) },
  'SearchFilterBar': { render: () => (
    <div className="flex min-w-0 flex-col gap-6">
      <DemoItem caption="Con filtros">
        <SearchFilterBar searchQuery="sala" onSearchChange={noop} searchPlaceholder="Buscar escenas" activeFilter="all" onFilterChange={noop} options={filters} />
      </DemoItem>
      <DemoItem caption="Solo búsqueda">
        <SearchFilterBar searchQuery="" onSearchChange={noop} searchPlaceholder="Buscar automatizaciones" />
      </DemoItem>
    </div>
  ) },
  'SearchableSelectField': { capture: 'viewport', openSelector: 'button[aria-haspopup="dialog"]', render: () => (
    <div className="max-w-md">
      <SearchableSelectField label="Habitación" value="sala" options={rooms} onChange={noop} placeholder="Elige una habitación" helperText="Se asigna al dispositivo." />
    </div>
  ) },
  'MeasurementUnitSelect': { render: () => (
    <DemoGrid>
      <DemoItem caption="Con unidad"><MeasurementUnitSelect label="Unidad" value="kWh" noUnitLabel="Sin unidad" onChange={noop} /></DemoItem>
      <DemoItem caption="Sin unidad"><MeasurementUnitSelect label="Unidad" value="" noUnitLabel="Sin unidad" onChange={noop} /></DemoItem>
      <DemoItem caption="Deshabilitado"><MeasurementUnitSelect label="Unidad" value="°C" noUnitLabel="Sin unidad" onChange={noop} disabled /></DemoItem>
    </DemoGrid>
  ) },
};
