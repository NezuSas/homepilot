import { APP_DEMO_STEPS } from '../appDemoSteps';

describe('Feature: guía de demostración de la consola', () => {
  it('Scenario: Given una sesión autenticada When inicia la guía Then cada paso referencia una vista y selector estables', () => {
    expect(APP_DEMO_STEPS).toHaveLength(5);
    expect(APP_DEMO_STEPS.map((step) => step.id)).toEqual([
      'dashboard-nav', 'routines', 'conversation', 'automations', 'resilience',
    ]);
    APP_DEMO_STEPS.forEach((step) => {
      expect(step.target).toMatch(/^\[data-demo=/);
      expect(step.view).toBeTruthy();
    });
  });
});