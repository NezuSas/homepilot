import { useLayoutEffect, useRef, useState } from 'react';
import { pad } from '../views/dashboards/widgets/clock/clockUtils';

const FLIP_DURATION_MS = 640;

function FlipDigit({ value }: { value: string }) {
  const previousValue = useRef(value);
  const [outgoing, setOutgoing] = useState<string | null>(null);

  useLayoutEffect(() => {
    if (previousValue.current === value) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      previousValue.current = value;
      return;
    }
    setOutgoing(previousValue.current);
    previousValue.current = value;
    const timer = window.setTimeout(() => setOutgoing(null), FLIP_DURATION_MS);
    return () => window.clearTimeout(timer);
  }, [value]);

  return <span className="homepilot-flip-digit" data-digit={value} aria-hidden="true">
    <span className="homepilot-flip-half homepilot-flip-top"><span>{value}</span></span>
    <span className="homepilot-flip-half homepilot-flip-bottom"><span>{outgoing ?? value}</span></span>
    {outgoing !== null && <>
      <span className="homepilot-flip-half homepilot-flip-top homepilot-flip-fold-out"><span>{outgoing}</span></span>
      <span className="homepilot-flip-half homepilot-flip-bottom homepilot-flip-fold-in"><span>{value}</span></span>
    </>}
  </span>;
}

/** Inicio-only presentation. The live time source remains shared with Dashboard Clock. */
export function HomeFlipClock({ now }: { now: Date }) {
  const hours = pad(now.getHours());
  const minutes = pad(now.getMinutes());
  const time = `${hours}:${minutes}`;

  return <time className="homepilot-flip-clock" dateTime={time} aria-label={time} data-home-flip-clock>
    <span className="homepilot-flip-pair" aria-hidden="true">
      <FlipDigit value={hours[0]} />
      <FlipDigit value={hours[1]} />
    </span>
    <span className="homepilot-flip-colon" aria-hidden="true">:</span>
    <span className="homepilot-flip-pair" aria-hidden="true">
      <FlipDigit value={minutes[0]} />
      <FlipDigit value={minutes[1]} />
    </span>
  </time>;
}
