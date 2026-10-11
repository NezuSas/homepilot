import { useCallback, useEffect, useRef, useState } from 'react';
import type React from 'react';
import {
  AVATAR_JPEG_QUALITY,
  MAX_AVATAR_PX,
  computeAvatarDrawRect,
  getPointerPosition,
  type CropOffset,
} from './avatarCrop';

/** Zoom/drag cropping state for the avatar picker, plus the canvas export of the crop. */
export function useAvatarCropper(avatarPreview: string | null) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [rawImage, setRawImage] = useState<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState<CropOffset>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [lastPos, setLastPos] = useState<CropOffset>({ x: 0, y: 0 });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        setRawImage(img);
        setZoom(1);
        setOffset({ x: 0, y: 0 });
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleMouseDown = (e: React.MouseEvent | React.TouchEvent) => {
    if (!rawImage) return;
    setIsDragging(true);
    setLastPos(getPointerPosition(e));
  };

  const handleMouseMove = useCallback((e: MouseEvent | TouchEvent) => {
    if (!isDragging || !rawImage) return;
    const pos = getPointerPosition(e);

    const dx = pos.x - lastPos.x;
    const dy = pos.y - lastPos.y;

    setOffset(prev => ({ x: prev.x + dx, y: prev.y + dy }));
    setLastPos(pos);
  }, [isDragging, lastPos, rawImage]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      window.addEventListener('touchmove', handleMouseMove);
      window.addEventListener('touchend', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchmove', handleMouseMove);
      window.removeEventListener('touchend', handleMouseUp);
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);

  const getCroppedDataUri = (): string | null => {
    if (!rawImage || !containerRef.current) return avatarPreview;

    const canvas = document.createElement('canvas');
    canvas.width = MAX_AVATAR_PX;
    canvas.height = MAX_AVATAR_PX;
    const ctx = canvas.getContext('2d')!;

    const rect = computeAvatarDrawRect(rawImage.width, rawImage.height, zoom, offset);

    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, MAX_AVATAR_PX, MAX_AVATAR_PX);
    ctx.drawImage(rawImage, rect.x, rect.y, rect.width, rect.height);

    return canvas.toDataURL('image/jpeg', AVATAR_JPEG_QUALITY);
  };

  return {
    containerRef,
    rawImage,
    zoom,
    setZoom,
    offset,
    handleFileChange,
    handleMouseDown,
    getCroppedDataUri,
  };
}
