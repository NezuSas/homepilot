import { useId } from 'react';
import { cn } from '../../lib/utils';

interface RoomSceneProps {
  lightsOn: boolean;
  /** Mean cover opening in percent, or null when no position is known (no curtains are drawn). */
  curtainOpen: number | null;
  className?: string;
}

const fill = (token: string) => ({ fill: `hsl(var(--scene-${token}))` });
const stroke = (token: string) => ({ stroke: `hsl(var(--scene-${token}))` });

const WINDOW_INNER = { x: 42, width: 138, top: 22, height: 118 } as const;

/**
 * Decorative room illustration. It restates state the room already exposes
 * (a lit lamp, drawn curtains); it carries no text and no interaction. Colors
 * come from `--scene-*` tokens, so dark renders night and light renders day.
 */
export function RoomScene({ lightsOn, curtainOpen, className }: RoomSceneProps) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const wall = `${uid}wall`;
  const floor = `${uid}floor`;
  const sky = `${uid}sky`;
  const cloth = `${uid}cloth`;
  const glow = `${uid}glow`;
  const panelWidth = curtainOpen === null ? 0 : 14 + 69 * (1 - curtainOpen / 100);
  const folds = [0.2, 0.4, 0.6, 0.8];

  return (
    <div
      aria-hidden="true"
      data-room-scene=""
      data-lights-on={lightsOn}
      data-curtain-open={curtainOpen ?? 'unknown'}
      className={cn('relative aspect-[5/2] w-full overflow-hidden', className)}
      style={{ backgroundColor: 'hsl(var(--scene-wall-a))' }}
    >
      <svg viewBox="0 0 640 260" preserveAspectRatio="xMidYMax meet" className="absolute inset-0 h-full w-full">
        <defs>
          <linearGradient id={wall} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" style={{ stopColor: 'hsl(var(--scene-wall-a))' }} />
            <stop offset="1" style={{ stopColor: 'hsl(var(--scene-wall-b))' }} />
          </linearGradient>
          <linearGradient id={floor} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" style={{ stopColor: 'hsl(var(--scene-floor-a))' }} />
            <stop offset="1" style={{ stopColor: 'hsl(var(--scene-floor-b))' }} />
          </linearGradient>
          <linearGradient id={sky} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" style={{ stopColor: 'hsl(var(--scene-sky-a))' }} />
            <stop offset="1" style={{ stopColor: 'hsl(var(--scene-sky-b))' }} />
          </linearGradient>
          <linearGradient id={cloth} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" style={{ stopColor: 'hsl(var(--scene-curtain-a))' }} />
            <stop offset="0.5" style={{ stopColor: 'hsl(var(--scene-curtain-b))' }} />
            <stop offset="1" style={{ stopColor: 'hsl(var(--scene-curtain-a))' }} />
          </linearGradient>
          <radialGradient id={glow}>
            <stop offset="0" style={{ stopColor: 'hsl(var(--scene-glow))', stopOpacity: 'var(--scene-glow-strength)' }} />
            <stop offset="0.45" style={{ stopColor: 'hsl(var(--scene-glow))', stopOpacity: 'calc(var(--scene-glow-strength) * 0.32)' }} />
            <stop offset="1" style={{ stopColor: 'hsl(var(--scene-glow))', stopOpacity: 0 }} />
          </radialGradient>
        </defs>

        <rect width="640" height="260" fill={`url(#${wall})`} />
        <rect y="206" width="640" height="54" fill={`url(#${floor})`} />
        <rect y="204" width="640" height="3" style={fill('base')} />
        <ellipse cx="330" cy="232" rx="230" ry="16" style={fill('floor-a')} />

        {/* Window */}
        <rect x="36" y="22" width="150" height="112" rx="7" style={fill('frame')} />
        <rect x={WINDOW_INNER.x} y="28" width={WINDOW_INNER.width} height="100" rx="3" fill={`url(#${sky})`} />
        <circle cx="118" cy="52" r="9" style={fill('orb')} />
        <g style={{ ...fill('orb'), opacity: 'calc(var(--scene-stars) * 0.7)' }}>
          <circle cx="68" cy="46" r="1.2" /><circle cx="150" cy="72" r="1" /><circle cx="96" cy="96" r="1.1" /><circle cx="160" cy="104" r="1" />
        </g>
        <rect x="26" y="16" width="170" height="5" rx="2.5" style={fill('rod')} />
        {curtainOpen !== null && (
          <g data-room-curtains="">
            {[28, 194 - panelWidth].map((x, side) => (
              <g key={side}>
                <rect x={x} y={WINDOW_INNER.top} width={panelWidth} height={WINDOW_INNER.height + 6} rx="4" fill={`url(#${cloth})`} />
                {folds.map((fold) => (
                  <path key={fold} d={`M${x + panelWidth * fold} ${WINDOW_INNER.top + 4}v${WINDOW_INNER.height - 2}`} strokeWidth="1.6" style={{ ...stroke('fold'), opacity: 0.55 }} />
                ))}
              </g>
            ))}
          </g>
        )}

        {/* Art */}
        <rect x="250" y="30" width="120" height="60" rx="3" strokeWidth="2.5" style={{ ...fill('art-frame'), ...stroke('art-line') }} />
        <circle cx="310" cy="60" r="15" style={{ ...fill('glow'), opacity: 0.42 }} />
        <rect x="262" y="74" width="34" height="6" rx="3" style={fill('art-line')} />
        <rect x="322" y="42" width="34" height="6" rx="3" style={fill('art-line')} />

        {/* Sofa and table */}
        <ellipse cx="330" cy="206" rx="150" ry="9" style={{ ...fill('shadow'), opacity: 0.6 }} />
        <rect x="236" y="84" width="188" height="64" rx="16" style={fill('sofa-back')} />
        <rect x="226" y="134" width="208" height="62" rx="16" style={fill('sofa-seat')} />
        <rect x="220" y="122" width="30" height="74" rx="12" style={fill('sofa-arm')} />
        <rect x="410" y="122" width="30" height="74" rx="12" style={fill('sofa-arm')} />
        <rect x="252" y="138" width="80" height="26" rx="9" style={fill('cushion')} />
        <rect x="338" y="138" width="80" height="26" rx="9" style={fill('cushion')} />
        <rect x="290" y="190" width="80" height="9" rx="4.5" style={fill('art-frame')} />

        {/* Plant */}
        <ellipse cx="561" cy="200" rx="20" ry="4" style={{ ...fill('shadow'), opacity: 0.5 }} />
        <rect x="548" y="172" width="26" height="26" rx="5" style={fill('pot')} />
        <ellipse cx="561" cy="150" rx="9" ry="22" style={fill('plant-a')} />
        <ellipse cx="548" cy="160" rx="8" ry="17" transform="rotate(-25 548 160)" style={fill('plant-b')} />
        <ellipse cx="574" cy="160" rx="8" ry="17" transform="rotate(25 574 160)" style={fill('plant-c')} />

        {/* Floor lamp */}
        {lightsOn && (
          <g data-room-lamp-glow="">
            <circle cx="494" cy="100" r="170" fill={`url(#${glow})`} />
            <ellipse cx="494" cy="214" rx="90" ry="12" style={{ ...fill('glow'), opacity: 'calc(var(--scene-glow-strength) * 0.35)' }} />
          </g>
        )}
        <rect x="492" y="116" width="3" height="80" style={fill('pole')} />
        <ellipse cx="494" cy="196" rx="22" ry="5" style={fill('sofa-arm')} />
        <path d="M470 116 L476 78 H512 L518 116 Z" style={fill(lightsOn ? 'shade-on' : 'shade-off')} />

        {!lightsOn && <rect width="640" height="260" style={{ ...fill('veil'), opacity: 'var(--scene-veil-strength)' }} />}
      </svg>
    </div>
  );
}
