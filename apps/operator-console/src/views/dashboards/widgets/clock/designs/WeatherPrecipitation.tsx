import { getParticleX } from './weatherSceneModel';

export function RainDrops({ count = 5, heavy = false, y = 40 }: { count?: number; heavy?: boolean; y?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, index) => {
        const x = getParticleX(index, count);
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

export function SnowFlakes({ count = 5, y = 40 }: { count?: number; y?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, index) => {
        const x = getParticleX(index, count);
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

export function LightningBolt() {
  return (
    <polygon
      points="33,36 26,49 31,49 28,58 41,43 35,43 39,34"
      className="fill-yellow-300 animate-weather-flash"
    />
  );
}

export function FogBands() {
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
