import { BG_QUALITY, MAX_BG_PX, fitWithin } from './viewConfigModel';

/** Reads an image file, downsizes it to MAX_BG_PX and reports a JPEG data URI. */
export function compressBackgroundImage(file: File, onReady: (dataUri: string) => void): void {
  const reader = new FileReader();
  reader.onload = (event) => {
    const img = new window.Image();
    img.onload = () => {
      const { width, height } = fitWithin(img.width, img.height, MAX_BG_PX);

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, width, height);
      onReady(canvas.toDataURL('image/jpeg', BG_QUALITY));
    };
    img.src = event.target?.result as string;
  };
  reader.readAsDataURL(file);
}
