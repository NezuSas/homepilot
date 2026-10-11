import { Moon, Stars, Sun } from './WeatherCelestial';
import { Cloud } from './WeatherCloud';
import { FogBands, LightningBolt, RainDrops, SnowFlakes } from './WeatherPrecipitation';
import { SIZE_PX, type WeatherCategory } from './weatherSceneModel';

/**
 * Animated weather glyphs (sun rays, drifting layered clouds, falling
 * rain/snow, lightning flicker, twinkling stars) rendered as plain SVG + CSS
 * keyframes (see index.css `weather-*` animations), Home Assistant
 * weather-card style rather than a static icon.
 */
export { getWeatherCategory, type WeatherCategory } from './weatherSceneModel';

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
