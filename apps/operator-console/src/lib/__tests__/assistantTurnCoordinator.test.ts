import { AssistantTurnCoordinator } from '../assistantTurnCoordinator';

describe('AssistantTurnCoordinator', () => {
  it('keeps only the latest turn active and aborts the replaced turn', () => {
    const coordinator = new AssistantTurnCoordinator();
    const first = coordinator.begin('chat');
    const second = coordinator.begin('wake_word');

    expect(first.signal.aborted).toBe(true);
    expect(coordinator.isCurrent(first)).toBe(false);
    expect(second.signal.aborted).toBe(false);
    expect(coordinator.isCurrent(second)).toBe(true);
  });

  it('notifies listeners exactly once when a turn is replaced', () => {
    const coordinator = new AssistantTurnCoordinator();
    const invalidated: string[] = [];
    const unsubscribe = coordinator.onInvalidated(turn => invalidated.push(turn.id));
    const first = coordinator.begin('manual_voice');

    coordinator.begin('chat');
    unsubscribe();

    expect(invalidated).toEqual([first.id]);
  });

  it('cancels the active turn without invalidating a later turn', () => {
    const coordinator = new AssistantTurnCoordinator();
    const first = coordinator.begin('chat');
    coordinator.cancel(first);
    const second = coordinator.begin('manual_voice');

    expect(first.signal.aborted).toBe(true);
    expect(second.signal.aborted).toBe(false);
    expect(coordinator.isCurrent(second)).toBe(true);
  });
});