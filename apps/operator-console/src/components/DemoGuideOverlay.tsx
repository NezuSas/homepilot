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
const TOOLTIP_WIDTH = 320;
const TOOLTIP_HEIGHT_APPROX = 240;
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

  if (!isActive || !currentStep) return null;

  // Position Calculations for Padded Cutout and Tooltip
  const getLayout = () => {
    if (!targetRect) return null;

    const L = targetRect.left - PADDING;
    const T = targetRect.top - PADDING;
    const R = targetRect.right + PADDING;
    const B = targetRect.bottom + PADDING;
    const W = targetRect.width + (PADDING * 2);
    const H = targetRect.height + (PADDING * 2);

    // Desktop Tooltip Placement
    const spaceAbove = T;
    let tooltipT = 0;
    if (spaceAbove > TOOLTIP_HEIGHT_APPROX + GAP) {
      tooltipT = T - TOOLTIP_HEIGHT_APPROX - GAP;
    } else {
      tooltipT = B + GAP;
    }

    const tooltipL = Math.min(
      Math.max(20, targetRect.left + targetRect.width / 2 - TOOLTIP_WIDTH / 2),
      window.innerWidth - TOOLTIP_WIDTH - 20
    );

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
      {isReady && layout && !isMobile && (
        <div 
          className="absolute pointer-events-auto transition-all duration-700 animate-in fade-in slide-in-from-bottom-4 zoom-in-95 ease-out outline-none z-[60]"
          style={{
            transform: `translate(${layout.tooltipL}px, ${layout.tooltipT}px)`,
            width: TOOLTIP_WIDTH,
          }}
        >
          <div className="bg-card/95 border border-primary/20 rounded-[2.5rem] p-8 shadow-2xl backdrop-blur-3xl relative overflow-hidden transition-all">
             <div className="absolute top-0 left-0 h-1 bg-primary/20 transition-all duration-1000" style={{ width: `${((currentStepIndex + 1) / steps.length) * 100}%` }} />
             
             <div className="flex items-center justify-between mb-4 mt-1">
                <span className="text-[10px] font-black uppercase tracking-[0.25em] text-primary/60">
                  {t('demo.controls.label')} • {t('demo.controls.step_of', { current: currentStepIndex + 1, total: steps.length })}
                </span>
                <button onClick={endDemo} className="p-1 -mr-2 text-muted-foreground hover:text-foreground transition-colors">
                   <X className="w-4 h-4" />
                </button>
             </div>
             
             <h3 className="text-xl font-black tracking-tighter mb-3 leading-tight text-foreground/90">{t(currentStep.titleKey)}</h3>
             <p className="text-sm text-muted-foreground leading-relaxed mb-8 opacity-80">
                {t(currentStep.descriptionKey)}
             </p>
             
             <div className="flex items-center gap-4">
                <Button 
                  onClick={nextStep} 
                  className="flex-1 rounded-2xl py-6 text-[10px] font-black uppercase tracking-widest gap-2 bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20"
                >
                  {currentStepIndex === steps.length - 1 ? t('demo.controls.finish') : t('demo.controls.continue')}
                  <ChevronRight className="w-4 h-4" />
                </Button>
                <button 
                  onClick={endDemo}
                  className="px-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground/30 hover:text-muted-foreground transition-all"
                >
                  {t('demo.controls.skip')}
                </button>
             </div>
          </div>
        </div>
      )}

      {/* Mobile Bottom Sheet z-60 */}
      {isReady && isMobile && (
        <div className="absolute bottom-0 left-0 right-0 p-4 pointer-events-auto z-[60] animate-in slide-in-from-bottom-full duration-500 ease-out px-6 pb-12">
           <div className="bg-card/95 border border-primary/20 rounded-[3rem] p-8 shadow-2xl backdrop-blur-3xl relative overflow-hidden">
             <div className="absolute top-0 left-0 right-0 h-1.5 bg-primary/10">
                <div className="h-full bg-primary transition-all duration-1000" style={{ width: `${((currentStepIndex + 1) / steps.length) * 100}%` }} />
             </div>
             
             <div className="flex items-center justify-between mb-4 mt-2">
                <span className="text-[11px] font-black uppercase tracking-[0.25em] text-primary/60">
                  {t('demo.controls.label')} • {currentStepIndex + 1}/{steps.length}
                </span>
                <button onClick={endDemo} className="p-2 -mr-3 text-muted-foreground hover:text-foreground transition-colors">
                   <X className="w-5 h-5" />
                </button>
             </div>
             
             <h3 className="text-2xl font-black tracking-tighter mb-4 leading-tight text-foreground/90">{t(currentStep.titleKey)}</h3>
             <p className="text-base text-muted-foreground leading-relaxed mb-10 font-medium">
                {t(currentStep.descriptionKey)}
             </p>
             
             <div className="flex flex-col gap-4">
                <Button 
                  onClick={nextStep} 
                  className="w-full rounded-[1.5rem] py-8 text-xs font-black uppercase tracking-widest gap-3 bg-primary hover:bg-primary/90 shadow-xl shadow-primary/20 h-auto"
                >
                  {currentStepIndex === steps.length - 1 ? t('demo.controls.finish') : t('demo.controls.continue')}
                  <ChevronRight className="w-5 h-5" />
                </Button>
                <button 
                  onClick={endDemo}
                  className="w-full text-[11px] font-black uppercase tracking-widest text-muted-foreground/40 hover:text-muted-foreground transition-all py-2"
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
