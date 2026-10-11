import type { GlobalWakeStatus } from './GlobalWakeNotice';
import { useGlobalWakeListener } from './useGlobalWakeListener';

interface GlobalWakeListenerProps {
  enabled: boolean;
  onCommand: (command: string) => void;
  onWakeInterrupt?: () => void;
  onStatusChange?: (status: GlobalWakeStatus) => void;
}

/**
 * Headless wake-word listener: wake and command transcripts feed the same flow,
 * whether or not the assistant is currently processing or speaking.
 */
export function GlobalWakeListener({ enabled, onCommand, onWakeInterrupt, onStatusChange }: GlobalWakeListenerProps) {
  useGlobalWakeListener({ enabled, onCommand, onWakeInterrupt, onStatusChange });

  return null;
}
