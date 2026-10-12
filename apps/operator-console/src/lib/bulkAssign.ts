export interface BulkAssignOutcome {
  assigned: number;
  failed: number;
  skipped: number;
}

/**
 * Assigns devices one at a time so a slow or failing device never blocks the rest. Devices that cannot be
 * assigned right now (for example offline ones) are skipped, not counted as failures.
 */
export async function assignDevicesInOrder<T>(
  devices: readonly T[],
  canAssign: (device: T) => boolean,
  assign: (device: T) => Promise<boolean>,
): Promise<BulkAssignOutcome> {
  const outcome: BulkAssignOutcome = { assigned: 0, failed: 0, skipped: 0 };
  for (const device of devices) {
    if (!canAssign(device)) {
      outcome.skipped += 1;
      continue;
    }
    try {
      if (await assign(device)) outcome.assigned += 1;
      else outcome.failed += 1;
    } catch {
      outcome.failed += 1;
    }
  }
  return outcome;
}
