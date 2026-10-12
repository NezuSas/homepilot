import { assignDevicesInOrder } from './bulkAssign';

describe('Feature: assigning many devices to one room without one failure stopping the rest', () => {
  const devices = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }];

  it('Scenario: Given devices that all succeed When assigned Then every one is counted and none skipped', async () => {
    const seen: string[] = [];

    const outcome = await assignDevicesInOrder(devices, () => true, async device => { seen.push(device.id); return true; });

    expect(outcome).toEqual({ assigned: 4, failed: 0, skipped: 0 });
    expect(seen).toEqual(['a', 'b', 'c', 'd']);
  });

  it('Scenario: Given devices that cannot be assigned right now When processed Then they are skipped and never sent', async () => {
    const assign = jest.fn().mockResolvedValue(true);

    const outcome = await assignDevicesInOrder(devices, device => device.id !== 'b' && device.id !== 'c', assign);

    expect(outcome).toEqual({ assigned: 2, failed: 0, skipped: 2 });
    expect(assign).toHaveBeenCalledTimes(2);
  });

  it('Scenario: Given a refused assignment When processed Then it counts as failed and the next device still runs', async () => {
    const outcome = await assignDevicesInOrder(devices, () => true, async device => device.id !== 'b');

    expect(outcome).toEqual({ assigned: 3, failed: 1, skipped: 0 });
  });

  it('Scenario: Given a request that throws When processed Then it counts as failed and does not stop the rest', async () => {
    const outcome = await assignDevicesInOrder(devices, () => true, async device => {
      if (device.id === 'a') throw new Error('network down');
      return true;
    });

    expect(outcome).toEqual({ assigned: 3, failed: 1, skipped: 0 });
  });

  it('Scenario: Given devices When processed Then they are sent one after another, never at the same time', async () => {
    let running = 0;
    let peak = 0;

    await assignDevicesInOrder(devices, () => true, async () => {
      running += 1;
      peak = Math.max(peak, running);
      await Promise.resolve();
      running -= 1;
      return true;
    });

    expect(peak).toBe(1);
  });

  it('Scenario: Given no devices When processed Then nothing happens', async () => {
    expect(await assignDevicesInOrder([], () => true, async () => true)).toEqual({ assigned: 0, failed: 0, skipped: 0 });
  });
});
