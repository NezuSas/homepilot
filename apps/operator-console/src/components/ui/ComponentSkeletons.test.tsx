import { renderToStaticMarkup } from 'react-dom/server';
import { ScenesSkeleton, AutomationsSkeleton, SpacesSkeleton, HomeSkeleton, DeviceManagerSkeleton, CamerasSkeleton, DisplayControlsSkeleton, DeviceInspectorSkeleton, DiscoverySkeleton, HaDiscoverySkeleton, UsersSkeleton, DiagnosticsSkeleton, ViewSkeleton } from './ComponentSkeletons';
describe('Feature: Component-owned skeletons (AC51)', () => {
  it.each([ScenesSkeleton, AutomationsSkeleton, SpacesSkeleton, HomeSkeleton, DeviceManagerSkeleton, CamerasSkeleton, DisplayControlsSkeleton, DeviceInspectorSkeleton, DiscoverySkeleton, HaDiscoverySkeleton, UsersSkeleton, DiagnosticsSkeleton])('announces loading once without interactive controls: %p', Skeleton => {
    const html = renderToStaticMarkup(<Skeleton label="Cargando" />);
    expect(html.match(/role="status"/g)).toHaveLength(1);
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain('aria-hidden="true"');
    expect(html).not.toMatch(/<(button|input|video)\b/);
  });
  it('uses different component compositions instead of the same generic card everywhere', () => {
    const markup = [ScenesSkeleton, AutomationsSkeleton, SpacesSkeleton, HomeSkeleton, DeviceManagerSkeleton, CamerasSkeleton, DisplayControlsSkeleton].map(Skeleton => renderToStaticMarkup(<Skeleton label="Cargando" />));
    expect(new Set(markup).size).toBe(markup.length);
  });
  it('keeps the lazy route fallback identical to the loaded view initial skeleton', () => {
    expect(renderToStaticMarkup(<ViewSkeleton view="spaces" label="Cargando" />)).toBe(renderToStaticMarkup(<SpacesSkeleton label="Cargando" />));
    expect(renderToStaticMarkup(<ViewSkeleton view="routines" section="automations" label="Cargando" />)).toBe(renderToStaticMarkup(<AutomationsSkeleton label="Cargando" />));
  });
});
