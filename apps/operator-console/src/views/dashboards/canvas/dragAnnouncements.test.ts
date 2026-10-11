import type { Active, Over } from '@dnd-kit/core';
import type { DashboardWidget } from '../types';
import { buildDragAnnouncements, describeDragItem, describeDropTarget } from './dragAnnouncements';

const dictionary: Record<string, string> = {
  'dashboard.editor.sections.untitled_section': 'Sección sin título',
  'common.reorder_card': 'Tarjeta',
  'common.reorder_slot': 'posición {{position}}',
  'common.reorder_card_in': '{{card}} en {{section}}',
  'common.reorder_picked_up': '{{name}} levantado',
  'common.reorder_over': '{{name}} sobre {{target}}',
  'common.reorder_dropped': '{{name}} soltado en {{target}}',
  'common.reorder_cancelled': 'Cancelado {{name}}',
};
const t = (key: string, options: Record<string, unknown> = {}) =>
  (dictionary[key] ?? key).replace(/\{\{(\w+)\}\}/g, (_, name: string) => String(options[name]));

const section = (id: string, title: string | undefined, cards: Array<{ id: string; title?: string }> = []) => ({
  id,
  type: 'section',
  config: { appearance: title === undefined ? {} : { title }, extra: { cards } },
}) as unknown as DashboardWidget;

const widgets = [
  section('sala', 'Sala', [{ id: 'c1', title: 'Lámpara' }, { id: 'c2' }]),
  section('comedor', 'Comedor'),
  section('anonima', undefined),
];

const active = (id: string, data: Record<string, unknown>) => ({ id, data: { current: data } }) as unknown as Active;
const over = (id: string, data: Record<string, unknown> = {}) => ({ id, data: { current: data } }) as unknown as Over;

describe('dashboard drag announcements', () => {
  it('names a section by its title and a card by its own title', () => {
    expect(describeDragItem(widgets, active('sala', { kind: 'section', sectionId: 'sala' }), t)).toBe('Sala');
    expect(describeDragItem(widgets, active('x', { kind: 'section-card', sectionId: 'sala', cardId: 'c1' }), t)).toBe('Lámpara');
  });

  it('falls back to a readable word instead of an id', () => {
    expect(describeDragItem(widgets, active('anonima', { kind: 'section', sectionId: 'anonima' }), t)).toBe('Sección sin título');
    expect(describeDragItem(widgets, active('x', { kind: 'section-card', sectionId: 'sala', cardId: 'c2' }), t)).toBe('Tarjeta');
  });

  it('describes the target as a numbered slot, a card in its section, or a section', () => {
    expect(describeDropTarget(widgets, over('section-slot-2'), t)).toBe('posición 3');
    expect(describeDropTarget(widgets, over('k', { kind: 'section-card', sectionId: 'sala', cardId: 'c1' }), t)).toBe('Lámpara en Sala');
    expect(describeDropTarget(widgets, over('comedor', { kind: 'section', sectionId: 'comedor' }), t)).toBe('Comedor');
  });

  it('announces pick up, hover, drop and cancel without exposing internal ids', () => {
    const announcements = buildDragAnnouncements(widgets, t);
    const sala = active('sala', { kind: 'section', sectionId: 'sala' });
    const slot = over('section-slot-1');

    expect(announcements.onDragStart({ active: sala })).toBe('Sala levantado');
    expect(announcements.onDragOver({ active: sala, over: slot })).toBe('Sala sobre posición 2');
    expect(announcements.onDragOver({ active: sala, over: null })).toBeUndefined();
    expect(announcements.onDragEnd({ active: sala, over: slot })).toBe('Sala soltado en posición 2');
    expect(announcements.onDragEnd({ active: sala, over: null })).toBe('Cancelado Sala');
    expect(announcements.onDragCancel({ active: sala })).toBe('Cancelado Sala');
    expect(announcements.onDragOver({ active: sala, over: slot })).not.toContain('section-slot');
  });
});
