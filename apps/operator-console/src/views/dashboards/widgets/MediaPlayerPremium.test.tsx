import { renderToStaticMarkup } from 'react-dom/server';
import type { SnapshotDevice } from '../../../stores/useDeviceSnapshotStore';
import { MediaPlayerCard } from './MediaPlayerCard';
import { normalizeCards } from './sectionCardCatalog';

jest.mock('../../../config', () => ({ API_BASE_URL: '' }));
jest.mock('../../../lib/apiClient', () => ({ apiFetch: jest.fn() }));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key === 'dashboard.editor.sections.media_idle' ? 'Sin reproducción' : key,
  }),
}));

describe('single premium Media Player presentation', () => {
  it('renders an old persisted media card without a visual variant field', () => {
    const [card] = normalizeCards({ cards: [{ id: 'legacy-media', kind: 'media', title: 'Z.TECH SPEAKER', span: 'full' }] });
    expect(card).not.toHaveProperty('variant');
    expect(card).not.toHaveProperty('design');
    const markup = renderToStaticMarkup(<MediaPlayerCard title={card.title} />);
    expect(markup).toContain('data-media-player="homepilot-premium"');
    expect(markup).toContain('Z.TECH SPEAKER');
    expect(markup).toContain('Sin reproducción');
    expect(markup).toContain('data-media-artwork-placeholder');
    expect(markup).not.toContain('<img');
  });

  it('keeps the same play, power and volume controls in the premium layout', () => {
    const markup = renderToStaticMarkup(<MediaPlayerCard title="Speaker" isPreview />);
    expect(markup).toContain('media_play');
    expect(markup).toContain('media_turn_off');
    expect(markup).not.toContain('legacy_adb');
  });

  it('removes the idle copy when a real playback session supplies metadata', () => {
    const device: SnapshotDevice = {
      id: 'speaker-1', homeId: 'home-1', roomId: null, name: 'Speaker', type: 'media_player',
      status: 'ASSIGNED', updatedAt: '2026-09-28T12:00:00.000Z',
      lastKnownState: { state: 'playing', attributes: { media_title: 'Track', media_artist: 'Artist' } },
    };
    const markup = renderToStaticMarkup(<MediaPlayerCard device={device} title="Speaker" />);
    expect(markup).toContain('Track');
    expect(markup).toContain('Artist');
    expect(markup).not.toContain('Sin reproducción');
  });
});
