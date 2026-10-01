import type { Device } from '../../domain/types';

/** Atomic eligibility/reference check and removal; never removes assigned devices. */
export interface ExpiredInboxDeviceRemover {
  updatePendingState(device: Device, state: Record<string, unknown>): Promise<boolean>;
  removeIfUnreferenced(device: Device): Promise<boolean>;
}
