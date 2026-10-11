import { renderToStaticMarkup } from 'react-dom/server';
import { RoomScene } from './RoomScene';

describe('Feature: Decorative room scene (REQ-05, REQ-06, REQ-07, AC5)', () => {
  it('is decorative: hidden from assistive technology, without role, focus or text', () => {
    const html = renderToStaticMarkup(<RoomScene lightsOn curtainOpen={20} />);
    expect(html).toContain('aria-hidden="true"');
    expect(html).not.toMatch(/role=|tabindex|<text|<button|<a /i);
    expect(html.replace(/<[^>]*>/g, '').trim()).toBe('');
  });

  it('lights the lamp only when lights are on', () => {
    expect(renderToStaticMarkup(<RoomScene lightsOn curtainOpen={null} />)).toContain('data-room-lamp-glow');
    const off = renderToStaticMarkup(<RoomScene lightsOn={false} curtainOpen={null} />);
    expect(off).not.toContain('data-room-lamp-glow');
    expect(off).toContain('data-lights-on="false"');
  });

  it('draws curtains from a known position and none when it is unknown', () => {
    expect(renderToStaticMarkup(<RoomScene lightsOn={false} curtainOpen={0} />)).toContain('data-room-curtains');
    expect(renderToStaticMarkup(<RoomScene lightsOn={false} curtainOpen={100} />)).toContain('data-room-curtains');
    const unknown = renderToStaticMarkup(<RoomScene lightsOn={false} curtainOpen={null} />);
    expect(unknown).not.toContain('data-room-curtains');
    expect(unknown).toContain('data-curtain-open="unknown"');
  });
});
