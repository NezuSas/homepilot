import { FindingScorer } from '../application/FindingScorer';
import { FindingType } from '../domain/AssistantFinding';

describe('FindingScorer', () => {
  it.each([
    ['new_device_available', 'high', 150],
    ['energy_waste_detected', 'medium', 90],
    ['habit_pattern_detected', 'low', 59],
    ['device_missing_room', 'medium', 80],
    ['proactive_automation_opportunity', 'medium', 75],
    ['automation_suggestion', 'medium', 70],
    ['scene_suggestion', 'medium', 60],
    ['device_name_duplicate', 'medium', 50],
    ['device_name_technical', 'medium', 40],
    ['optimization_opportunity', 'medium', 30],
    ['optimization_suggestion', 'medium', 30],
  ] as const)('scores %s with %s severity deterministically', (type, severity, expectedScore) => {
    expect(FindingScorer.calculateScore(type, severity).score).toBe(expectedScore);
  });

  it('uses the fallback score for a forward-compatible finding type', () => {
    expect(FindingScorer.calculateScore('future_type' as FindingType, 'medium').score).toBe(20);
  });

  it('adds the duplicate-name boost only when more than two devices collide', () => {
    expect(FindingScorer.calculateScore('device_name_duplicate', 'medium', { count: 2 }).score).toBe(50);
    expect(FindingScorer.calculateScore('device_name_duplicate', 'medium', { count: 3 }).score).toBe(65);
  });

  it.each(['automation_suggestion', 'scene_suggestion'] as const)('adds the entity-density boost for %s', (type) => {
    expect(FindingScorer.calculateScore(type, 'medium', { sensorCount: 2, lightCount: 1, coverCount: 1 }).score).toBe(
      type === 'automation_suggestion' ? 80 : 70,
    );
  });

  it('applies learned modifiers and exposes their explanation only when non-zero', () => {
    const learning = {
      typeModifiers: { device_name_technical: 12, scene_suggestion: 0 },
      explanations: { device_name_technical: 'Frequently accepted by the household.' },
    };

    expect(FindingScorer.calculateScore('device_name_technical', 'medium', {}, learning)).toEqual({
      score: 52,
      explanation: 'Frequently accepted by the household.',
    });
    expect(FindingScorer.calculateScore('scene_suggestion', 'medium', {}, learning)).toEqual({ score: 60, explanation: undefined });
  });
});