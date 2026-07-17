import { useId } from 'react';

/**
 * Animated weather glyphs (sun rays, drifting layered clouds, falling
 * rain/snow, lightning flicker, twinkling stars) rendered as plain SVG + CSS
 * keyframes (see index.css `weather-*` animations), Home Assistant
 * weather-card style rather than a static icon.
 */
export type WeatherCategory =
  | 'clear-day'
  | 'clear-night'
  | 'partly-cloudy-day'
  | 'partly-cloudy-night'
  | 'cloudy'
  | 'fog'
  | 'drizzle'
  | 'rain'
  | 'snow'
  | 'storm';

export function getWeatherCategory(code: number, isDaytime: boolean): WeatherCategory {
  if (code === 0) return isDaytime ? 'clear-day' : 'clear-night';
  if ([1, 2].includes(code)) return isDaytime ? 'partly-cloudy-day' : 'partly-cloudy-night';
  if (code === 3) return 'cloudy';
  if ([45, 48].includes(code)) return 'fog';
  if ([51, 53, 55, 56, 57].includes(code)) return 'drizzle';
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return 'rain';
  if ([71, 73, 75, 77, 85, 86].includes(code)) return 'snow';
  if ([95, 96, 99].includes(code)) return 'storm';

  return 'cloudy';
}

// A single smooth bezier silhouette (three soft lobes over a rounded base)
// instead of overlapping primitives, so the cloud reads as one clean shape.
const CLOUD_PATH =
  'M19.5 40C10.9 40 4 33.2 4 24.8C4 17.4 9.4 11.2 16.6 9.8C19.2 4 25.3 0 32.3 0C39.9 0 46.4 4.7 49 11.4C56.9 12.1 63 18.6 63 26.4C63 34.6 56.2 41.2 47.8 41.2H19.5Z';

function Sun({ cx = 32, cy = 32, r = 12, floaty = true }: { cx?: number; cy?: number; r?: number; floaty?: boolean }) {
  return (
    <g className={floaty ? 'animate-weather-sun-float' : undefined}>
      <circle cx={cx} cy={cy} r={r + 11} className="fill-amber-300/15 animate-weather-sun-pulse" />
      <circle cx={cx} cy={cy} r={r + 4} className="fill-amber-400/25" />
      <g className="animate-weather-sun-spin" style={{ transformOrigin: `${cx}px ${cy}px` }}>
        {Array.from({ length: 8 }).map((_, index) => (
          <line
            key={index}
            x1={cx}
            y1={cy - r - 3}
            x2={cx}
            y2={cy - r - 10}
            className="stroke-amber-400"
            strokeWidth="3"
            strokeLinecap="round"
            transform={`rotate(${index * 45} ${cx} ${cy})`}
          />
        ))}
      </g>
      <circle cx={cx} cy={cy} r={r} className="fill-amber-400" />
      <circle cx={cx - r * 0.32} cy={cy - r * 0.32} r={r * 0.32} className="fill-amber-100/70" />
    </g>
  );
}

function Moon({ cx = 32, cy = 30, r = 11 }: { cx?: number; cy?: number; r?: number }) {
  return (
    <g className="animate-weather-sun-float">
      <circle cx={cx} cy={cy} r={r + 7} className="fill-indigo-300/10" />
      <path
        d={`M ${cx + r * 0.5} ${cy - r} a ${r} ${r} 0 1 0 0 ${r * 2} a ${r * 0.72} ${r * 0.72} 0 1 1 0 -${r * 2}`}
        className="fill-slate-200"
      />
      <circle cx={cx - r * 0.35} cy={cy - r * 0.3} r={r * 0.16} className="fill-slate-100/70" />
    </g>
  );
}

function Stars({ points }: { points: Array<{ x: number; y: number; r: number; delay: number }> }) {
  return (
    <>
      {points.map((point, index) => (
        <circle
          key={index}
          cx={point.x}
          cy={point.y}
          r={point.r}
          className="fill-slate-100 animate-weather-twinkle"
          style={{ animationDelay: `${point.delay}s` }}
        />
      ))}
    </>
  );
}

type CloudTone = 'day' | 'night' | 'storm' | 'fog';

const CLOUD_TONES: Record<CloudTone, { top: string; bottom: string; rim: string }> = {
  day:   { top: '#ffffff', bottom: '#d7dee8', rim: '#eef2f7' },
  night: { top: '#e7ecf3', bottom: '#a9b4c4', rim: '#f2f5f9' },
  storm: { top: '#8b95a6', bottom: '#4b5566', rim: '#aab2c0' },
  fog:   { top: '#fbfcfe', bottom: '#cfd7e0', rim: '#ffffff' },
};

/** A single, smooth cloud silhouette with soft shading, an ambient contact
 * shadow and a glossy highlight — the visual anchor of every scene. */
