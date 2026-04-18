import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useDemoGuideStore } from '../stores/useDemoGuideStore';
import { cn } from '../lib/utils';
import { Button } from './ui/Button';
import { X, ChevronRight } from 'lucide-react';
import type { View } from '../types';

interface DemoGuideOverlayProps {
  onNavigate?: (view: View) => void;
}

export const DemoGuideOverlay: React.FC<DemoGuideOverlayProps> = ({ onNavigate }) => {
  const { t } = useTranslation();
  const { isActive, currentStepIndex, steps, nextStep, endDemo } = useDemoGuideStore();
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [isReady, setIsReady] = useState(false);

  const currentStep = steps[currentStepIndex];

  const updatePosition = useCallback(() => {
    if (!currentStep) return;
    const el = document.querySelector(currentStep.target);
    if (el) {
      setTargetRect(el.getBoundingClientRect());
      setIsReady(true);
    } else {
      setTargetRect(null);
      setIsReady(false);
    }
  }, [currentStep]);

  useEffect(() => {
    if (!isActive || !currentStep) return;

    // Handle initial navigation for the step
    if (currentStep.view && onNavigate) {
      onNavigate(currentStep.view);
    }

    // Resilient polling for element availability
    let attempts = 0;
    const maxAttempts = 30; // 3 seconds total
    
    setTargetRect(null);
    setIsReady(false);

    const checkElement = setInterval(() => {
      const el = document.querySelector(currentStep.target);
      if (el) {
        updatePosition();
        clearInterval(checkElement);
      } else {
        attempts++;
        if (attempts >= maxAttempts) {
          clearInterval(checkElement);
          // Gracefully move to next step if target never appears
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

  return createPortal(
    <div className={cn(
      "fixed inset-0 z-[9999] pointer-events-none overflow-hidden font-sans",
      isReady ? "opacity-100" : "opacity-0"
    )}>
      {/* Backdrop with Mask */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-[2px] transition-all duration-500"
        style={{
          clipPath: targetRect 
            ? `polygon(0% 0%, 0% 100%, ${targetRect.left}px 100%, ${targetRect.left}px ${targetRect.top}px, ${targetRect.right}px ${targetRect.top}px, ${targetRect.right}px ${targetRect.bottom}px, ${targetRect.left}px ${targetRect.bottom}px, ${targetRect.left}px 100%, 100% 100%, 100% 0%)`
            : 'none'
        }}
      />

      {/* Highlighting Frame */}
      {targetRect && (
        <div 
          className="absolute border-2 border-primary rounded-2xl transition-all duration-500 ease-out shadow-[0_0_40px_rgba(var(--primary),0.2)] animate-pulse"
          style={{
            top: targetRect.top - 8,
            left: targetRect.left - 8,
            width: targetRect.width + 16,
            height: targetRect.height + 16,
          }}
        />
      )}

      {/* Tooltip Content */}
      {isReady && targetRect && (
        <div 
          className="absolute pointer-events-auto transition-all duration-700 animate-in fade-in slide-in-from-bottom-4 zoom-in-95 ease-out"
          style={{
            top: (targetRect.bottom + 20 + 220 > window.innerHeight) 
              ? Math.max(20, targetRect.top - 240)
              : targetRect.bottom + 20,
            left: Math.min(Math.max(20, targetRect.left + targetRect.width / 2 - 160), window.innerWidth - 340),
            width: 320,
          }}
        >
          <div className="bg-card/95 border border-primary/20 rounded-[2.5rem] p-8 shadow-2xl backdrop-blur-2xl relative overflow-hidden">
             {/* Progress indicator */}
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
    </div>,
    document.body
  );
};
