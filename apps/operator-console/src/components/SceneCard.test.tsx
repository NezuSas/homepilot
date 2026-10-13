import { renderToStaticMarkup } from 'react-dom/server';
import { SceneCard } from './SceneCard';

jest.mock('react-i18next', () => ({ useTranslation: () => ({
  t: (key: string, options?: { count: number }) => ({
    'scenes.execute': 'Ejecutar',
    'scenes.executed': 'Ejecutada',
    'scenes.action_count': options?.count === 1 ? '1 acción' : `${options?.count} acciones`,
    'scenes.add_favorite': 'Añadir a favoritas',
    'scenes.remove_favorite': 'Quitar de favoritas',
    'common.edit': 'Editar',
    'common.delete': 'Eliminar',
  } as Record<string, string>)[key] ?? key,
}) }));
jest.mock('../views/dashboards/components/IconPicker', () => ({ getDashboardIconComponent: () => null }));

const props = {
  scene: { id: 'scene', name: 'Trabajo', actions: [{ deviceId: 'light', command: 'turn_on' as const }] },
  roomName: null,
  isFavorite: false,
  isExecuting: false,
  isSuccessful: false,
  onExecute: jest.fn(),
  onToggleFavorite: jest.fn(),
  onEdit: jest.fn(),
  onDelete: jest.fn(),
};

describe('Feature: Scene icon from its name (AC60)', () => {
  it.each([['Buenos días', 'lucide-sun'], ['Reunión', 'lucide-monitor'], ['Noche de cine', 'lucide-moon'], ['Escena rara', 'lucide-zap']])('gives %s the %s icon in Spanish without accents mattering', (name, icon) => {
    expect(renderToStaticMarkup(<SceneCard {...props} scene={{ ...props.scene, name }} />)).toContain(icon);
  });
});

describe('Feature: Scene summary (AC60)', () => {
  it('says which devices the scene controls when it has no description, and prefers the description when it has one', () => {
    const summary = renderToStaticMarkup(<SceneCard {...props} summary="Luz sala y Persiana patio" />);
    const described = renderToStaticMarkup(<SceneCard {...props} scene={{ ...props.scene, description: 'Abre todo' }} summary="Luz sala y Persiana patio" />);
    expect(summary).toContain('Luz sala y Persiana patio');
    expect(described).toContain('Abre todo');
    expect(described).not.toContain('Luz sala y Persiana patio');
  });
});

describe('Feature: Compact scene cards (AC47)', () => {
  it('offers execution and favorites, but no management, to a shared recipient', () => {
    const html = renderToStaticMarkup(<SceneCard {...props} canManage={false} />);
    expect(html).toContain('Ejecutar');
    expect(html).toContain('aria-label="Añadir a favoritas"');
    expect(html).not.toContain('aria-label="Editar"');
    expect(html).not.toContain('aria-label="Eliminar"');
  });
  it('renders a named non-button article and four independent named controls', () => {
    const html = renderToStaticMarkup(<SceneCard {...props} />);
    expect(html).toMatch(/^<article [^>]*aria-labelledby=/);
    expect(html).toContain('Trabajo');
    expect(html).toContain('1 acción');
    expect(html.match(/<button /g)).toHaveLength(4);
    expect(html).toContain('Ejecutar');
    expect(html).toContain('aria-label="Añadir a favoritas"');
    expect(html).toContain('aria-label="Editar"');
    expect(html).toContain('aria-label="Eliminar"');
    expect(html).not.toContain('<img');
    expect(html).not.toContain('descriptions.generic');
    expect(props.onExecute).not.toHaveBeenCalled();
  });

  it('disables only execution while busy, leaving management controls available', () => {
    const html = renderToStaticMarkup(<SceneCard {...props} isExecuting />);
    expect(html).toContain('aria-busy="true"');
    expect(html.match(/disabled=""/g)).toHaveLength(1);
    expect(html).toContain('Ejecutar');
  });

  it('announces completion and preserves favorite state', () => {
    const html = renderToStaticMarkup(<SceneCard {...props} isSuccessful isFavorite />);
    expect(html).toContain('role="status" aria-live="polite">Ejecutada');
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain('aria-label="Quitar de favoritas"');
  });

  it('retains user descriptions and room context rather than generating filler', () => {
    const html = renderToStaticMarkup(<SceneCard {...props} roomName="Oficina" scene={{ ...props.scene, description: 'Preparar las luces para trabajar' }} />);
    expect(html).toContain('Oficina');
    expect(html).toContain('Preparar las luces para trabajar');
  });
});
