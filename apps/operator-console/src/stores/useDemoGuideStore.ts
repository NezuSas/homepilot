import { create } from 'zustand';
import type { View } from '../types';

export interface DemoStep {
  id: string;
  target: string; // CSS Selector
  titleKey: string; 
  descriptionKey: string;
  view?: View; // Target view name if navigation is required
}

interface DemoGuideState {
  isActive: boolean;
  currentStepIndex: number;
  steps: DemoStep[];
  startDemo: (steps: DemoStep[]) => void;
  nextStep: () => void;
  endDemo: () => void;
  setCurrentStepIndex: (index: number) => void;
}

export const useDemoGuideStore = create<DemoGuideState>((set) => ({
  isActive: false,
  currentStepIndex: 0,
  steps: [],
  
  startDemo: (steps) => set({ 
    isActive: true, 
    currentStepIndex: 0, 
    steps 
  }),

  nextStep: () => set((state) => {
    const nextIndex = state.currentStepIndex + 1;
    if (nextIndex >= state.steps.length) {
      return { isActive: false, currentStepIndex: 0 };
    }
    return { currentStepIndex: nextIndex };
  }),

  endDemo: () => set({ 
    isActive: false, 
    currentStepIndex: 0, 
    steps: [] 
  }),

  setCurrentStepIndex: (index) => set({ currentStepIndex: index }),
}));
