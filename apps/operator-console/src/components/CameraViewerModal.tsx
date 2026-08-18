import React, { useEffect, useState } from 'react';
import { Camera, Maximize2, VideoOff, X } from 'lucide-react';
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
      className="!h-[100dvh] !w-full !max-w-none rounded-none border-border/70 sm:!h-[calc(100dvh-2rem)] sm:!max-w-[min(96vw,1440px)] sm:rounded-modal"
      bodyClassName="!flex !flex-1 !overflow-hidden"
      contentClassName="flex min-h-0 flex-1 flex-col overflow-hidden p-0"
      footer={(
        <div className="flex w-full shrink-0 items-center justify-center gap-2 px-4 py-2.5 text-caption text-muted-foreground sm:justify-start sm:px-6 sm:py-3">
          <Maximize2 className="h-3.5 w-3.5 shrink-0" />
          <span className="hidden sm:inline">{t('camera.fullscreen_hint')}</span>
          <span className="sm:hidden">{t('camera.close_viewer')}</span>
        </div>
      )}
    >
      <section className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-border/60 px-4 py-3 sm:gap-4 sm:px-6 sm:py-4">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="min-w-0">
              <h2 className="truncate text-section-title font-semibold tracking-tight text-foreground">{name}</h2>
              {roomName && <p className="truncate text-caption text-muted-foreground">{roomName}</p>}
            </div>
            {hasLoaded && !hasError && (
              <div className="hidden shrink-0 items-center gap-1.5 rounded-pill border border-border/60 bg-muted/60 px-2.5 py-1 text-micro font-semibold uppercase tracking-wide text-foreground sm:flex">
                <StatusPill variant="danger" dot pulse dotLabel={t('camera.live')} />
                {t('camera.live')}
              </div>
            )}
          </div>
          <IconButton icon={X} label={t('camera.close_viewer')} onClick={onClose} variant="ghost" size="lg" className="shrink-0 rounded-pill border border-border/60 bg-muted/60" />
        </header>

        <div className="relative flex min-h-0 w-full flex-1 items-center justify-center overflow-hidden bg-black">
          {!hasLoaded && !hasError && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black text-muted-foreground">
              <div className="grid h-12 w-12 place-items-center rounded-full border border-white/15 bg-white/5">
                <Camera className="h-6 w-6 animate-pulse text-white/70" />
              </div>
              <span className="text-body font-medium text-white/70">{t('camera.connecting')}</span>
            </div>
          )}
          {hasError ? (
            <div className="flex flex-col items-center gap-3 px-6 text-center text-white/70">
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
              className={cn('h-full w-full object-contain transition-opacity duration-base', hasLoaded ? 'opacity-100' : 'opacity-0')}
              onModeChange={() => {
                setHasLoaded(false);
                setHasError(false);
              }}
              onReady={() => {
                setHasLoaded(true);
                setHasError(false);
              }}
              onFailure={() => setHasError(true)}
            />
          )}
          {ptzSupported && deviceId && !hasError && (
            <div className="absolute bottom-3 right-3 rounded-modal border border-border/60 bg-background/85 p-1.5 shadow-depth-2 backdrop-blur sm:bottom-4 sm:right-4 sm:p-2">
              <CameraPtzControl deviceId={deviceId} />
            </div>
          )}
        </div>

      </section>
    </Modal>
  );
};
