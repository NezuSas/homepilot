/**
 * Animated weather glyphs (sun rays, drifting clouds, falling rain/snow,
 * lightning flicker, twinkling stars) rendered as plain SVG + CSS keyframes
 * (see index.css `weather-*` animations), Home Assistant weather-card style
 * rather than a static icon.
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

function Sun({ cx = 32, cy = 32, r = 12 }: { cx?: number; cy?: number; r?: number }) {
  return (
    <g>
      <circle cx={cx} cy={cy} r={r + 9} className="fill-amber-400/20 animate-weather-sun-pulse" />
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
    </g>
  );
}

function Moon({ cx = 32, cy = 30, r = 11 }: { cx?: number; cy?: number; r?: number }) {
  return (
    <g>
      <circle cx={cx} cy={cy} r={r + 6} className="fill-indigo-300/10" />
      <path
        d={`M ${cx + r * 0.5} ${cy - r} a ${r} ${r} 0 1 0 0 ${r * 2} a ${r * 0.72} ${r * 0.72} 0 1 1 0 -${r * 2}`}
        className="fill-slate-200"
      />
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

function Cloud({
  x = 0,
  y = 0,
  scale = 1,
  tone = 'fill-slate-100',
  driftClass = 'animate-weather-cloud-a',
}: {
  x?: number;
  y?: number;
  scale?: number;
  tone?: string;
  driftClass?: string;
}) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`} className={driftClass} style={{ transformOrigin: '32px 32px' }}>
      <rect x="16" y="20" width="32" height="10" rx="5" className={tone} />
      <ellipse cx="32" cy="20" rx="16" ry="10" className={tone} />
      <ellipse cx="21" cy="24" rx="9" ry="7" className={tone} />
      <ellipse cx="43" cy="23" rx="11" ry="8" className={tone} />
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
          <g transform="translate(6 -4) scale(0.8)"><Sun cx={30} cy={26} r={10} /></g>
          <Cloud x={0} y={12} scale={1.05} tone="fill-slate-100" driftClass="animate-weather-cloud-a" />
        </>
      );
    case 'partly-cloudy-night':
      return (
        <>
          <g transform="translate(4 -6) scale(0.8)"><Moon cx={28} cy={22} r={9} /></g>
          <Cloud x={2} y={14} scale={1.05} tone="fill-slate-300" driftClass="animate-weather-cloud-a" />
        </>
      );
    case 'cloudy':
      return (
        <>
          <Cloud x={-6} y={4} scale={0.95} tone="fill-slate-300" driftClass="animate-weather-cloud-b" />
          <Cloud x={4} y={12} scale={1.15} tone="fill-slate-100" driftClass="animate-weather-cloud-a" />
        </>
      );
    case 'fog':
      return (
        <>
          <Cloud x={0} y={2} scale={0.9} tone="fill-slate-300/70" driftClass="animate-weather-cloud-a" />
          <FogBands />
        </>
      );
    case 'drizzle':
      return (
        <>
          <Cloud x={0} y={4} scale={1.05} tone="fill-slate-200" driftClass="animate-weather-cloud-a" />
          <RainDrops count={3} />
        </>
      );
    case 'rain':
      return (
        <>
          <Cloud x={-2} y={2} scale={1.1} tone="fill-slate-300" driftClass="animate-weather-cloud-a" />
          <RainDrops count={5} heavy />
        </>
      );
    case 'snow':
      return (
        <>
          <Cloud x={0} y={4} scale={1.05} tone="fill-slate-200" driftClass="animate-weather-cloud-a" />
          <SnowFlakes />
        </>
      );
    case 'storm':
      return (
        <>
          <Cloud x={-2} y={0} scale={1.1} tone="fill-slate-500" driftClass="animate-weather-cloud-b" />
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
