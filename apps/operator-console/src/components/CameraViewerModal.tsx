import React, { useEffect, useState } from 'react';
import { Camera, VideoOff, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '../lib/utils';
import { CameraMediaFrame, type CameraFeedMode } from './CameraMediaFrame';
import { CameraPtzControl } from './CameraPtzControl';
import { IconButton } from './ui/IconButton';
import { Modal } from './ui/Modal';
import { StatusPill } from './ui/StatusPill';

interface CameraViewerModalProps {
  isOpen: boolean;
  name: string;
  roomName?: string;
  streamUrl: string;
  hlsUrl?: string;
  snapshotUrl: string;
  preferredMode: CameraFeedMode;
  onClose: () => void;
  deviceId?: string;
  ptzSupported?: boolean;
}

export const CameraViewerModal: React.FC<CameraViewerModalProps> = ({
  isOpen,
  name,
  roomName,
  streamUrl,
  hlsUrl,
  snapshotUrl,
  preferredMode,
  onClose,
  deviceId,
  ptzSupported,
}) => {
  const { t } = useTranslation();
  const [hasLoaded, setHasLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [aspectRatio, setAspectRatio] = useState(16 / 9);

  useEffect(() => {
    if (!isOpen) {
      setHasLoaded(false);
      setHasError(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      closeLabel={t('camera.viewer_label', { name })}
      hideCloseButton
      layerClassName="z-[120] !items-center !overflow-hidden bg-background/95 p-0 backdrop-blur-xl"
      className="!h-auto !w-fit !max-h-none !max-w-none !rounded-modal !border-0"
      bodyClassName="!w-auto !overflow-hidden"
      contentClassName="!p-0"
    >
      <section
        className="relative overflow-hidden bg-black"
        style={{
          aspectRatio,
          width: `min(96vw, 1440px, calc((100dvh - 2rem) * ${aspectRatio}))`,
        }}
      >
        <div className="absolute inset-0 overflow-hidden">
          {!hasLoaded && !hasError && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black text-muted-foreground">
              <div className="grid h-12 w-12 place-items-center rounded-full border border-white/15 bg-white/5">
                <Camera className="h-6 w-6 animate-pulse text-white/70" />
              </div>
              <span className="text-body font-medium text-white/70">{t('camera.connecting')}</span>
            </div>
          )}
          {hasError ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center text-white/70">
              <div className="grid h-14 w-14 place-items-center rounded-full border border-danger/25 bg-danger/10 text-danger">
                <VideoOff className="h-7 w-7" />
              </div>
              <p className="text-body font-semibold">{t('camera.stream_error')}</p>
            </div>
          ) : (
            <CameraMediaFrame
              active={isOpen}
              hlsUrl={hlsUrl}
              streamUrl={streamUrl}
              snapshotUrl={snapshotUrl}
              preferredMode={preferredMode}
              alt={t('camera.feed_alt', { name })}
              className={cn('absolute inset-0 h-full w-full object-contain transition-opacity duration-base', hasLoaded ? 'opacity-100' : 'opacity-0')}
              onModeChange={() => {
                setHasLoaded(false);
                setHasError(false);
              }}
              onReady={({ width, height }) => {
                if (width > 0 && height > 0) setAspectRatio(width / height);
                setHasLoaded(true);
                setHasError(false);
              }}
              onFailure={() => setHasError(true)}
            />
          )}
        </div>
        <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/65 to-transparent" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-black/80 to-transparent" />
        {hasLoaded && !hasError && (
          <div className="absolute left-3 top-3 flex items-center gap-1.5 rounded-pill border border-white/20 bg-black/60 px-3 py-1.5 text-micro font-semibold uppercase tracking-wide text-white sm:left-5 sm:top-5">
            <StatusPill variant="danger" dot pulse dotLabel={t('camera.live')} />
            {t('camera.live')}
          </div>
        )}
        <IconButton icon={X} label={t('camera.close_viewer')} onClick={onClose} variant="ghost" size="lg" className="absolute right-3 top-3 rounded-pill border border-white/20 bg-black/60 text-white hover:bg-black/80 hover:text-white sm:right-5 sm:top-5" />
        <div className="absolute bottom-4 left-4 min-w-0 max-w-[calc(100%-5rem)] text-white sm:bottom-6 sm:left-6">
          <h2 className="line-clamp-2 text-section-title font-bold leading-tight drop-shadow">{name}</h2>
          {roomName && <p className="mt-1 truncate text-caption font-semibold text-white/80">{roomName}</p>}
        </div>
        {ptzSupported && deviceId && !hasError && (
          <div className="absolute bottom-3 right-3 rounded-modal border border-white/20 bg-black/70 p-1.5 text-white backdrop-blur sm:bottom-4 sm:right-4 sm:p-2">
            <CameraPtzControl deviceId={deviceId} />
          </div>
        )}
      </section>
    </Modal>
  );
};
