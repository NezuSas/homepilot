import { AudioLines } from 'lucide-react';
import { useState } from 'react';
import { cn } from '../../../lib/utils';

/** Pure artwork surface shared by all playback states. */
export function MediaArtworkSquare({ artworkUrl, compact = false }: { artworkUrl: string | null; compact?: boolean }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const showArtwork = Boolean(artworkUrl && failedUrl !== artworkUrl);
  return (
    <div data-media-artwork className={cn('relative aspect-square shrink-0 overflow-hidden rounded-xl border border-border/45 bg-muted/55', compact ? 'w-20' : 'w-24 sm:w-28')}>
      {showArtwork ? (
        <img src={artworkUrl ?? undefined} alt="" className="h-full w-full object-cover" onError={() => setFailedUrl(artworkUrl)} />
      ) : (
        <div data-media-artwork-placeholder className="grid h-full w-full place-items-center bg-[radial-gradient(circle_at_30%_20%,hsl(var(--primary)/0.12),transparent_70%)] text-muted-foreground">
          <AudioLines aria-hidden="true" className="h-9 w-9" strokeWidth={1.25} />
        </div>
      )}
    </div>
  );
}
