import { computeAvatarDrawRect, getPointerPosition, isLandscape } from './avatarCrop';

describe('avatarCrop', () => {
  it('reads mouse and touch pointer positions', () => {
    expect(getPointerPosition({ clientX: 3, clientY: 4 })).toEqual({ x: 3, y: 4 });
    expect(getPointerPosition({ touches: [{ clientX: 7, clientY: 9 }] })).toEqual({ x: 7, y: 9 });
  });

  it('detects landscape images', () => {
    expect(isLandscape(200, 100)).toBe(true);
    expect(isLandscape(100, 100)).toBe(false);
    expect(isLandscape(100, 200)).toBe(false);
  });

  it('covers the canvas height for landscape images and centres them', () => {
    const rect = computeAvatarDrawRect(512, 256, 1, { x: 0, y: 0 });
    expect(rect).toEqual({ x: -128, y: 0, width: 512, height: 256 });
  });

  it('covers the canvas width for portrait images', () => {
    const rect = computeAvatarDrawRect(128, 256, 1, { x: 0, y: 0 });
    expect(rect).toEqual({ x: 0, y: -128, width: 256, height: 512 });
  });

  it('applies zoom around the centre and adds the drag offset', () => {
    const rect = computeAvatarDrawRect(256, 256, 2, { x: 10, y: -5 });
    expect(rect).toEqual({ x: -128 + 10, y: -128 - 5, width: 512, height: 512 });
  });
});
