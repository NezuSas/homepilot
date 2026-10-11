import { BellRing, Inbox, Lightbulb, ShieldAlert, Thermometer } from 'lucide-react';
import { AlertBanner } from '../components/ui/AlertBanner';
import { AssistantCard } from '../components/ui/AssistantCard';
import { Button } from '../components/ui/Button';
import {
  AutomationRuleCardSkeleton,
  ManagedDeviceTileSkeleton,
  SceneCardSkeleton,
  TopologyRoomCardSkeleton,
} from '../components/ui/ComponentSkeletons';
import { DashboardCardSkeleton, DashboardSkeletonBar, type DashboardCardSkeletonVariant } from '../components/ui/DashboardCardSkeleton';
import { EmptyState } from '../components/ui/EmptyState';
import { LoadingState } from '../components/ui/LoadingState';
import { StatusPill } from '../components/ui/StatusPill';
import { DemoGrid, DemoItem, noop, type BookDemo } from './demoKit';

const skeletonVariants: DashboardCardSkeletonVariant[] = ['control', 'sensor', 'camera', 'media', 'climate', 'energy', 'display', 'generic'];

export const feedbackDemos: Record<string, BookDemo> = {
  'AlertBanner': { render: () => (
    <div className="flex min-w-0 flex-col gap-4">
      <AlertBanner variant="info" title="Actualización disponible" message="La versión 1.8 mejora la estabilidad de las cámaras."
        action={<Button variant="outline" onClick={noop}>Ver novedades</Button>} />
      <AlertBanner variant="success" title="Copia de seguridad lista" message="Se guardó la configuración de tu hogar hace unos minutos." />
      <AlertBanner variant="warning" title="Batería baja" message="El sensor de la puerta principal tiene menos del 15% de batería."
        action={<Button variant="warning" onClick={noop}>Recordar luego</Button>} />
      <AlertBanner variant="danger" title="Sin conexión" message="No se pudo contactar con Home Assistant. Reintentando."
        action={<Button variant="danger" onClick={noop}>Reintentar</Button>} />
      <DemoGrid columns="md:grid-cols-2">
        <DemoItem caption="Compacto informativo"><AlertBanner size="sm" variant="info" message="Los cambios se aplican al guardar." /></DemoItem>
        <DemoItem caption="Compacto con acción"><AlertBanner size="sm" variant="danger" message="No se pudo guardar la escena." action={<Button size="sm" variant="outline" onClick={noop}>Reintentar</Button>} /></DemoItem>
      </DemoGrid>
    </div>
  ) },
  'StatusPill': { render: () => (
    <div className="flex min-w-0 flex-col gap-6">
      <DemoItem caption="Variantes">
        <div className="flex flex-wrap items-center gap-2">
          <StatusPill variant="success">En línea</StatusPill>
          <StatusPill variant="warning">Batería baja</StatusPill>
          <StatusPill variant="danger">Error</StatusPill>
          <StatusPill variant="primary">Sincronizando</StatusPill>
          <StatusPill variant="neutral">Pausado</StatusPill>
          <StatusPill variant="offline">Sin conexión</StatusPill>
        </div>
      </DemoItem>
      <DemoItem caption="Tamaños y mayúsculas">
        <div className="flex flex-wrap items-center gap-2">
          <StatusPill size="sm" variant="primary">Pequeño</StatusPill>
          <StatusPill size="md" variant="primary">Mediano</StatusPill>
          <StatusPill size="lg" variant="primary">Grande</StatusPill>
          <StatusPill uppercase variant="success">Activo</StatusPill>
          <StatusPill pulse variant="success">En vivo</StatusPill>
        </div>
      </DemoItem>
      <DemoItem caption="Solo punto">
        <div className="flex items-center gap-4">
          <StatusPill dot variant="success" dotLabel="En línea" />
          <StatusPill dot pulse variant="warning" dotLabel="Atención" />
          <StatusPill dot variant="danger" dotLabel="Error" />
          <StatusPill dot variant="offline" dotLabel="Sin conexión" />
        </div>
      </DemoItem>
    </div>
  ) },
  'EmptyState': { render: () => (
    <DemoGrid columns="lg:grid-cols-3">
      <DemoItem caption="Predeterminado"><EmptyState icon={Inbox} title="Sin notificaciones" description="Cuando algo requiera tu atención aparecerá aquí." /></DemoItem>
      <DemoItem caption="Colección con acción"><EmptyState variant="collection" icon={Lightbulb} title="Aún no hay escenas" description="Crea una escena para controlar varias luces a la vez." action={<Button onClick={noop}>Crear escena</Button>} /></DemoItem>
      <DemoItem caption="Punteado"><EmptyState variant="dashed" icon={BellRing} title="Sin alertas activas" description="Todo funciona con normalidad." /></DemoItem>
    </DemoGrid>
  ) },
  'LoadingState': { render: () => (
    <LoadingState label="Cargando dispositivos">
      <DashboardSkeletonBar className="h-7 w-48" />
      <DashboardSkeletonBar className="h-4 w-72 max-w-full" />
      <DemoGrid>
        <DashboardSkeletonBar className="h-24 w-full" />
        <DashboardSkeletonBar className="h-24 w-full" />
        <DashboardSkeletonBar className="h-24 w-full" />
      </DemoGrid>
    </LoadingState>
  ) },
  'ComponentSkeletons': { render: () => (
    <DemoGrid>
      <DemoItem caption="Tarjeta de escena"><SceneCardSkeleton /></DemoItem>
      <DemoItem caption="Regla de automatización"><AutomationRuleCardSkeleton /></DemoItem>
      <DemoItem caption="Dispositivo gestionado"><ManagedDeviceTileSkeleton /></DemoItem>
      <DemoItem caption="Habitación"><TopologyRoomCardSkeleton /></DemoItem>
    </DemoGrid>
  ) },
  'DashboardCardSkeleton': { render: () => (
    <DemoGrid columns="grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {skeletonVariants.map(variant => (
        <DemoItem key={variant} caption={variant}>
          <div className="h-44"><DashboardCardSkeleton variant={variant} /></div>
        </DemoItem>
      ))}
    </DemoGrid>
  ) },
  'AssistantCard': { render: () => (
    <DemoGrid>
      <AssistantCard icon={ShieldAlert} category="Seguridad" title="Puerta del garaje abierta" severity="critical" severityLabel="Crítica"
        description="La puerta lleva más de 30 minutos abierta mientras nadie está en casa."
        actions={<><Button size="sm" onClick={noop}>Cerrar puerta</Button><Button size="sm" variant="ghost" onClick={noop}>Ignorar</Button></>} />
      <AssistantCard icon={Thermometer} category="Energía" title="Aire acondicionado encendido" severity="medium" severityLabel="Media"
        description="El aire de la sala sigue encendido con las ventanas abiertas."
        actions={<Button size="sm" variant="outline" onClick={noop}>Apagar</Button>} />
      <AssistantCard icon={Lightbulb} category="Iluminación" title="Rutina de la noche" severity="low" severityLabel="Baja"
        description="Puedo apagar las luces de la planta baja a las 23:00."
        actions={<Button size="sm" variant="secondary" onClick={noop}>Crear rutina</Button>} />
      <AssistantCard icon={BellRing} category="Sugerencia" title="Revisa tus sensores"
        description="Dos sensores no han reportado datos en las últimas horas." />
    </DemoGrid>
  ) },
};
