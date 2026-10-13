import { fitScale } from './CatalogPreviewStage';

describe('Feature: catalog previews fit a fixed stage', () => {
  it('Scenario: Given a preview smaller than the stage When fitted Then it is not enlarged', () => {
    expect(fitScale(300, 160, 96, 96)).toBe(1);
  });

  it('Scenario: Given a preview taller than the stage When fitted Then it shrinks to the height', () => {
    expect(fitScale(300, 160, 300, 320)).toBeCloseTo(0.5);
  });

  it('Scenario: Given a preview wider than the stage When fitted Then it shrinks to the width', () => {
    expect(fitScale(150, 160, 300, 100)).toBeCloseTo(0.5);
  });

  it('Scenario: Given a preview that overflows both ways When fitted Then the tighter limit wins', () => {
    expect(fitScale(200, 100, 400, 400)).toBeCloseTo(0.25);
  });

  it.each([[0, 160, 100, 100], [300, 0, 100, 100], [300, 160, 0, 100], [300, 160, 100, 0]])(
    'Scenario: Given an unmeasured size %p When fitted Then the preview is left as it is', (...sizes) => {
      expect(fitScale(sizes[0], sizes[1], sizes[2], sizes[3])).toBe(1);
    });
});
