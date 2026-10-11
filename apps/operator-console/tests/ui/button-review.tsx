import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Plus, Settings, SlidersHorizontal, X, Trash2, RefreshCw } from 'lucide-react';
import { Button } from '../../src/components/ui/Button';
import { IconButton } from '../../src/components/ui/IconButton';
import { Input, SearchInput } from '../../src/components/ui/Input';
import { Textarea } from '../../src/components/ui/Textarea';
import { ToggleSwitch } from '../../src/components/ui/ToggleSwitch';
import { SegmentedControl } from '../../src/components/ui/SegmentedControl';
import { SelectableOptionCard } from '../../src/components/ui/SelectableOptionCard';
import '../../src/index.css';

// Development-only entry: real primitives, synthetic state, no application bootstrap.
function IconReview() {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('Prueba local, sin conexión a dispositivos.');

  async function refresh() {
    setPending(true);
    setMessage('Demostración en curso…');
    await new Promise<void>(resolve => window.setTimeout(resolve, 1200));
    setPending(false);
    setMessage('Demostración terminada. No se guardó ningún dato.');
  }

  return <>
    <div className="mt-8">
      <h3 className="mb-3 text-sm font-semibold">Acciones</h3>
      <div className="grid grid-cols-2 gap-5 sm:grid-cols-4">
        <div className="space-y-2"><IconButton icon={SlidersHorizontal} label="Opciones" onClick={() => setMessage('Opciones: demostración local.')} /><p className="text-sm text-muted-foreground">Neutro</p></div>
        <div className="space-y-2"><IconButton icon={X} label="Cerrar" variant="ghost" onClick={() => setMessage('Cerrar: demostración local.')} /><p className="text-sm text-muted-foreground">Discreto</p></div>
        <div className="space-y-2"><IconButton icon={Plus} label="Agregar" variant="primary" onClick={() => setMessage('Agregar: demostración local.')} /><p className="text-sm text-muted-foreground">Principal</p></div>
        <div className="space-y-2"><IconButton icon={Trash2} label="Eliminar" variant="danger" onClick={() => setMessage('Eliminar: demostración local.')} /><p className="text-sm text-muted-foreground">Destructivo</p></div>
      </div>
    </div>
    <div className="mt-8">
      <h3 className="mb-3 text-sm font-semibold">Estados</h3>
      <div className="flex flex-wrap gap-5">
        <div className="space-y-2"><IconButton icon={Trash2} label="Eliminar deshabilitado" variant="danger" disabled /><p className="text-sm text-muted-foreground">Deshabilitado</p></div>
        <div className="space-y-2"><IconButton icon={RefreshCw} label="Actualizar" isLoading={pending} onClick={refresh} /><p className="text-sm text-muted-foreground">{pending ? 'Cargando…' : 'Probar carga'}</p></div>
      </div>
      <p role="status" className="mt-3 min-h-10 text-sm text-muted-foreground">{message}</p>
    </div>
    <p className="mt-6 text-sm text-muted-foreground">Si el icono no comunica la acción, utiliza un botón con texto.</p>
  </>;
}

function FieldReview({ multiline }: { multiline: boolean }) {
  const [value, setValue] = useState('Sala principal');
  const [query, setQuery] = useState('Iluminación');
  const Field = multiline ? Textarea : Input;

  return <div className="mt-8 space-y-6">
    <Field label={multiline ? 'Notas del espacio' : 'Nombre del espacio'} placeholder={multiline ? 'Añade información útil sobre este espacio…' : 'Ej. Sala principal'} helperText="Etiqueta siempre visible; ayuda solo cuando sea necesaria." />
    <Field label="Con contenido" value={value} onChange={event => setValue(event.target.value)} helperText="Ejemplo editable, sin guardar datos." />
    {!multiline && <SearchInput label="Buscar" value={query} onChange={event => setQuery(event.target.value)} endAdornment={query ? <IconButton icon={X} label="Limpiar búsqueda" variant="ghost" onClick={() => setQuery('')} /> : undefined} />}
    <Field label="Con error" error="Indica un nombre para continuar." placeholder="Campo obligatorio" />
    <Field label="Deshabilitado" disabled defaultValue="No disponible" />
    <Field label="Solo lectura" readOnly defaultValue="Valor conservado" />
  </div>;
}

