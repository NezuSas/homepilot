import { useEffect, useRef } from 'react';

export interface SensorGaugeScale { min: number; max: number; source: 'percentage' | 'metadata' | 'automatic' }

/** Display bounds are not a claim that a reading is healthy. */
export function getSensorGaugeScale(value: number, percentage: boolean, min?: unknown, max?: unknown, unit?: string | null): SensorGaugeScale {
  const lower = typeof min === 'number' ? min : typeof min === 'string' && min.trim() ? Number(min) : NaN;
  const upper = typeof max === 'number' ? max : typeof max === 'string' && max.trim() ? Number(max) : NaN;
  if (Number.isFinite(lower) && Number.isFinite(upper) && upper > lower) return { min: lower, max: upper, source: 'metadata' };
  if (percentage) return { min: 0, max: 100, source: 'percentage' };
  // Reference instrument windows, not safe/normal thresholds. Expand rather
  // than hide any real reading that falls outside the default display window.
  const window = unit === '°C' ? [-10, 50] : unit === '°F' ? [0, 120] : unit === 'bar' ? [0, 6] : unit === 'hPa' ? [950, 1050] : null;
  if (window && value >= window[0] && value <= window[1]) return { min: window[0], max: window[1], source: 'automatic' };
  const magnitude = Math.max(Math.abs(value), 1);
  const rawStep = magnitude / 4;
  const power = 10 ** Math.floor(Math.log10(rawStep));
  const factor = rawStep / power;
  const step = (factor <= 1 ? 1 : factor <= 2 ? 2 : factor <= 5 ? 5 : 10) * power;
  return value < 0
    ? { min: -Math.ceil(magnitude / step) * step, max: step, source: 'automatic' }
    : { min: 0, max: Math.max(step, Math.ceil(magnitude / step) * step), source: 'automatic' };
}

export function sensorNeedleFraction(value: number, scale: SensorGaugeScale): number {
  return Math.max(0, Math.min(1, (value - scale.min) / (scale.max - scale.min)));
}

export function formatSensorGaugeTick(value: number): string {
  const magnitude = Math.abs(value);
  const divisor = magnitude >= 1_000_000 ? 1_000_000 : magnitude >= 10_000 ? 1_000 : 1;
  const suffix = divisor === 1_000_000 ? 'M' : divisor === 1_000 ? 'k' : '';
  return `${Number((value / divisor).toPrecision(4))}${suffix}`;
}

/** A real, data-driven instrument, not a raster illustration. HTML owns the
 * accessible reading; Canvas keeps dial ticks sharp at every card width/DPR. */
