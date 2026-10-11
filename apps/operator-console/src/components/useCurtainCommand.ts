import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { canExecuteCommand } from '../lib/deviceCapabilities';
import type { SnapshotDevice as Device } from '../stores/useDeviceSnapshotStore';

interface Options {
  device: Device;
  unavailable: boolean;
  displayName: string;
  onUpdate?: (updated: Device) => void;
  onCommand?: (deviceId: string, command: string, params?: Record<string, unknown>) => Promise<Device | null>;
  onActionExecute?: (label: string) => void;
}

/** Command execution for a cover tile, with the optimistic moving state. */
export function useCurtainCommand({ device, unavailable, displayName, onUpdate, onCommand, onActionExecute }: Options) {
  const { t } = useTranslation();
  const [isProcessing, setIsProcessing] = useState<string | null>(null);
  const [optimisticState, setOptimisticState] = useState<string | null>(null);

  const handleCommand = async (command: string, params?: Record<string, unknown>) => {
    if (isProcessing || unavailable || !onCommand) return;

    if (!canExecuteCommand(device, command)) {
      console.warn(`[UI] Command ${command} not allowed for device ${device.id}`);
      return;
    }

    if (command === 'open') setOptimisticState('opening');
    else if (command === 'close') setOptimisticState('closing');

    setIsProcessing(command);
    try {
      const updated = await onCommand(device.id, command, params);

      if (updated) {
        setOptimisticState(null);
        if (onUpdate) onUpdate(updated);
        if (onActionExecute) onActionExecute(t('common.feedback.action_success', {
          name: displayName,
          action: t(`common.actions.${command}`)
        }));
      } else {
        setOptimisticState(null);
      }
    } catch (error) {
      console.error('Failed to execute cover command:', error);
      setOptimisticState(null);
    } finally {
      setIsProcessing(null);
    }
  };

  return { isProcessing, optimisticState, handleCommand };
}
