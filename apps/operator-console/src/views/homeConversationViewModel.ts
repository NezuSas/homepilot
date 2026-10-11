import type { ConversationActivity } from './homeConversationPresentation';

export type ActivityTone = 'danger' | 'warning' | 'primary' | 'success';

export interface ActivityStatusLabels {
  listening: string;
  transcribing: string;
  consulting: string;
  ready: string;
}

export interface AudioInputDeviceLike {
  deviceId: string;
  label: string;
}

/** Resolves the composer status chip from the conversation activity. */
export function resolveActivityStatus(
  activity: ConversationActivity,
  speechNotice: string,
  labels: ActivityStatusLabels
): { label: string; tone: ActivityTone } {
  if (activity === 'listening') return { label: labels.listening, tone: 'danger' };
  if (activity === 'transcribing') return { label: labels.transcribing, tone: 'warning' };
  if (activity === 'consulting') return { label: labels.consulting, tone: 'primary' };
  if (activity === 'notice' && speechNotice) return { label: speechNotice, tone: 'warning' };
  return { label: labels.ready, tone: 'success' };
}

/** Maps browser audio inputs to picker options, numbering unlabeled devices. */
export function buildAudioInputOptions(
  devices: readonly AudioInputDeviceLike[],
  getFallbackLabel: (position: number) => string
): Array<{ id: string; label: string }> {
  return devices.map((device, index) => ({
    id: device.deviceId,
    label: device.label || getFallbackLabel(index + 1)
  }));
}