function SelectionReview({ switches }: { switches: boolean }) {
  const [checked, setChecked] = useState(false);
  const [pending, setPending] = useState(false);
  const [value, setValue] = useState('all');
  const options = [{ value: 'all', label: 'Todo' }, { value: 'favorites', label: 'Favoritos' }, { value: 'unavailable', label: 'No disponible', disabled: true }, { value: 'recent', label: 'Recientes' }];
  async function toggle(next: boolean) {
    setPending(true);
    await new Promise<void>(resolve => window.setTimeout(resolve, 1200));
    setChecked(next);
    setPending(false);
  }
  return <div className="mt-8 space-y-6">
    {switches ? <>
      <div className="flex items-center justify-between gap-4"><span className="text-sm">Preferencia local</span><ToggleSwitch checked={checked} onCheckedChange={toggle} label="Preferencia local" isLoading={pending} /></div>
      <div className="flex items-center justify-between gap-4"><span className="text-sm">No disponible</span><ToggleSwitch checked disabled onCheckedChange={() => {}} label="No disponible" /></div>
      <p role="status" className="text-sm text-muted-foreground">{pending ? 'Aplicando…' : checked ? 'Activado' : 'Desactivado'}</p>
      <p className="text-sm text-muted-foreground">Estado persistente; no representa una acción momentánea. Demostración sin guardar datos.</p>
    </> : <>
      <div><h3 className="mb-3 text-sm font-semibold">Neutro</h3><SegmentedControl label="Vista neutra" value={value} options={options} onChange={setValue} /></div>
      <div><h3 className="mb-3 text-sm font-semibold">Con énfasis</h3><SegmentedControl label="Vista con énfasis" tone="primary" value={value} options={options} onChange={setValue} /></div>
      <p role="status" className="text-sm text-muted-foreground">Selección local: {options.find(option => option.value === value)?.label}</p>
      <p className="text-sm text-muted-foreground">Una elección dentro del grupo. Flechas y Home/End omiten las opciones deshabilitadas.</p>
    </>}
  </div>;
}

function OptionCardReview() {
  const [value, setValue] = useState('local');
  const options = [
    { id: 'local', title: 'Instalación local', description: 'El sistema funciona dentro del hogar.' },
    { id: 'custom', title: 'Configuración personalizada', description: 'Una descripción más larga se adapta al espacio disponible, sin ocultar información ni invadir la marca de selección.' },
    { id: 'unavailable', title: 'No disponible', description: 'Esta opción no puede seleccionarse.', disabled: true },
  ];
  return <div className="mt-8 space-y-6">
    <div role="radiogroup" aria-label="Tipo de instalación" className="space-y-3">
      {options.map(option => <SelectableOptionCard key={option.id} title={option.title} description={option.description} checked={value === option.id} disabled={option.disabled} onClick={() => setValue(option.id)} />)}
    </div>
    <p role="status" className="text-sm text-muted-foreground">Selección local: {options.find(option => option.id === value)?.title}</p>
    <p className="text-sm text-muted-foreground">Selecciona una opción; no ejecuta acciones ni guarda datos.</p>
  </div>;
}

type ReviewComponent = 'buttons' | 'icons' | 'fields' | 'textarea' | 'switches' | 'segments' | 'options';

