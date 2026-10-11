import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Camera, UserCircle2, ZoomIn, Move } from 'lucide-react';
import { API_BASE_URL } from '../../config';
import { IconButton } from '../ui/IconButton';
import { RangeInput } from '../ui/RangeInput';
import { isLandscape } from './avatarCrop';
import type { useAvatarCropper } from './useAvatarCropper';

interface AvatarCropperProps {
  cropper: ReturnType<typeof useAvatarCropper>;
  avatarPreview: string | null;
  username: string;
  onPreviewError: () => void;
}

export function AvatarCropper({ cropper, avatarPreview, username, onPreviewError }: AvatarCropperProps) {
  const { t } = useTranslation();
  const fileRef = useRef<HTMLInputElement>(null);
  const { containerRef, rawImage, zoom, setZoom, offset, handleFileChange, handleMouseDown } = cropper;

  return (
    <div className="flex flex-col items-center gap-4">
      <div
        className="relative w-56 h-56 touch-none"
      >
        {/* Visual Image Container (with overflow hidden) */}
        <div
          ref={containerRef}
          className="absolute inset-0 rounded-full bg-muted border-4 border-border shadow-inner overflow-hidden cursor-move"
          onMouseDown={handleMouseDown}
          onTouchStart={handleMouseDown}
        >
          {!rawImage && !avatarPreview && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground/30 bg-primary/5">
              <span className="font-black text-hero-title uppercase tracking-tighter opacity-20">
                {(username || '?').substring(0, 2)}
              </span>
              <UserCircle2 className="w-12 h-12 absolute opacity-10" />
            </div>
          )}

          {rawImage ? (
            <div
              className="absolute inset-0 flex items-center justify-center"
              style={{ pointerEvents: 'none' }}
            >
              <img
                src={rawImage.src}
                alt={t('users.profile.crop_target_alt')}
                draggable={false}
                className="max-w-none transition-transform duration-75 ease-out"
                style={{
                  transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
                  height: isLandscape(rawImage.width, rawImage.height) ? '100%' : 'auto',
                  width: isLandscape(rawImage.width, rawImage.height) ? 'auto' : '100%'
                }}
              />
            </div>
          ) : avatarPreview ? (
            <img
              src={avatarPreview.startsWith('/') ? `${API_BASE_URL}${avatarPreview}` : avatarPreview}
              alt={t('users.profile.avatar_alt')}
              className="w-full h-full object-cover"
              onError={(event) => {
                // If image fails to load, clear preview to show fallback
                event.currentTarget.style.display = 'none';
                onPreviewError();
              }}
            />
          ) : null}

          {/* Circular overlay border (Internal) */}
          <div className="absolute inset-0 pointer-events-none border-[12px] border-background/20 rounded-full box-border" />
        </div>

        {/* Camera Button (Clearly outside the clipping radius of the square corners) */}
        <IconButton
          icon={Camera}
          label={t('users.profile.change_avatar')}
          onClick={() => fileRef.current?.click()}
          variant="primary"
          size="lg"
          className="absolute bottom-1 right-1 z-30 border-4 border-card"
        />
      </div>

      {rawImage && (
        <div className="w-full flex flex-col gap-2">
          <div className="flex items-center justify-between text-micro font-black uppercase tracking-widest text-muted-foreground px-1">
            <div className="flex items-center gap-2"><ZoomIn className="w-3 h-3" /> {t('users.profile.zoom')}</div>
            <div className="flex items-center gap-2"><Move className="w-3 h-3" /> {t('users.profile.adjust')}</div>
          </div>
          <RangeInput
            aria-label={t('users.profile.zoom')}
            min={1}
            max={3}
            step={0.01}
            value={zoom}
            onValueChange={setZoom}
          />
        </div>
      )}

      <p className="text-label text-muted-foreground text-center max-w-copy-lg">
        {rawImage ? t('users.profile.crop_hint') : t('users.profile.avatar_hint')}
      </p>
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
    </div>
  );
}
