import { renderToStaticMarkup } from 'react-dom/server';
import { DatabaseBackupsCard } from './DatabaseBackupsCard';

const noop = () => undefined;
const labels = {
  title: 'Copias', description: 'Copias de la base de datos', refresh: 'Actualizar', available: 'Disponibles', latest: 'Última',
  never: 'Nunca', loadFailed: 'No se pudo cargar', empty: 'Sin copias', create: 'Crear copia', creating: 'Creando…', note: 'Nota',
};
const base = { backups: [], isLoading: false, isCreating: false, hasError: false, onCreate: noop, onRefresh: noop, labels, locale: 'es' };
const backup = { filename: 'homepilot-2026-10-10.db', sizeBytes: 2048, createdAt: '2026-10-10T12:00:00.000Z' };

describe('Feature: DatabaseBackupsCard summary (modular contract C1-C4)', () => {
  it('shows the empty state when there are no backups', () => {
    const html = renderToStaticMarkup(<DatabaseBackupsCard {...base} />);
    expect(html).toContain('Sin copias');
    expect(html).toContain('Nunca');
  });

  it('shows the latest backup with a human readable size', () => {
    const html = renderToStaticMarkup(<DatabaseBackupsCard {...base} backups={[backup]} />);
    expect(html).toContain('homepilot-2026-10-10.db');
    expect(html).toContain('2.0 KB');
    expect(html).not.toContain('Sin copias');
  });

  it('reports a load failure instead of the list', () => {
    const html = renderToStaticMarkup(<DatabaseBackupsCard {...base} hasError backups={[backup]} />);
    expect(html).toContain('No se pudo cargar');
    expect(html).not.toContain('homepilot-2026-10-10.db');
  });

  it('disables actions while creating and switches the create label', () => {
    const html = renderToStaticMarkup(<DatabaseBackupsCard {...base} isCreating />);
    expect(html).toContain('Creando…');
    expect(html).toContain('disabled');
  });

  it('merges a consumer className and forwards attributes', () => {
    const html = renderToStaticMarkup(<DatabaseBackupsCard {...base} className="extra" data-card="backups" />);
    expect(html).toContain('extra');
    expect(html).toContain('data-card="backups"');
  });
});
