export type AssistantTurnOrigin = 'chat' | 'manual_voice' | 'wake_word';

export interface AssistantTurn {
  id: string;
  origin: AssistantTurnOrigin;
  signal: AbortSignal;
}

interface ActiveAssistantTurn extends AssistantTurn {
  controller: AbortController;
}

export class AssistantTurnCoordinator {
  private sequence = 0;
  private activeTurn: ActiveAssistantTurn | null = null;
  private readonly invalidationListeners = new Set<(turn: AssistantTurn) => void>();

  public begin(origin: AssistantTurnOrigin): AssistantTurn {
    this.cancelActive();

    const controller = new AbortController();
    const turn: ActiveAssistantTurn = {
      id: `${origin}-${++this.sequence}`,
      origin,
      signal: controller.signal,
      controller
    };
    this.activeTurn = turn;

    return this.toPublicTurn(turn);
  }

  public cancel(turn?: AssistantTurn): void {
    if (turn && (!this.activeTurn || this.activeTurn.id !== turn.id)) return;
    this.cancelActive();
  }

  public isCurrent(turn: AssistantTurn): boolean {
    return this.activeTurn?.id === turn.id && !turn.signal.aborted;
  }

  public onInvalidated(listener: (turn: AssistantTurn) => void): () => void {
    this.invalidationListeners.add(listener);
    return () => this.invalidationListeners.delete(listener);
  }

  private cancelActive(): void {
    const activeTurn = this.activeTurn;
    if (!activeTurn) return;

    this.activeTurn = null;
    activeTurn.controller.abort();
    const turn = this.toPublicTurn(activeTurn);
    for (const listener of this.invalidationListeners) {
      listener(turn);
    }
  }

  private toPublicTurn(turn: ActiveAssistantTurn): AssistantTurn {
    return {
      id: turn.id,
      origin: turn.origin,
      signal: turn.signal
    };
  }
}