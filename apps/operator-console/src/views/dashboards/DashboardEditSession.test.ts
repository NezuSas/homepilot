import { DashboardEditSession } from './DashboardEditSession';
import { moveSectionCard } from './sectionCardDrag';
import type { DashboardWidget } from './types';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

describe('Feature: Dashboard editing persistence (AC49)', () => {
  it('Scenario: Undo restores the exact cross-section order and metadata, then redo reapplies it', async () => {
    const section = (id: string, cards: Record<string, unknown>[]): DashboardWidget => ({ id, type: 'section', config: {
      binding: { entityId: id, entityType: 'system' }, appearance: {}, visibility: { rules: [], defaultState: 'show' },
      layout: { x: 0, y: 0, w: 1, h: 4 }, extra: { cards },
    } });
    const initial = [section('a', [{ id: 'sensor', kind: 'sensor', entityId: 'device', gridOptions: { columns: 5, rows: 6 } }]), section('b', [{ id: 'other', kind: 'light' }])];
    const save = jest.fn(async (value: DashboardWidget[]) => structuredClone(value));
    const session = new DashboardEditSession(initial, save, jest.fn(), jest.fn());
    await session.edit(value => moveSectionCard(value, 'a', 'sensor', 'b', 'other'));
    const moved = structuredClone(session.value);
    await session.undo();
    expect(session.value).toEqual(initial);
    await session.redo();
    expect(session.value).toEqual(moved);
    expect(save).toHaveBeenCalledTimes(3);
  });
  it('Scenario: Serial saves retain optimistic edits and use the latest state', async () => {
    const first = deferred<number>();
    const save = jest.fn().mockImplementationOnce(() => first.promise).mockImplementation(async value => value);
    const session = new DashboardEditSession<number>(0, save, jest.fn(), jest.fn());
    const a = session.edit(value => value + 1);
    const b = session.edit(value => value + 2);
    expect(session.value).toBe(3);
    expect(save.mock.calls).toEqual([[1]]);
    first.resolve(1);
    expect(await a).toBe(true);
    expect(await b).toBe(true);
    await session.whenIdle();
    expect(save.mock.calls).toEqual([[1], [3]]);
    expect(session.value).toBe(3);
    expect(session.pending).toBe(false);
  });

  it('Scenario: A rejected save restores confirmed state and cancels dependent writes', async () => {
    const request = deferred<number>();
    const save = jest.fn(() => request.promise);
    const failed = jest.fn();
    const session = new DashboardEditSession(5, save, jest.fn(), failed);
    const a = session.edit(value => value + 1);
    const b = session.edit(value => value + 1);
    request.reject(new Error('offline'));
    expect(await a).toBe(false);
    expect(await b).toBe(false);
    await session.whenIdle();
    expect(session.value).toBe(5);
    expect(session.canUndo).toBe(false);
    expect(save).toHaveBeenCalledTimes(1);
    expect(failed).toHaveBeenCalledTimes(1);
  });

  it('Scenario: Undo and redo are persisted and a new edit removes the redo branch', async () => {
    const save = jest.fn(async (value: number) => value);
    const session = new DashboardEditSession(0, save, jest.fn(), jest.fn());
    await session.edit(() => 1);
    await session.edit(() => 2);
    await session.undo();
    expect(session.value).toBe(1);
    await session.redo();
    expect(session.value).toBe(2);
    await session.undo();
    await session.edit(() => 3);
    expect(session.canRedo).toBe(false);
    expect(save.mock.calls).toEqual([[1], [2], [1], [2], [1], [3]]);
  });
});
