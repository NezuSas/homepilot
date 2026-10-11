export function Sun({ cx = 32, cy = 32, r = 12, floaty = true }: { cx?: number; cy?: number; r?: number; floaty?: boolean }) {
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

export function Moon({ cx = 32, cy = 30, r = 11 }: { cx?: number; cy?: number; r?: number }) {
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

export function Stars({ points }: { points: Array<{ x: number; y: number; r: number; delay: number }> }) {
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
