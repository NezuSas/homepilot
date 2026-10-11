import { Plus, Power, Trash2 } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { IconButton } from '../components/ui/IconButton';
import { SurfaceButton } from '../components/ui/SurfaceButton';
import { DemoGrid, DemoItem, noop, type BookDemo } from './demoKit';

const buttonVariants = ['primary', 'secondary', 'outline', 'ghost', 'danger', 'warning'] as const;
const buttonLabels: Record<(typeof buttonVariants)[number], string> = {
  primary: 'Guardar',
  secondary: 'Duplicar',
  outline: 'Cancelar',
  ghost: 'Omitir',
  danger: 'Eliminar',
  warning: 'Revisar',
};

export const actionsDemos: Record<string, BookDemo> = {
  'Button': { render: () => (
    <div className="flex min-w-0 flex-col gap-6">
      <DemoGrid columns="grid-cols-2 sm:grid-cols-3 xl:grid-cols-6">
        {buttonVariants.map(variant => (
          <DemoItem key={variant} caption={variant}><Button variant={variant} onClick={noop}>{buttonLabels[variant]}</Button></DemoItem>
        ))}
      </DemoGrid>
      <DemoGrid columns="grid-cols-2 sm:grid-cols-4">
        <DemoItem caption="Con icono"><Button onClick={noop}><Plus aria-hidden="true" />Añadir</Button></DemoItem>
        <DemoItem caption="Cargando"><Button isLoading>Guardando</Button></DemoItem>
        <DemoItem caption="Deshabilitado"><Button disabled>Guardar</Button></DemoItem>
        <DemoItem caption="Icono"><Button size="icon" aria-label="Encender" onClick={noop}><Power aria-hidden="true" /></Button></DemoItem>
      </DemoGrid>
    </div>
  ) },
  'IconButton': { render: () => (
    <DemoGrid columns="grid-cols-2 sm:grid-cols-3 xl:grid-cols-6">
      <DemoItem caption="default"><IconButton icon={Power} label="Encender" onClick={noop} /></DemoItem>
      <DemoItem caption="ghost"><IconButton icon={Plus} label="Añadir" variant="ghost" onClick={noop} /></DemoItem>
      <DemoItem caption="primary"><IconButton icon={Plus} label="Crear" variant="primary" onClick={noop} /></DemoItem>
      <DemoItem caption="danger"><IconButton icon={Trash2} label="Eliminar" variant="danger" onClick={noop} /></DemoItem>
      <DemoItem caption="cargando"><IconButton icon={Power} label="Aplicando" isLoading /></DemoItem>
      <DemoItem caption="deshabilitado"><IconButton icon={Power} label="No disponible" disabled /></DemoItem>
    </DemoGrid>
  ) },
  'SurfaceButton': { render: () => (
    <DemoGrid columns="grid-cols-1 sm:grid-cols-3">
      <DemoItem caption="Superficie"><SurfaceButton className="min-h-16 w-full rounded-card px-4" onClick={noop}>Abrir la sala</SurfaceButton></DemoItem>
      <DemoItem caption="Cargando"><SurfaceButton isLoading className="min-h-16 w-full rounded-card px-4">Conectando</SurfaceButton></DemoItem>
      <DemoItem caption="Deshabilitado"><SurfaceButton disabled className="min-h-16 w-full rounded-card px-4">No disponible</SurfaceButton></DemoItem>
    </DemoGrid>
  ) },
};
