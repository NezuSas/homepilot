import { renderToStaticMarkup } from 'react-dom/server';
import { SectionActionCard } from './SectionActionCard';
import { getLightTileIconClasses, getLightTileSurfaceClasses, SECTION_COMPACT_TILE_CLASSES } from './SectionDeviceCard';

jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('../components/IconPicker', () => ({ getDashboardIconComponent: () => 'svg' }));

describe('premium dashboard action tiles', () => {
  it('uses a neutral compact surface until an actual active state is supplied', () => {
    expect(getLightTileSurfaceClasses(false)).toContain('homepilot-section-tile-inactive');
    expect(getLightTileIconClasses(false)).toContain('text-foreground/80');
    expect(SECTION_COMPACT_TILE_CLASSES).toContain('focus-visible:ring-2');
    expect(SECTION_COMPACT_TILE_CLASSES).toContain('h-full');
  });

  it('highlights active actions without changing their compact geometry', () => {
    expect(getLightTileSurfaceClasses(true)).toContain('homepilot-section-light-tile-surface');
    expect(getLightTileIconClasses(true)).toContain('text-primary');
    const markup = renderToStaticMarkup(<SectionActionCard kind="action" title="Indirecta espalda muy larga" isAssigned isActive onAction={() => {}} />);
    expect(markup).toContain('line-clamp-2');
    expect(markup).toContain('data-action-state="idle"');
    expect(markup).toContain('focus-visible:ring-primary/70');
  });

  it('marks an unassigned action as unavailable without presenting it as active', () => {
    const markup = renderToStaticMarkup(<SectionActionCard kind="action" title="Reiniciar" />);
    expect(markup).toContain('disabled');
    expect(markup).toContain('disabled:opacity-60');
    expect(markup).not.toContain('homepilot-section-light-tile-active');
  });
});
