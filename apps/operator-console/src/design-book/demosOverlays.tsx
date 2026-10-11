import { Copy, Pencil, Trash2 } from 'lucide-react';
import { ActionMenu } from '../components/ui/ActionMenu';
import { Button } from '../components/ui/Button';
import { Card, CardDescription, CardHeader, CardTitle } from '../components/ui/Card';
import { Drawer } from '../components/ui/Drawer';
import { Heading } from '../components/ui/Heading';
import { Input } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { ToggleSwitch } from '../components/ui/ToggleSwitch';
import { DemoGrid, noop, type BookDemo } from './demoKit';

const menuItems = [
  { label: 'Editar escena', icon: Pencil, onSelect: noop },
  { label: 'Duplicar', icon: Copy, onSelect: noop },
  { label: 'Eliminar', icon: Trash2, onSelect: noop, danger: true },
];

/** Page content that the overlay dims, so the layer reads as it does in the app. */
function BackdropContent() {
  return (
    <DemoGrid>
      {['Sala', 'Cocina', 'Dormitorio'].map(room => (
        <Card key={room}>
          <CardHeader>
            <CardTitle>{room}</CardTitle>
            <CardDescription>4 dispositivos conectados</CardDescription>
          </CardHeader>
        </Card>
      ))}
    </DemoGrid>
  );
}

export const overlayDemos: Record<string, BookDemo> = {
  'ActionMenu': { capture: 'viewport', openSelector: 'button[aria-haspopup="menu"]', render: () => (
    <div className="flex items-center justify-between gap-4">
      <Heading variant="card">Escena: Buenas noches</Heading>
      <ActionMenu label="Acciones de la escena" items={menuItems} />
    </div>
  ) },
  'Modal': { capture: 'viewport', render: () => (
    <>
      <BackdropContent />
      <Modal isOpen onClose={noop} variant="warning" title="¿Eliminar la escena?"
        description="Se quitará de tus paneles y las automatizaciones que la usan dejarán de ejecutarla."
        footer={<div className="flex w-full flex-col gap-3 p-5 sm:flex-row sm:justify-end sm:px-8">
          <Button variant="ghost" onClick={noop}>Cancelar</Button>
          <Button variant="danger" onClick={noop}>Eliminar</Button>
        </div>}>
        <Input label="Escribe el nombre para confirmar" placeholder="Buenas noches" />
      </Modal>
    </>
  ) },
  'Drawer': { capture: 'viewport', render: () => (
    <>
      <BackdropContent />
      <Drawer isOpen onClose={noop} title="Detalles del dispositivo" description="Ajustes de la lámpara de la sala">
        <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-5 pt-16 sm:p-6 sm:pt-20">
          <Heading variant="section">Lámpara de la sala</Heading>
          <Input label="Nombre" defaultValue="Lámpara de la sala" />
          <ToggleSwitch label="Encender al anochecer" checked onCheckedChange={noop} />
          <div className="flex flex-wrap gap-3">
            <Button onClick={noop}>Guardar cambios</Button>
            <Button variant="ghost" onClick={noop}>Cancelar</Button>
          </div>
        </div>
      </Drawer>
    </>
  ) },
};
