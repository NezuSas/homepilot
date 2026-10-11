export const MAX_AVATAR_PX = 256;
/** Logical size in UI of the circular crop area. */
export const AVATAR_DISPLAY_PX = 256;
export const AVATAR_JPEG_QUALITY = 0.85;

export interface CropOffset {
  x: number;
  y: number;
}

export interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

type PointerSource =
  | { clientX: number; clientY: number }
  | { touches: ArrayLike<{ clientX: number; clientY: number }> };

export function getPointerPosition(event: PointerSource): CropOffset {
  const point = 'touches' in event ? event.touches[0] : event;
  return { x: point.clientX, y: point.clientY };
}

export function isLandscape(width: number, height: number): boolean {
  return width / height > 1;
}

/** Where to draw the source image on the avatar canvas, given zoom and drag offset. */
export function computeAvatarDrawRect(
  imageWidth: number,
  imageHeight: number,
  zoom: number,
  offset: CropOffset,
): CropRect {
  const scale = isLandscape(imageWidth, imageHeight)
    ? AVATAR_DISPLAY_PX / imageHeight
    : AVATAR_DISPLAY_PX / imageWidth;

  const finalScale = scale * zoom;
  const width = imageWidth * finalScale;
  const height = imageHeight * finalScale;

  const ratio = MAX_AVATAR_PX / AVATAR_DISPLAY_PX;
  return {
    x: (MAX_AVATAR_PX - width) / 2 + offset.x * ratio,
    y: (MAX_AVATAR_PX - height) / 2 + offset.y * ratio,
    width,
    height,
  };
}
