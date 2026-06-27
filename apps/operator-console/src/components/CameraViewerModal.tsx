import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Maximize2, VideoOff, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '../lib/utils';
import { CameraMediaFrame, type CameraFeedMode } from './CameraMediaFrame';
import { IconButton } from './ui/IconButton';

interface CameraViewerModalProps {
  isOpen: boolean;
  name: string;
  roomName?: string;
  streamUrl: string;
  snapshotUrl: string;
  preferredMode: CameraFeedMode;
  onClose: () => void;
}

export const CameraViewerModal: React.FC<CameraViewerModalProps> = ({
  isOpen,
  name,
  roomName,
  streamUrl,
  snapshotUrl,
  preferredMode,
  onClose,
}) => {
  const { t } = useTranslation();
  const [hasLoaded, setHasLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [feedMode, setFeedMode] = useState<CameraFeedMode>(preferredMode);

  useEffect(() => {
    if (!isOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) {
      setHasLoaded(false);
      setHasError(false);
      setFeedMode(preferredMode);
    }
  }, [isOpen, preferredMode]);

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-background/95 p-2 backdrop-blur-xl sm:p-4" role="dialog" aria-modal="true" aria-label={t('camera.viewer_label', { name })}>
      <button className="absolute inset-0 cursor-default" aria-label={t('camera.close_viewer')} onClick={onClose} />
      <section className="relative z-10 flex h-[calc(100dvh-1rem)] w-full max-w-[112rem] flex-col overflow-hidden rounded-modal border border-border/70 bg-card shadow-depth-3 sm:h-[calc(100dvh-2rem)]">
        <header className="flex shrink-0 items-center justify-between gap-4 border-b border-border/60 px-4 py-3 sm:px-6 sm:py-4">
          <div className="min-w-0">
            <div className={cn('flex items-center gap-2 text-micro font-semibold uppercase tracking-[0.18em]', feedMode === 'snapshot' ? 'text-warning' : 'text-success')}>
              <span className={feedMode === 'snapshot' ? 'status-dot-warning' : 'status-dot-synced'} aria-hidden="true" />
              {feedMode === 'snapshot' ? t('camera.snapshot') : t('camera.live')}
            </div>
            <h2 className="mt-1 truncate text-section-title font-semibold tracking-tight text-foreground">{name}</h2>
            {roomName && <p className="truncate text-caption text-muted-foreground">{roomName}</p>}
          </div>
          <IconButton icon={X} label={t('camera.close_viewer')} onClick={onClose} variant="ghost" className="shrink-0 rounded-pill border border-border/60 bg-muted/60" />
        </header>

        <div className="relative flex min-h-0 flex-1 items-center justify-center bg-black">
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
              streamUrl={streamUrl}
              snapshotUrl={snapshotUrl}
              preferredMode={preferredMode}
              alt={t('camera.feed_alt', { name })}
              className={cn('h-full w-full object-contain transition-opacity duration-base', hasLoaded ? 'opacity-100' : 'opacity-0')}
              onModeChange={(mode) => {
                setFeedMode(mode);
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
        </div>

        <footer className="flex shrink-0 items-center gap-2 border-t border-border/60 px-4 py-3 text-caption text-muted-foreground sm:px-6">
          <Maximize2 className="h-3.5 w-3.5" />
          {feedMode === 'snapshot' ? t('camera.snapshot_hint') : t('camera.fullscreen_hint')}
        </footer>
      </section>
    </div>,
    document.body,
  );
};
