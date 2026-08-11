import type { DemoStep } from '../stores/useDemoGuideStore';

export const APP_DEMO_STEPS: DemoStep[] = [
    {
      id: 'dashboard-nav',
      target: '[data-demo="nav-dashboard"]',
      titleKey: 'demo.steps.dashboard.title',
      descriptionKey: 'demo.steps.dashboard.description',
      view: 'dashboard'
    },
    {
      id: 'routines',
      target: '[data-demo="dashboard-routines"]',
      titleKey: 'demo.steps.routines.title',
      descriptionKey: 'demo.steps.routines.description',
      view: 'dashboard'
    },
    {
      id: 'conversation',
      target: '[data-demo="nav-home-conversation"]',
      titleKey: 'demo.steps.conversation.title',
      descriptionKey: 'demo.steps.conversation.description',
      view: 'home-conversation'
    },
    {
      id: 'automations',
      target: '[data-demo="nav-routines"]',
      titleKey: 'demo.steps.automations.title',
      descriptionKey: 'demo.steps.automations.description',
      view: 'automations'
    },
    {
      id: 'resilience',
      target: '[data-demo="nav-resilience"]',
      titleKey: 'demo.steps.resilience.title',
      descriptionKey: 'demo.steps.resilience.description',
      view: 'resilience-showcase'
    }
  ];

