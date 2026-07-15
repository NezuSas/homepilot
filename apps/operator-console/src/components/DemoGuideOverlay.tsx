import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useDemoGuideStore } from '../stores/useDemoGuideStore';
import { cn } from '../lib/utils';
import { Button } from './ui/Button';
import { X, ChevronRight } from 'lucide-react';
import type { View } from '../types';

/**
 * Constants for Guided Demo UX
 */
const PADDING = 8;
const GAP = 12;
const VIEWPORT_MARGIN = 20;
const TOOLTIP_WIDTH = 320;
const TOOLTIP_HEIGHT_APPROX = 230;
const MOBILE_BREAKPOINT = 768;

interface DemoGuideOverlayProps {
  onNavigate?: (view: View) => void;
}

export const DemoGuideOverlay: React.FC<DemoGuideOverlayProps> = ({ onNavigate }) => {
  const { t } = useTranslation();
  const { isActive, currentStepIndex, steps, nextStep, endDemo } = useDemoGuideStore();
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < MOBILE_BREAKPOINT);

  const currentStep = steps[currentStepIndex];

  const updatePosition = useCallback(() => {
    if (!currentStep) return;
    const el = document.querySelector(currentStep.target) as HTMLElement | null;
    if (el) {
      setTargetRect(el.getBoundingClientRect());
      setIsReady(true);
    } else {
      setTargetRect(null);
      setIsReady(false);
    }
  }, [currentStep]);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
      updatePosition();
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [updatePosition]);

  useEffect(() => {
    if (!isActive || !currentStep) return;

    // Handle initial navigation if requested by step
    if (currentStep.view && onNavigate) {
      onNavigate(currentStep.view);
    }

    setTargetRect(null);
    setIsReady(false);

    let attempts = 0;
    const maxAttempts = 30;
    
    const checkElement = setInterval(() => {
      const el = document.querySelector(currentStep.target) as HTMLElement | null;
      if (el) {
        // Smart scroll: only if element is not fully visible
        const rect = el.getBoundingClientRect();
        const isPartiallyOff = rect.top < 0 || rect.bottom > window.innerHeight;
        
        if (isPartiallyOff) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          // Wait for scroll to settle before updating position
          setTimeout(updatePosition, 300);
        } else {
          updatePosition();
        }
        
        clearInterval(checkElement);
      } else {
        attempts++;
        if (attempts >= maxAttempts) {
          clearInterval(checkElement);
          nextStep();
        }
      }
    }, 100);

    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);

    return () => {
      clearInterval(checkElement);
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [isActive, currentStep, onNavigate, updatePosition, nextStep]);

  if (!isActive || !currentStep || isMobile) return null;

  // Position Calculations for Padded Cutout and Tooltip
  const getLayout = () => {
    if (!targetRect) return null;

    const L = targetRect.left - PADDING;
    const T = targetRect.top - PADDING;
    const R = targetRect.right + PADDING;
    const B = targetRect.bottom + PADDING;
    const W = targetRect.width + (PADDING * 2);
    const H = targetRect.height + (PADDING * 2);

    const clampX = (value: number) => Math.min(
      Math.max(VIEWPORT_MARGIN, value),
      window.innerWidth - TOOLTIP_WIDTH - VIEWPORT_MARGIN
    );
    const clampY = (value: number) => Math.min(
      Math.max(VIEWPORT_MARGIN, value),
      window.innerHeight - TOOLTIP_HEIGHT_APPROX - VIEWPORT_MARGIN
    );
    const centeredY = clampY(targetRect.top + (targetRect.height / 2) - (TOOLTIP_HEIGHT_APPROX / 2));
    const centeredX = clampX(targetRect.left + (targetRect.width / 2) - (TOOLTIP_WIDTH / 2));

    let tooltipL = 0;
    let tooltipT = 0;

    if (window.innerWidth - R >= TOOLTIP_WIDTH + GAP + VIEWPORT_MARGIN) {
      tooltipL = R + GAP;
      tooltipT = centeredY;
    } else if (L >= TOOLTIP_WIDTH + GAP + VIEWPORT_MARGIN) {
      tooltipL = L - TOOLTIP_WIDTH - GAP;
      tooltipT = centeredY;
    } else if (window.innerHeight - B >= TOOLTIP_HEIGHT_APPROX + GAP + VIEWPORT_MARGIN) {
      tooltipL = centeredX;
      tooltipT = B + GAP;
    } else {
      tooltipL = centeredX;
      tooltipT = Math.max(VIEWPORT_MARGIN, T - TOOLTIP_HEIGHT_APPROX - GAP);
    }

    return { L, T, R, B, W, H, tooltipL, tooltipT };
  };

  const layout = getLayout();

  return createPortal(
    <div className={cn(
      "fixed inset-0 z-[10000] pointer-events-none overflow-hidden font-sans transition-opacity duration-500",
      isReady ? "opacity-100" : "opacity-0"
    )}>
      {/* Backdrop z-40 */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-[2px] transition-all duration-500 z-[40]"
        style={{
          clipPath: (layout && !isMobile) 
            ? `polygon(0% 0%, 0% 100%, ${layout.L}px 100%, ${layout.L}px ${layout.T}px, ${layout.R}px ${layout.T}px, ${layout.R}px ${layout.B}px, ${layout.L}px ${layout.B}px, ${layout.L}px 100%, 100% 100%, 100% 0%)`
            : 'none'
        }}
      />

      {/* Highlighting Frame / Mobile Pulse Ring z-50 */}
      {layout && (
        <div 
          className={cn(
            "absolute rounded-2xl transition-all duration-500 ease-out z-[50]",
            isMobile 
              ? "border-[3px] border-primary/60 scale-125 animate-ping opacity-75" 
              : "border-2 border-primary shadow-[0_0_40px_rgba(var(--primary),0.25)] animate-pulse"
          )}
          style={{
            transform: `translate(${layout.L}px, ${layout.T}px)`,
            width: layout.W,
            height: layout.H,
          }}
        />
      )}

      {/* Desktop Tooltip z-60 */}
      {isReady && layout && (
        <div 
          className="absolute pointer-events-auto transition-all duration-700 animate-in fade-in slide-in-from-bottom-4 zoom-in-95 ease-out outline-none z-[60]"
          style={{
            transform: `translate(${layout.tooltipL}px, ${layout.tooltipT}px)`,
            width: TOOLTIP_WIDTH,
          }}
        >
          <div className="bg-card/95 border border-primary/20 rounded-[1.75rem] p-5 shadow-2xl backdrop-blur-3xl relative overflow-hidden transition-all">
             <div className="absolute top-0 left-0 h-0.5 bg-primary/20 transition-all duration-1000" style={{ width: `${((currentStepIndex + 1) / steps.length) * 100}%` }} />
             
             <div className="flex items-center justify-between mb-3 mt-0.5">
                <span className="text-micro font-black uppercase tracking-[0.2em] text-primary/60">
                  {t('demo.controls.label')} • {t('demo.controls.step_of', { current: currentStepIndex + 1, total: steps.length })}
                </span>
                <button onClick={endDemo} className="p-1 -mr-1.5 text-muted-foreground hover:text-foreground transition-colors">
                   <X className="w-3.5 h-3.5" />
                </button>
             </div>
             
             <h3 className="text-body-lg font-black tracking-tight mb-2 leading-tight text-foreground/90">{t(currentStep.titleKey)}</h3>
             <p className="text-caption text-muted-foreground leading-relaxed mb-4 opacity-85 font-medium">
                {t(currentStep.descriptionKey)}
             </p>
             
             <div className="flex items-center gap-3">
                <Button 
                  onClick={nextStep} 
                  size="sm"
                  className="h-10 min-w-[9rem] rounded-xl px-4 text-micro font-black uppercase tracking-widest gap-2 bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20"
                >
                  {currentStepIndex === steps.length - 1 ? t('demo.controls.finish') : t('demo.controls.continue')}
                  <ChevronRight className="w-3 h-3" />
                </Button>
                <button 
                  onClick={endDemo}
                  className="px-1 text-micro font-black uppercase tracking-widest text-muted-foreground/30 hover:text-muted-foreground transition-all"
                >
                  {t('demo.controls.skip')}
                </button>
             </div>
          </div>
        </div>
      )}
    </div>,
    document.body
  );
};
