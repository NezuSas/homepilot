import { isKeyboardDropTarget } from './canvasCollision';

describe('Feature: dashboard canvas keyboard drop targets', () => {
  it('lets cards visit other cards and empty sections only', () => {
    expect(isKeyboardDropTarget('section-card', false, 'x', { kind: 'section-card' })).toBe(true);
    expect(isKeyboardDropTarget('section-card', false, 'x', { kind: 'section', cardCount: 0 })).toBe(true);
    expect(isKeyboardDropTarget('section-card', false, 'x', { kind: 'section', cardCount: 2 })).toBe(false);
    expect(isKeyboardDropTarget('section-card', false, 'x', undefined)).toBe(false);
  });

  it('restricts slot-based section drags to slot droppables', () => {
    expect(isKeyboardDropTarget('section', true, 'section-slot-2', { kind: 'slot' })).toBe(true);
    expect(isKeyboardDropTarget('section', true, 'some-section', { kind: 'section' })).toBe(false);
  });

  it('keeps every non-card target for flow reordering', () => {
    expect(isKeyboardDropTarget('section', false, 'some-section', { kind: 'section' })).toBe(true);
    expect(isKeyboardDropTarget('widget', false, 'w', { kind: 'widget' })).toBe(true);
    expect(isKeyboardDropTarget('widget', false, 'c', { kind: 'section-card' })).toBe(false);
  });
});
