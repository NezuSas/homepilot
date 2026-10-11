import { useId } from 'react';
import { CLOUD_PATH, CLOUD_TONES, type CloudTone } from './weatherSceneModel';

/** A single, smooth cloud silhouette with soft shading, an ambient contact
 * shadow and a glossy highlight — the visual anchor of every scene. */
export function Cloud({
  x = 4,
  y = 12,
  scale = 1,
  tone = 'day',
  driftClass = 'animate-weather-cloud-a',
  layer = 'front',
}: {
  x?: number;
  y?: number;
  scale?: number;
  tone?: CloudTone;
  driftClass?: string;
  layer?: 'front' | 'back';
}) {
  const gradientId = useId();
  const shadowId = useId();
  const colors = CLOUD_TONES[tone];
  const isBack = layer === 'back';

  return (
    <g
      transform={`translate(${x} ${y}) scale(${scale})`}
      className={driftClass}
      style={{ transformOrigin: '32px 20px' }}
      opacity={isBack ? 0.55 : 1}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={colors.top} />
          <stop offset="100%" stopColor={colors.bottom} />
        </linearGradient>
        {!isBack && (
          <filter id={shadowId} x="-30%" y="-20%" width="160%" height="170%">
            <feDropShadow dx="0" dy="3" stdDeviation="2.2" floodColor="#0f172a" floodOpacity="0.25" />
          </filter>
        )}
      </defs>
      <g filter={isBack ? undefined : `url(#${shadowId})`} style={isBack ? { filter: 'blur(1.5px)' } : undefined}>
        <path d={CLOUD_PATH} fill={`url(#${gradientId})`} stroke={colors.rim} strokeOpacity={0.6} strokeWidth={0.6} />
      </g>
      {!isBack && <ellipse cx="19" cy="11" rx="8" ry="4.4" fill="#ffffff" opacity="0.55" />}
    </g>
  );
}