function Cloud({
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

function RainDrops({ count = 5, heavy = false, y = 40 }: { count?: number; heavy?: boolean; y?: number }) {
  const startX = 20;
  const span = 24;

  return (
    <>
      {Array.from({ length: count }).map((_, index) => {
        const x = startX + (index * span) / Math.max(1, count - 1);
        const delay = (index % 3) * 0.18;

        return (
          <line
            key={index}
            x1={x}
            y1={y}
            x2={x - 2}
            y2={y + 8}
            className={heavy ? 'stroke-sky-400 animate-weather-rain' : 'stroke-sky-300 animate-weather-rain'}
            strokeWidth={heavy ? 2.4 : 1.8}
            strokeLinecap="round"
            style={{ animationDelay: `${delay}s`, animationDuration: heavy ? '0.6s' : '1s' }}
          />
        );
      })}
    </>
  );
}

function SnowFlakes({ count = 5, y = 40 }: { count?: number; y?: number }) {
  const startX = 20;
  const span = 24;

  return (
    <>
      {Array.from({ length: count }).map((_, index) => {
        const x = startX + (index * span) / Math.max(1, count - 1);
        const delay = (index % 4) * 0.35;

        return (
          <circle
            key={index}
            cx={x}
            cy={y}
            r={1.4}
            className="fill-white animate-weather-snow"
            style={{ animationDelay: `${delay}s`, animationDuration: `${2.4 + (index % 3) * 0.4}s` }}
          />
        );
      })}
    </>
  );
}

function LightningBolt() {
  return (
    <polygon
      points="33,36 26,49 31,49 28,58 41,43 35,43 39,34"
      className="fill-yellow-300 animate-weather-flash"
    />
  );
}

function FogBands() {
  return (
    <>
      {[24, 32, 40].map((y, index) => (
        <rect
          key={y}
          x="10"
          y={y}
          width="44"
          height="4"
          rx="2"
          className="fill-slate-300/70 animate-weather-fog"
          style={{ animationDelay: `${index * 0.6}s` }}
        />
      ))}
    </>
  );
}

function renderScene(category: WeatherCategory) {
  switch (category) {
    case 'clear-day':
      return <Sun />;
    case 'clear-night':
      return (
        <>
          <Stars points={[
            { x: 14, y: 16, r: 1.2, delay: 0 },
            { x: 50, y: 12, r: 1, delay: 0.6 },
            { x: 54, y: 26, r: 1.3, delay: 1.1 },
          ]}
          />
          <Moon />
        </>
      );
    case 'partly-cloudy-day':
      return (
        <>
          <g transform="translate(6 -4) scale(0.8)"><Sun cx={30} cy={26} r={10} floaty={false} /></g>
          <Cloud x={0} y={14} scale={1.08} tone="day" driftClass="animate-weather-cloud-a" />
        </>
      );
    case 'partly-cloudy-night':
      return (
        <>
          <g transform="translate(4 -6) scale(0.8)"><Moon cx={28} cy={22} r={9} /></g>
          <Cloud x={2} y={16} scale={1.05} tone="night" driftClass="animate-weather-cloud-a" />
        </>
      );
    case 'cloudy':
      return (
        <>
          <Cloud x={-8} y={2} scale={0.85} tone="day" driftClass="animate-weather-cloud-bg" layer="back" />
          <Cloud x={4} y={13} scale={1.15} tone="day" driftClass="animate-weather-cloud-a" />
        </>
      );
    case 'fog':
      return (
        <>
          <Cloud x={0} y={2} scale={0.9} tone="fog" driftClass="animate-weather-cloud-a" />
          <FogBands />
        </>
      );
    case 'drizzle':
      return (
        <>
          <Cloud x={-6} y={0} scale={0.8} tone="day" driftClass="animate-weather-cloud-bg" layer="back" />
          <Cloud x={0} y={5} scale={1.05} tone="day" driftClass="animate-weather-cloud-a" />
          <RainDrops count={3} />
        </>
      );
    case 'rain':
      return (
        <>
          <Cloud x={-8} y={-2} scale={0.85} tone="night" driftClass="animate-weather-cloud-bg" layer="back" />
          <Cloud x={-2} y={3} scale={1.12} tone="night" driftClass="animate-weather-cloud-a" />
          <RainDrops count={5} heavy />
        </>
      );
    case 'snow':
      return (
        <>
          <Cloud x={-6} y={0} scale={0.85} tone="fog" driftClass="animate-weather-cloud-bg" layer="back" />
          <Cloud x={0} y={5} scale={1.05} tone="fog" driftClass="animate-weather-cloud-a" />
          <SnowFlakes />
        </>
      );
    case 'storm':
      return (
        <>
          <rect x="0" y="0" width="64" height="64" rx="10" className="fill-yellow-100 animate-weather-flash-wash" />
          <Cloud x={-8} y={-4} scale={0.9} tone="storm" driftClass="animate-weather-cloud-bg" layer="back" />
          <Cloud x={-2} y={1} scale={1.12} tone="storm" driftClass="animate-weather-cloud-b" />
          <LightningBolt />
          <RainDrops count={3} heavy y={42} />
        </>
      );
    default:
      return null;
  }
}

const SIZE_PX: Record<'sm' | 'md' | 'lg', number> = {
  sm: 28,
  md: 56,
  lg: 108,
};

export function WeatherScene({
  category,
  size = 'md',
  className = '',
}: {
  category: WeatherCategory;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const dims = SIZE_PX[size];

  return (
    <svg
      width={dims}
      height={dims}
      viewBox="0 0 64 64"
      className={`shrink-0 overflow-visible ${className}`}
      aria-hidden="true"
    >
      {renderScene(category)}
    </svg>
  );
}