export function SensorAnalogGauge({ value, scale }: { value: number | null; scale: SensorGaugeScale | null }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const min = scale?.min;
  const max = scale?.max;
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let disposed = false;
    const draw = () => {
      if (disposed) return;
      const width = canvas.getBoundingClientRect().width;
      if (!width) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const ratio = window.devicePixelRatio || 1;
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(width * 265 / 320 * ratio);
      ctx.setTransform(canvas.width / 320, 0, 0, canvas.height / 265, 0, 0);
      const style = getComputedStyle(canvas);
      const color = (name: string) => `hsl(${style.getPropertyValue(name).trim()})`;
      const ink = color('--foreground');
      const muted = color('--muted-foreground');
      const edge = color('--border');
      const surface = color('--card');
      const raised = color('--popover');
      const accent = color('--primary');
      const angle = (fraction: number) => (150 + fraction * 240) * Math.PI / 180;
      const point = (fraction: number, radius: number) => ({ x: 160 + Math.cos(angle(fraction)) * radius, y: 151 + Math.sin(angle(fraction)) * radius });
      const arc = (radius: number, thickness: number, from: number, to: number, paint: string | CanvasGradient) => {
        ctx.beginPath(); ctx.arc(160, 151, radius, angle(from), angle(to));
        ctx.lineWidth = thickness; ctx.strokeStyle = paint; ctx.stroke();
      };
      // Three concentric rims give the instrument the reference's machined depth.
      const rim = ctx.createLinearGradient(0, 0, 0, 265);
      rim.addColorStop(0, edge); rim.addColorStop(0.45, raised); rim.addColorStop(1, surface);
      arc(145, 12, 0, 1, rim);
      arc(136, 2, 0, 1, edge);
      const dial = ctx.createRadialGradient(160, 106, 8, 160, 151, 136);
      dial.addColorStop(0, raised); dial.addColorStop(1, surface);
      ctx.beginPath(); ctx.arc(160, 151, 133, angle(0), angle(1)); ctx.lineTo(160, 151); ctx.closePath();
      ctx.fillStyle = dial; ctx.fill();
      arc(132, 7, 0, 1, edge);
      const known = value !== null && min !== undefined && max !== undefined;
      if (known) {
        const fraction = sensorNeedleFraction(value, { min, max, source: 'metadata' });
        const light = ctx.createLinearGradient(20, 220, 260, 40);
        light.addColorStop(0, accent); light.addColorStop(1, color('--light-active'));
        if (fraction > 0) arc(132, 7, 0, fraction, light);
      }
      for (let index = 0; index <= 50; index += 1) {
        const major = index % 10 === 0;
        const start = point(index / 50, major ? 116 : index % 5 === 0 ? 120 : 124);
        const end = point(index / 50, 128);
        ctx.beginPath(); ctx.moveTo(start.x, start.y); ctx.lineTo(end.x, end.y);
        ctx.strokeStyle = major ? ink : muted; ctx.globalAlpha = known ? major ? 0.9 : 0.55 : 0.25;
        ctx.lineWidth = major ? 1.5 : 0.7; ctx.stroke();
      }
      ctx.globalAlpha = 1;
      if (known) {
        ctx.fillStyle = ink; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.font = `400 ${Math.max(14, 10 * 320 / width)}px Rubik, sans-serif`;
        const divisions = width < 200 ? 4 : 5;
        for (let index = 0; index <= divisions; index += 1) {
          const p = point(index / divisions, 101);
          const tick = min + (max - min) * index / divisions;
          const label = formatSensorGaugeTick(tick);
          ctx.fillText(label, p.x, p.y);
        }
        // Pivot to tip: needle is positioned by the actual value, never by type.
        const fraction = sensorNeedleFraction(value, { min, max, source: 'metadata' });
        const tip = point(fraction, 111);
        const a = angle(fraction);
        const needle = ctx.createLinearGradient(160, 151, tip.x, tip.y);
        needle.addColorStop(0, accent); needle.addColorStop(1, color('--light-active'));
        ctx.beginPath(); ctx.moveTo(tip.x, tip.y);
        ctx.lineTo(160 + Math.cos(a + Math.PI / 2) * 7, 151 + Math.sin(a + Math.PI / 2) * 7);
        ctx.lineTo(160 + Math.cos(a - Math.PI / 2) * 7, 151 + Math.sin(a - Math.PI / 2) * 7);
        ctx.closePath(); ctx.fillStyle = needle; ctx.fill();
      }
      const pivot = ctx.createLinearGradient(150, 137, 166, 164);
      pivot.addColorStop(0, raised); pivot.addColorStop(1, surface);
      ctx.beginPath(); ctx.arc(160, 151, 15, 0, Math.PI * 2);
      ctx.fillStyle = pivot; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = edge; ctx.stroke();
    };
    const resize = new ResizeObserver(draw);
    resize.observe(canvas);
    const theme = new MutationObserver(draw);
    theme.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    void document.fonts.ready.then(draw);
    draw();
    return () => { disposed = true; resize.disconnect(); theme.disconnect(); };
  }, [value, min, max]);
  return <canvas ref={canvasRef} className="sensor-analog-canvas" aria-hidden="true" />;
}
