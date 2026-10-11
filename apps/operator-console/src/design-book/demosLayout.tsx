import { Home, Lightbulb, Settings, Thermometer, Zap } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../components/ui/Card';
import { DeviceTileShell } from '../components/ui/DeviceTileShell';
import { Heading } from '../components/ui/Heading';
import { IconButton } from '../components/ui/IconButton';
import { PageFrame } from '../components/ui/PageFrame';
import { SectionHeader } from '../components/ui/SectionHeader';
import { SidebarItem } from '../components/ui/SidebarItem';
import { StatusPill } from '../components/ui/StatusPill';
import { DemoGrid, DemoItem, noop, type BookDemo } from './demoKit';

const cardVariants = ['default', 'elevated', 'flat', 'glass', 'error', 'active'] as const;
const cardCopy: Record<(typeof cardVariants)[number], string> = {
  default: 'Superficie estándar',
  elevated: 'Superficie elevada',
  flat: 'Superficie plana',
  glass: 'Superficie translúcida',
  error: 'Estado de error',
  active: 'Estado activo',
};

export const layoutDemos: Record<string, BookDemo> = {
  'Card': { render: () => (
    <DemoGrid>
      {cardVariants.map(variant => (
        <DemoItem key={variant} caption={variant}>
          <Card variant={variant}>
            <CardHeader>
              <CardTitle>{cardCopy[variant]}</CardTitle>
              <CardDescription>Resumen del consumo de la planta baja durante la semana.</CardDescription>
            </CardHeader>
            <CardContent>18,4 kWh</CardContent>
            <CardFooter><Button size="sm" variant="outline" onClick={noop}>Ver detalle</Button></CardFooter>
          </Card>
        </DemoItem>
      ))}
    </DemoGrid>
  ) },
  'Heading': { render: () => (
    <div className="flex min-w-0 flex-col gap-4">
      <DemoItem caption="view"><Heading variant="view">Panel de la casa</Heading></DemoItem>
      <DemoItem caption="section"><Heading variant="section">Dispositivos de la sala</Heading></DemoItem>
      <DemoItem caption="card"><Heading variant="card">Lámpara del escritorio</Heading></DemoItem>
      <DemoItem caption="item"><Heading variant="item">Sensor de temperatura</Heading></DemoItem>
      <DemoItem caption="label"><Heading variant="label">Estado del sistema</Heading></DemoItem>
    </div>
  ) },
  'SectionHeader': { render: () => (
    <div className="flex min-w-0 flex-col gap-4">
      <SectionHeader level="view" icon={Home} title="Mi hogar" subtitle="Controla tus dispositivos, escenas y rutinas desde un solo lugar."
        action={<Button onClick={noop}>Añadir dispositivo</Button>} />
      <SectionHeader level="section" icon={Lightbulb} title="Iluminación" subtitle="Luces de las habitaciones principales."
        action={<IconButton icon={Settings} label="Configurar" onClick={noop} />} />
      <SectionHeader level="group" icon={Zap} title="Consumo" subtitle="Últimos siete días" />
    </div>
  ) },
  'PageFrame': { render: () => (
    <DemoGrid columns="lg:grid-cols-3">
      <DemoItem caption="Ancho estándar">
        <PageFrame maxWidth="standard" className="border border-dashed border-border"><Heading variant="section">Contenido estándar</Heading></PageFrame>
      </DemoItem>
      <DemoItem caption="Ancho amplio">
        <PageFrame maxWidth="wide" className="border border-dashed border-border"><Heading variant="section">Contenido amplio</Heading></PageFrame>
      </DemoItem>
      <DemoItem caption="Inmersivo">
        <PageFrame immersive className="border border-dashed border-border"><Heading variant="section">Contenido inmersivo</Heading></PageFrame>
      </DemoItem>
    </DemoGrid>
  ) },
  'SidebarItem': { render: () => (
    <DemoGrid columns="md:grid-cols-2 xl:grid-cols-3">
      <DemoItem caption="Navegación">
        <div className="flex flex-col gap-1.5">
          <SidebarItem icon={Home} label="Inicio" active onClick={noop} />
          <SidebarItem icon={Lightbulb} label="Dispositivos" badge={<StatusPill size="sm" variant="primary">12</StatusPill>} onClick={noop} />
          <SidebarItem icon={Zap} label="Energía" soonText="Pronto" />
          <SidebarItem icon={Settings} label="Ajustes" disabled />
          <SidebarItem icon={Thermometer} label="Clima" nested onClick={noop} />
        </div>
      </DemoItem>
      <DemoItem caption="Contraído en escritorio (xl)">
        <div className="flex w-full flex-col gap-1.5 xl:w-16">
          <SidebarItem icon={Home} label="Inicio" active collapsedOnDesktop onClick={noop} />
          <SidebarItem icon={Lightbulb} label="Dispositivos" collapsedOnDesktop onClick={noop} />
        </div>
      </DemoItem>
    </DemoGrid>
  ) },
  'DeviceTileShell': { render: () => (
    <DemoGrid columns="sm:grid-cols-2 xl:grid-cols-4">
      <DemoItem caption="Apagado"><DeviceTileShell><Heading variant="card">Persiana del estudio</Heading></DeviceTileShell></DemoItem>
      <DemoItem caption="Encendido"><DeviceTileShell active interactive><Heading variant="card">Luz principal</Heading></DeviceTileShell></DemoItem>
      <DemoItem caption="Tono claro"><DeviceTileShell active tone="light"><Heading variant="card">Lámpara cálida</Heading></DeviceTileShell></DemoItem>
      <DemoItem caption="Sincronizando"><DeviceTileShell syncing><Heading variant="card">Ventilador</Heading></DeviceTileShell></DemoItem>
      <DemoItem caption="Deshabilitado"><DeviceTileShell disabled><Heading variant="card">Cerradura</Heading></DeviceTileShell></DemoItem>
    </DemoGrid>
  ) },
};
