import { renderToStaticMarkup } from 'react-dom/server';
import type { SnapshotDevice } from '../../../stores/useDeviceSnapshotStore';
import { MediaPlayerCard } from './MediaPlayerCard';
import { cardKinds, normalizeCards, normalizeMediaVariant } from './sectionCardCatalog';

jest.mock('../../../config', () => ({ API_BASE_URL: '' }));
jest.mock('../../../lib/apiClient', () => ({ apiFetch: jest.fn() }));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key === 'dashboard.editor.sections.media_idle' ? 'Sin reproducción' : key,
  }),
}));

describe('Media Player presentations', () => {
  it.each(['idle', 'playing'])('classic reserves progress space in %s without inventing idle progress', state => {
    const device: SnapshotDevice = { id: 'p', homeId: 'h', roomId: null, name: 'Player', type: 'media_player', status: 'ASSIGNED',
      lastKnownState: { state, attributes: { media_duration: 120, media_position: 20, media_title: 'Track' } } };
    const markup = renderToStaticMarkup(<MediaPlayerCard title="Player" mediaVariant="classic" device={device} />);
    expect(markup).toContain('data-media-progress-slot');
    expect(markup).toContain('min-height:2.5em');
    if (state === 'idle') expect(markup).not.toContain('role="progressbar"');
    else expect(markup).toContain('role="progressbar"');
  });
  it('keeps one Media Player catalog type for both designs', () => {
    expect(cardKinds.filter((kind) => kind === 'media')).toHaveLength(1);
  });

  it('renders an old persisted media card without a visual variant field', () => {
    const [card] = normalizeCards({ cards: [{ id: 'legacy-media', kind: 'media', title: 'Z.TECH SPEAKER', span: 'full' }] });
    expect(card).not.toHaveProperty('variant');
    expect(card).not.toHaveProperty('design');
    expect(card).not.toHaveProperty('mediaVariant');
    expect(normalizeMediaVariant(card.mediaVariant)).toBe('premium');
    const markup = renderToStaticMarkup(<MediaPlayerCard title={card.title} mediaVariant={card.mediaVariant} />);
    expect(markup).toContain('data-media-player="homepilot-premium"');
    expect(markup).toContain('Z.TECH SPEAKER');
    expect(markup).toContain('Sin reproducción');
    expect(markup).toContain('data-media-artwork-placeholder');
    expect(markup).not.toContain('<img');
  });

  it('preserves a classic selection through card normalization without changing its binding', () => {
    const [card] = normalizeCards({ cards: [{ id: 'classic-media', kind: 'media', title: 'Sala', entityId: 'speaker-1', mediaVariant: 'classic' }] });
    expect(card).toMatchObject({ kind: 'media', entityId: 'speaker-1', mediaVariant: 'classic' });
    expect(renderToStaticMarkup(<MediaPlayerCard title={card.title} mediaVariant={card.mediaVariant} />))
      .toContain('data-media-player="homepilot-classic"');
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

  it('uses the same binding, metadata and playback controls in both designs without decorative menus', () => {
    const device: SnapshotDevice = {
      id: 'speaker-1', homeId: 'home-1', roomId: null, name: 'Speaker', type: 'media_player',
      status: 'ASSIGNED', updatedAt: '2026-09-28T12:00:00.000Z',
      capabilities: [{ type: 'command', name: 'playback', commands: [
        { name: 'media_play' }, { name: 'media_pause' }, { name: 'media_previous_track' },
        { name: 'media_next_track' }, { name: 'volume_set' },
      ] }],
      lastKnownState: { state: 'playing', attributes: { media_title: 'Track', media_artist: 'Artist', volume_level: 0.4 } },
    };
    for (const mediaVariant of ['premium', 'classic'] as const) {
      const markup = renderToStaticMarkup(<MediaPlayerCard device={device} title="Speaker" mediaVariant={mediaVariant} />);
      expect(markup).toContain('Track');
      expect(markup).toContain('Artist');
      for (const control of ['media_pause', 'media_previous', 'media_next', 'media_volume_down', 'media_volume_up']) {
        expect(markup).toContain(control);
      }
      expect(markup).not.toContain('lucide-ellipsis');
      expect(markup).not.toContain('aria-haspopup="menu"');
    }
  });
});
