import { renderToStaticMarkup } from 'react-dom/server';
import { Plus } from 'lucide-react';
import { IconButton } from './IconButton';
import { SurfaceButton } from './SurfaceButton';
import { Input, SearchInput } from './Input';
import { Textarea } from './Textarea';
import { SegmentedControl } from './SegmentedControl';
import { SelectableOptionCard } from './SelectableOptionCard';
import { SearchFilterBar } from './SearchFilterBar';
import { AutomationBuilderIdentityField } from '../AutomationBuilderIdentityField';
import { AutomationWorkbenchForm } from '../AutomationWorkbenchForm';
import { DashboardCreateForm } from '../DashboardCreateForm';
import { InlineTabCreator } from '../InlineTabCreator';

jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('../../stores/useDeviceSnapshotStore', () => ({ useDeviceSnapshotStore: (selector: (state: { roomsByHome: Record<string, never[]> }) => unknown) => selector({ roomsByHome: {} }) }));

describe('Feature: Shared button standard and interactive surfaces (AC79)', () => {
  it.each([false, true])('Scenario: dashboard creation keeps accessible input and submitting=$submitting', submitting => {
    const html = renderToStaticMarkup(<DashboardCreateForm title="Nombre del tablero" value="Casa" placeholder="Ej. Casa" confirmLabel="Crear" isSubmitting={submitting} onValueChange={() => {}} onConfirm={() => {}} onCancel={() => {}} />);
    expect(html).toContain('hp-text-field flex h-11');
    expect(html).toContain('aria-label="Nombre del tablero"');
    expect(html).toContain('value="Casa"');
    expect(/<input[^>]*disabled=""/.test(html)).toBe(submitting);
  });
  it('Scenario: tab creation retains initial value, accessible name and central field style', () => {
    const html = renderToStaticMarkup(<InlineTabCreator initialValue="Patio" placeholder="Nueva pestaña" confirmLabel="Confirmar" cancelLabel="Cancelar" onConfirm={() => {}} onCancel={() => {}} />);
    expect(html).toContain('value="Patio"');
    expect(html).toContain('aria-label="Nueva pestaña"');
    expect(html).toContain('hp-text-field flex h-11');
    expect(html).not.toContain('h-7');
  });
  it('Scenario: legacy automation workbench retains required values through shared inputs', () => {
    const html = renderToStaticMarkup(<AutomationWorkbenchForm formData={{ name: 'Sala', triggerDeviceId: '', stateKey: 'temperature', expectedValue: '23.5', targetDeviceId: '', command: 'turn_on' }} devices={[]} editingId={null} submitting={false} success={false} createError={null} onSubmit={() => {}} onChange={() => {}} />);
    expect(html.match(/hp-text-field flex h-11/g)).toHaveLength(3);
    expect(html).toContain('value="temperature"');
    expect(html).toContain('value="23.5"');
    expect(html).toContain('value="Sala"');
    expect(html.match(/<input[^>]*required=""/g)).toHaveLength(3);
    expect(html).not.toContain('font-mono');
  });
  it('Scenario: automation identity retains native value, label and initial focus without a local skin', () => {
    const html = renderToStaticMarkup(<AutomationBuilderIdentityField label="Nombre" placeholder="Ej. Iluminación" value="Sala" onChange={() => {}} />);
    expect(html).toContain('hp-text-field flex h-11');
    expect(html).toContain('hp-field-label');
    expect(html).toContain('value="Sala"');
    expect(html).toContain('autofocus=""');
    expect(html).toContain('placeholder="Ej. Iluminación"');
    expect(html).not.toContain('h-14');
    expect(html).not.toContain('rounded-field');
  });
  it('Scenario: composed horizontal filters retain search, clear action and central selector geometry', () => {
    const html = renderToStaticMarkup(<SearchFilterBar searchQuery="Sala" onSearchChange={() => {}} activeFilter="all" onFilterChange={() => {}} filterLabel="Vista" options={[{ value: 'all', label: 'Todo' }, { value: 'recent', label: 'Recientes' }]} />);
    expect(html).toContain('value="Sala"');
    expect(html).toContain('Clear search');
    expect(html).toContain('aria-label="Vista"');
    expect(html).toContain('flex-nowrap overflow-x-auto');
    expect(html).toContain('min-h-11');
    expect(html).toContain('text-body-compact');
  });
  it.each([true, false])('Scenario: option card selection %s preserves radio semantics and readable context', checked => {
    const html = renderToStaticMarkup(<SelectableOptionCard title="Instalación local" description="Dentro del hogar" checked={checked} aria-describedby="help" />);
    expect(html).toContain('role="radio"');
    expect(html).toContain(`aria-checked="${checked}"`);
    expect(html).toContain('aria-describedby="help"');
    expect(html).toContain('min-h-12');
    expect(html).toContain('rounded-card');
    expect(html).toContain('text-body-compact font-normal');
    expect(html.includes('focusable="false"')).toBe(checked);
  });
  it('Scenario: unavailable title-only option retains native consumer props', () => {
    const html = renderToStaticMarkup(<SelectableOptionCard title="No disponible" checked={false} disabled name="installation" value="offline" />);
    expect(html).toContain('disabled=""');
    expect(html).toContain('name="installation"');
    expect(html).toContain('value="offline"');
    expect(html).not.toContain('text-body-compact');
  });
  it.each(['unknown', 'disabled'])('Scenario: unavailable selection %s retains an enabled keyboard entry', value => {
    const html = renderToStaticMarkup(<SegmentedControl label="Vista" value={value} options={[{ value: 'disabled', label: 'No disponible', disabled: true }, { value: 'all', label: 'Todo' }]} onChange={() => {}} />);
    expect(html).toContain('role="radiogroup"');
    expect(html).toContain('min-h-11');
    expect(html.match(/tabindex="0"/g)).toHaveLength(1);
    expect(html).toMatch(/tabindex="0"[^>]*>.*Todo/s);
  });
  it.each([Input, Textarea])('Scenario: shared fields link label and error without dropping external help', Field => {
    const html = renderToStaticMarkup(<Field id="field" label="Nombre" error="Revisa el valor" aria-describedby="external-help" defaultValue="Sala" />);
    expect(html).toContain('for="field"');
    expect(html).toContain('aria-describedby="external-help field-message"');
    expect(html).toContain('aria-invalid="true"');
    expect(html).toContain('role="alert"');
    expect(html).toContain('hp-text-field');
    expect(html).toContain('hp-field-label');
    expect(html).toContain('hp-field-message');
  });

  it.each([Input, Textarea])('Scenario: native disabled and readonly fields remain available', Field => {
    const html = renderToStaticMarkup(<Field label="Nombre" readOnly disabled defaultValue="Sala" helperText="Ayuda" />);
    expect(html).toContain('readOnly=""');
    expect(html).toContain('disabled=""');
    expect(html).not.toContain('aria-invalid="true"');
  });

  it('Scenario: search reserves room for the shared 44px trailing action', () => {
    const html = renderToStaticMarkup(<SearchInput label="Buscar" endAdornment={<IconButton icon={Plus} label="Acción" />} />);
    expect(html).toContain('pl-10');
    expect(html).toContain('pr-14');
    expect(html).toContain('absolute right-0');
  });
  it.each(['sm', 'md', 'lg'] as const)('Scenario: icon size alias %s uses the same action primitive', size => {
    const html = renderToStaticMarkup(<IconButton icon={Plus} label="Agregar" size={size} />);
    expect(html).toContain('homepilot-button');
    expect(html).toContain('!w-11');
    expect(html).toContain('!rounded-control');
    expect(html).toContain('aria-label="Agregar"');
  });

  it('Scenario: pending icon actions expose disabled and busy while retaining the name', () => {
    const html = renderToStaticMarkup(<IconButton icon={Plus} label="Agregar" isLoading />);
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain('disabled=""');
    expect(html).toContain('aria-label="Agregar"');
  });

  it.each([
    ['default', '--button-secondary'],
    ['ghost', '!bg-transparent'],
    ['primary', '--button-primary'],
    ['danger', '--button-danger'],
  ] as const)('Scenario: icon intention %s reuses the shared palette', (variant, token) => {
    const html = renderToStaticMarkup(<IconButton icon={Plus} label="Agregar" variant={variant} />);
    expect(html).toContain(token);
    expect(html).toContain('!w-11');
    expect(html).toContain('!rounded-control');
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain('focusable="false"');
  });

  it('Scenario: native button semantics and consumer attributes are retained', () => {
    const html = renderToStaticMarkup(<IconButton icon={Plus} label="Opciones" title="Opciones del panel" aria-expanded={false} aria-controls="panel-options" disabled />);
    expect(html).toContain('type="button"');
    expect(html).toContain('title="Opciones del panel"');
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain('aria-controls="panel-options"');
    expect(html).toContain('disabled=""');
  });

  it('Scenario: cards retain layout and radio semantics without action-button geometry', () => {
    const html = renderToStaticMarkup(<SurfaceButton role="radio" aria-checked={false} className="h-full w-full">Sala</SurfaceButton>);
    expect(html).toContain('role="radio"');
    expect(html).toContain('aria-checked="false"');
    expect(html).toContain('h-full');
    expect(html).not.toContain('!min-h-11');
    expect(html).not.toContain('[&amp;&gt;svg]');
  });

  it('Scenario: pending card actions expose disabled and busy attributes', () => {
    const html = renderToStaticMarkup(<SurfaceButton isLoading>Ejecutar</SurfaceButton>);
    expect(html).toContain('disabled=""');
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain('Ejecutar');
  });
});
