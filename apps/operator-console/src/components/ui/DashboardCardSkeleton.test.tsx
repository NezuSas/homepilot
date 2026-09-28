import { renderToStaticMarkup } from 'react-dom/server';
import { DashboardCardSkeleton } from './DashboardCardSkeleton';
import { DASHBOARD_SKELETON_DELAY_MS, needsInitialDashboardSkeleton } from './useDashboardDelayedSkeleton';

describe('Dashboard card initial loading', () => {
  it('waits for a real initial load and never replaces known content during refresh', () => {
    expect(DASHBOARD_SKELETON_DELAY_MS).toBeGreaterThanOrEqual(180);
    expect(DASHBOARD_SKELETON_DELAY_MS).toBeLessThanOrEqual(200);
    expect(needsInitialDashboardSkeleton(true, false)).toBe(true);
    expect(needsInitialDashboardSkeleton(true, true)).toBe(false);
    expect(needsInitialDashboardSkeleton(false, false)).toBe(false); // error, offline or completed empty state
  });

  it.each(['sensor', 'control', 'media', 'camera', 'energy', 'climate', 'display'] as const)(
    'keeps the %s placeholder inside the existing card geometry without interactive controls', (variant) => {
      const html = renderToStaticMarkup(<DashboardCardSkeleton variant={variant} />);
      expect(html).toContain(`data-dashboard-skeleton="${variant}"`);
      expect(html).toContain('h-full');
      expect(html).toContain('w-full');
      expect(html).toContain('pointer-events-none');
      expect(html).toContain('aria-hidden="true"');
      expect(html).toContain('homepilot-dashboard-skeleton-motion');
      expect(html).not.toContain('<button');
      expect(html).not.toContain('tabindex');
    },
  );

  it('reserves the camera frame at the same 4:3 aspect ratio without duplicate metadata', () => {
    const frame = renderToStaticMarkup(<DashboardCardSkeleton variant="camera" mediaOnly />);
    expect(frame).toContain('aspect-[4/3]');
    expect(frame).toContain('min-h-curtain-card');
    expect(frame).not.toContain('bottom-0 space-y-2');
  });

  it('keeps a stable card surface during the short pre-skeleton delay', () => {
    const surface = renderToStaticMarkup(<DashboardCardSkeleton variant="sensor" visible={false} />);
    expect(surface).toContain('homepilot-dashboard-card-skeleton');
    expect(surface).toContain('bg-card/95');
    expect(surface).not.toContain('data-dashboard-skeleton=');
    expect(surface).not.toContain('homepilot-dashboard-skeleton-motion');
    expect(surface).not.toContain('h-12 w-2/5');
  });

  it('keeps the approved value-first sensor layout', () => {
    const sensor = renderToStaticMarkup(<DashboardCardSkeleton variant="sensor" />);
    expect(sensor).toContain('h-12 w-2/5');
    expect(sensor).toContain('h-5 w-3/4');
  });
});
