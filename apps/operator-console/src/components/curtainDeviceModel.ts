export interface CurtainDeviceState {
  state?: 'open' | 'closed' | 'opening' | 'closing' | 'unknown' | 'unavailable';
  current_position?: unknown;
  position?: unknown;
  attributes?: Record<string, unknown>;
  [key: string]: unknown;
}

export const parseCoverPosition = (value: unknown): number | undefined => {
  if (value === null || value === undefined || value === '') return undefined;
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed)) return undefined;
  return Math.min(100, Math.max(0, parsed));
};

export const getCoverClassKey = (attributes?: Record<string, unknown>): string => {
  const value = attributes?.device_class;
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : 'generic';
};

const INVERTED_STATES: Record<string, string> = {
  open: 'closed',
  closed: 'open',
  opening: 'closing',
  closing: 'opening',
};

export const getFunctionalCoverState = (state: string, invertState: boolean | undefined): string => {
  if (!invertState) return state;
  return INVERTED_STATES[state] || state;
};

export interface CurtainView {
  state: string;
  position: number | undefined;
  rawTiltPosition: number | undefined;
  coverClassKey: string;
  isOpening: boolean;
  isClosing: boolean;
  isMoving: boolean;
  isOpen: boolean;
  displayState: string;
  visualPosition: number;
}

interface CurtainViewInput {
  lastState: CurtainDeviceState;
  invertState: boolean | undefined;
  unavailable: boolean;
  optimisticState: string | null;
}

/** Derives the displayed cover state and position from the last known device state. */
export function deriveCurtainView({ lastState, invertState, unavailable, optimisticState }: CurtainViewInput): CurtainView {
  const rawState = lastState.state || 'unknown';
  const state = optimisticState || getFunctionalCoverState(rawState, invertState);
  const rawPosition = parseCoverPosition(lastState.current_position)
    ?? parseCoverPosition(lastState.position)
    ?? parseCoverPosition(lastState.attributes?.current_position)
    ?? parseCoverPosition(lastState.attributes?.position);
  const rawTiltPosition = parseCoverPosition(lastState.attributes?.current_tilt_position);
  const position = rawPosition !== undefined && invertState ? 100 - rawPosition : rawPosition;

  const isOpening = state === 'opening';
  const isClosing = state === 'closing';
  const isMoving = isOpening || isClosing;
  const isOpen = !unavailable && (position !== undefined ? position > 0 : state === 'open');
  const displayState = unavailable
    ? 'unavailable'
    : isMoving
    ? state
    : position !== undefined
      ? (position > 0 ? 'open' : 'closed')
      : state;
  const visualPosition = position ?? (displayState === 'open' ? 100 : 0);

  return {
    state,
    position,
    rawTiltPosition,
    coverClassKey: getCoverClassKey(lastState.attributes),
    isOpening,
    isClosing,
    isMoving,
    isOpen,
    displayState,
    visualPosition,
  };
}
