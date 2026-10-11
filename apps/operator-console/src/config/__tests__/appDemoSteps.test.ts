import { getAppDemoSteps } from '../appDemoSteps';

describe('Feature: guía de demostración de la consola', () => {
  it('Scenario: Given una sesión autenticada When inicia la guía Then cada paso referencia una vista y selector estables', () => {
    const steps = getAppDemoSteps(true);
    expect(steps).toHaveLength(5);
    expect(steps.map((step) => step.id)).toEqual([
      'dashboard-nav', 'routines', 'conversation', 'automations', 'resilience',
    ]);
    steps.forEach((step) => {
      expect(step.target).toMatch(/^\[data-demo=/);
      expect(step.view).toBeTruthy();
    });
  });

  it('Scenario: Given una instalación sin "Conversar con mi casa" When inicia la guía Then omite el paso de conversación', () => {
    const steps = getAppDemoSteps(false);
    expect(steps.map((step) => step.id)).toEqual(['dashboard-nav', 'routines', 'automations', 'resilience']);
  });
});
