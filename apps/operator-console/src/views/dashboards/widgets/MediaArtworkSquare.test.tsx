import { renderToStaticMarkup } from 'react-dom/server';
import { MediaArtworkSquare } from './MediaArtworkSquare';

describe('premium media artwork', () => {
  it('shows the existing artwork as an uncropped square container with cover fitting', () => {
    const markup = renderToStaticMarkup(<MediaArtworkSquare artworkUrl="/api/v1/devices/speaker/media/artwork" />);
    expect(markup).toContain('aspect-square');
    expect(markup).toContain('object-cover');
    expect(markup).toContain('/api/v1/devices/speaker/media/artwork');
    expect(markup).not.toContain('data-media-artwork-placeholder');
  });

  it('shows a neutral placeholder without fabricated artwork when no session image exists', () => {
    const markup = renderToStaticMarkup(<MediaArtworkSquare artworkUrl={null} />);
    expect(markup).toContain('data-media-artwork-placeholder');
    expect(markup).not.toContain('<img');
  });
});
