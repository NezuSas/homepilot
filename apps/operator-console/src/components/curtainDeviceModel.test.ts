import { deriveCurtainView, getCoverClassKey, getFunctionalCoverState, parseCoverPosition } from './curtainDeviceModel';

describe('curtainDeviceModel', () => {
  it('parses and clamps cover positions', () => {
    expect(parseCoverPosition(undefined)).toBeUndefined();
    expect(parseCoverPosition('')).toBeUndefined();
    expect(parseCoverPosition('abc')).toBeUndefined();
    expect(parseCoverPosition('42')).toBe(42);
    expect(parseCoverPosition(150)).toBe(100);
    expect(parseCoverPosition(-5)).toBe(0);
  });

  it('resolves the cover class key with a generic fallback', () => {
    expect(getCoverClassKey()).toBe('generic');
    expect(getCoverClassKey({ device_class: '  blind ' })).toBe('blind');
    expect(getCoverClassKey({ device_class: '   ' })).toBe('generic');
  });

  it('inverts functional states only when requested', () => {
    expect(getFunctionalCoverState('open', false)).toBe('open');
    expect(getFunctionalCoverState('open', true)).toBe('closed');
    expect(getFunctionalCoverState('opening', true)).toBe('closing');
    expect(getFunctionalCoverState('unknown', true)).toBe('unknown');
  });

  it('derives an open view from the reported position', () => {
    const view = deriveCurtainView({
      lastState: { state: 'closed', current_position: 60, attributes: { current_tilt_position: 20 } },
      invertState: false,
      unavailable: false,
      optimisticState: null,
    });
    expect(view.isOpen).toBe(true);
    expect(view.displayState).toBe('open');
    expect(view.visualPosition).toBe(60);
    expect(view.rawTiltPosition).toBe(20);
  });

  it('inverts the position and prefers the optimistic state while moving', () => {
    const view = deriveCurtainView({
      lastState: { state: 'open', position: 30 },
      invertState: true,
      unavailable: false,
      optimisticState: 'opening',
    });
    expect(view.position).toBe(70);
    expect(view.isMoving).toBe(true);
    expect(view.isOpening).toBe(true);
    expect(view.displayState).toBe('opening');
  });

  it('reports unavailable devices as closed visuals', () => {
    const view = deriveCurtainView({
      lastState: { state: 'open' },
      invertState: false,
      unavailable: true,
      optimisticState: null,
    });
    expect(view.isOpen).toBe(false);
    expect(view.displayState).toBe('unavailable');
    expect(view.visualPosition).toBe(0);
  });
});
