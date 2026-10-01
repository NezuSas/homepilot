import React, { useEffect, useRef, useState } from 'react';
import { ArrowRight, ChevronsRight, LayoutDashboard } from 'lucide-react';

const COMPLETE_AT = 0.85;

interface SlideToDashboardButtonProps {
  label: string;
  accessibleLabel: string;
  instruction: string;
  disabled?: boolean;
  onActivate: () => void;
}

export const SlideToDashboardButton: React.FC<SlideToDashboardButtonProps> = ({
  label, accessibleLabel, instruction, disabled = false, onActivate,
}) => {
  const railRef = useRef<HTMLButtonElement>(null);
  const handleRef = useRef<HTMLSpanElement>(null);
  const gestureRef = useRef<{ pointerId: number; startX: number } | null>(null);
  const activatedRef = useRef(false);
  const [progress, setProgress] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [inView, setInView] = useState(true);

  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;
    let visible = true;
    const update = () => setInView(visible && !document.hidden);
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      update();
    }, { threshold: 0.1 });
    observer.observe(rail);
    document.addEventListener('visibilitychange', update);
    return () => {
      observer.disconnect();
      document.removeEventListener('visibilitychange', update);
    };
  }, []);

  const travel = () => Math.max(0, (railRef.current?.clientWidth ?? 0) - (handleRef.current?.offsetWidth ?? 0) - 12);
  const progressAt = (clientX: number) => {
    const gesture = gestureRef.current;
    const distance = travel();
    return gesture && distance > 0 ? Math.min(1, Math.max(0, (clientX - gesture.startX) / distance)) : 0;
  };
  const reset = () => { gestureRef.current = null; setDragging(false); setProgress(0); };
  const activate = () => {
    if (disabled || activatedRef.current) return;
    activatedRef.current = true;
    onActivate();
  };

  return (
    <button
      ref={railRef}
      type="button"
      className="homepilot-slide-dashboard relative z-20 self-end"
      disabled={disabled}
      aria-label={accessibleLabel}
      aria-describedby={disabled ? undefined : 'homepilot-slide-dashboard-instruction'}
      title={disabled ? accessibleLabel : undefined}
      data-dragging={dragging}
      data-motion={inView && !disabled && !dragging ? 'on' : 'off'}
      style={{ '--slide-progress': progress, '--slide-offset': `${progress * travel()}px` } as React.CSSProperties}
      onClick={(event) => { if (event.detail === 0) activate(); }}
      onKeyDown={(event) => { if (event.key === 'Escape') reset(); }}
    >
      <span className="homepilot-slide-dashboard-fill" aria-hidden="true" />
      <span
        ref={handleRef}
        className="homepilot-slide-dashboard-handle"
        aria-hidden="true"
        onPointerDown={(event) => {
          if (disabled || gestureRef.current) return;
          gestureRef.current = { pointerId: event.pointerId, startX: event.clientX };
          event.currentTarget.setPointerCapture(event.pointerId);
          setDragging(true);
        }}
        onPointerMove={(event) => {
          if (gestureRef.current?.pointerId === event.pointerId) setProgress(progressAt(event.clientX));
        }}
        onPointerUp={(event) => {
          if (gestureRef.current?.pointerId !== event.pointerId) return;
          const completed = progressAt(event.clientX) >= COMPLETE_AT;
          reset();
          if (completed) activate();
        }}
        onPointerCancel={reset}
      >
        <LayoutDashboard size={21} strokeWidth={2} />
      </span>
      <span className="homepilot-slide-dashboard-label">{label}</span>
      <ArrowRight className="homepilot-slide-dashboard-arrow" size={23} aria-hidden="true" />
      <ChevronsRight className="homepilot-slide-dashboard-chevrons" size={31} aria-hidden="true" />
      {!disabled && <span id="homepilot-slide-dashboard-instruction" className="sr-only">{instruction}</span>}
    </button>
  );
};
