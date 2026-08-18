import React, { useEffect, useState } from 'react';
import { Maximize2, VideoOff, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '../lib/utils';
import { CameraMediaFrame, type CameraFeedMode } from './CameraMediaFrame';
import { CameraPtzControl } from './CameraPtzControl';
import { IconButton } from './ui/IconButton';
import { Modal } from './ui/Modal';

interface CameraViewerModalProps {
  isOpen: boolean;
  name: string;
  roomName?: string;
  streamUrl: string;
  liveUrl?: string;
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
  liveUrl,
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
        <div className="flex w-full shrink-0 items-center gap-2 px-4 py-3 text-caption text-muted-foreground sm:px-6">
          <Maximize2 className="h-3.5 w-3.5" />
          {t('camera.fullscreen_hint')}
        </div>
      )}
    >
      <section className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <header className="flex shrink-0 items-center justify-between gap-4 border-b border-border/60 px-4 py-3 sm:px-6 sm:py-4">
          <div className="min-w-0">
            <h2 className="truncate text-section-title font-semibold tracking-tight text-foreground">{name}</h2>
            {roomName && <p className="truncate text-caption text-muted-foreground">{roomName}</p>}
          </div>
          <IconButton icon={X} label={t('camera.close_viewer')} onClick={onClose} variant="ghost" className="shrink-0 rounded-pill border border-border/60 bg-muted/60" />
        </header>

        <div className="relative flex min-h-0 w-full flex-1 items-center justify-center overflow-hidden bg-black">
          {!hasLoaded && !hasError && (
            <div className="absolute inset-0 flex items-center justify-center bg-black text-muted-foreground">
              <span className="animate-pulse text-body font-medium">{t('camera.connecting')}</span>
            </div>
          )}
          {hasError ? (
            <div className="flex flex-col items-center gap-3 px-6 text-center text-white/70">
              <VideoOff className="h-10 w-10" />
              <p className="text-body font-semibold">{t('camera.stream_error')}</p>
            </div>
          ) : (
            <CameraMediaFrame
              active={isOpen}
              liveUrl={liveUrl}
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
            <div className="absolute bottom-4 right-4 rounded-modal border border-border/60 bg-background/80 p-2 backdrop-blur">
              <CameraPtzControl deviceId={deviceId} />
            </div>
          )}
        </div>

      </section>
    </Modal>
  );
};