function ThemeReview({ theme, component }: { theme: 'dark' | 'light'; component: ReviewComponent }) {
  const [pending, setPending] = useState(false);
  const [completed, setCompleted] = useState(false);

  async function demonstrateLoading() {
    setPending(true);
    setCompleted(false);
    await new Promise<void>(resolve => window.setTimeout(resolve, 1200));
    setPending(false);
    setCompleted(true);
  }

  return (
    <section aria-label={`Tema ${theme === 'dark' ? 'oscuro' : 'claro'}`} className={`${theme} min-w-0 rounded-panel bg-background p-5 text-foreground sm:p-8`}>
      <h2 className="text-xl font-semibold">{theme === 'dark' ? 'Oscuro' : 'Claro'}</h2>
      <p className="mt-1 text-sm text-muted-foreground">Un diseño. Colores según la intención.</p>
      {component === 'options' ? <OptionCardReview /> : component === 'switches' || component === 'segments' ? <SelectionReview switches={component === 'switches'} /> : component === 'fields' || component === 'textarea' ? <FieldReview multiline={component === 'textarea'} /> : component === 'icons' ? <IconReview /> : <>
      <div className="mt-8">
        <h3 className="mb-3 text-sm font-semibold">Acciones</h3>
        <div className="flex flex-wrap items-center gap-3">
          <Button type="button">Guardar</Button>
          <Button type="button" variant="secondary">Cancelar</Button>
          <Button type="button" variant="outline">Ver detalles</Button>
          <Button type="button" variant="ghost">Editar</Button>
          <Button type="button" variant="danger">Eliminar</Button>
          <Button type="button" variant="warning">Revisar</Button>
        </div>
      </div>
      <div className="mt-8">
        <h3 className="mb-3 text-sm font-semibold">Iconos</h3>
        <div className="flex flex-wrap items-center gap-3">
          <Button type="button"><Plus aria-hidden="true" />Agregar</Button>
          <IconButton icon={Settings} label="Configuración" />
        </div>
      </div>
      <div className="mt-8">
        <h3 className="mb-3 text-sm font-semibold">Estados</h3>
        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" disabled>Deshabilitado</Button>
          <Button type="button" isLoading={pending} onClick={demonstrateLoading}>
            {pending ? 'Guardando…' : 'Probar carga'}
          </Button>
        </div>
        <p role="status" className="mt-3 min-h-5 text-sm text-muted-foreground">
          {completed ? 'Demostración terminada. No se guardó ningún dato.' : 'Prueba local, sin conexión a dispositivos.'}
        </p>
      </div>
      </>}
    </section>
  );
}

function ButtonReview() {
  const requested = new URLSearchParams(window.location.search).get('component');
  const component: ReviewComponent = requested === 'icons' || requested === 'fields' || requested === 'textarea' || requested === 'switches' || requested === 'segments' || requested === 'options' ? requested : 'buttons';
  const titles = { buttons: 'Botones', icons: 'Botones de icono', fields: 'Campos de texto', textarea: 'Textarea', switches: 'Switches', segments: 'Selectores segmentados', options: 'Tarjetas de opción' };
  return (
    <main className="mx-auto max-w-6xl p-4 sm:p-8">
      <header className="mb-6 text-foreground">
        <h1 className="text-2xl font-semibold">{titles[component]} · HomePilot</h1>
        <p className="mt-2 text-sm text-muted-foreground">{component === 'options' ? 'Una tarjeta · mínimo 48 px · título 15 px · descripción 14 px' : component === 'switches' || component === 'segments' ? 'Un estándar · interacción mínima 44 px · estados claros' : component === 'fields' || component === 'textarea' ? 'Una superficie compartida · radio 12 px · etiquetas y ayuda legibles' : component === 'icons' ? 'Un solo componente · 44 × 44 px · radio 12 px · icono 16 px' : 'Componentes reales · mínimo 44 px · radio 12 px · texto 14 px'}</p>
      </header>
      <div className="grid gap-6 lg:grid-cols-2">
        <ThemeReview theme="dark" component={component} />
        <ThemeReview theme="light" component={component} />
      </div>
    </main>
  );
}

const root = document.getElementById('root');
if (!root) throw new Error('Falta el contenedor de revisión.');
createRoot(root).render(<ButtonReview />);
