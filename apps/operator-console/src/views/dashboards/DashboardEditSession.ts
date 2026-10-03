/** A local editing session. Only one write is in flight; failed dependent
 * edits are discarded together instead of overwriting the last saved state. */
export class DashboardEditSession<T> {
  private confirmed: T;
  private draft: T;
  private history: T[];
  private index = 0;
  private running = false;
  private queue: { value: T; resolve: (saved: boolean) => void }[] = [];
  private idleListeners: (() => void)[] = [];
  private readonly save: (value: T) => Promise<T>;
  private readonly changed: (value: T, session: DashboardEditSession<T>) => void;
  private readonly failed: (error: unknown) => void;

  constructor(
    initial: T,
    save: (value: T) => Promise<T>,
    changed: (value: T, session: DashboardEditSession<T>) => void,
    failed: (error: unknown) => void,
  ) {
    this.save = save;
    this.changed = changed;
    this.failed = failed;
    this.confirmed = initial;
    this.draft = initial;
    this.history = [initial];
  }

  get value(): T { return this.draft; }
  get pending(): boolean { return this.running || this.queue.length > 0; }
  get canUndo(): boolean { return this.index > 0; }
  get canRedo(): boolean { return this.index < this.history.length - 1; }

  edit(update: (current: T) => T): Promise<boolean> {
    const next = update(this.draft);
    if (next === this.draft) return Promise.resolve(true);
    this.history = [...this.history.slice(0, this.index + 1), next];
    this.index += 1;
    return this.enqueue(next);
  }

  undo(): Promise<boolean> {
    if (!this.canUndo) return Promise.resolve(false);
    return this.enqueue(this.history[--this.index]);
  }

  redo(): Promise<boolean> {
    if (!this.canRedo) return Promise.resolve(false);
    return this.enqueue(this.history[++this.index]);
  }

  whenIdle(): Promise<void> {
    return this.pending ? new Promise(resolve => this.idleListeners.push(resolve)) : Promise.resolve();
  }

  private enqueue(value: T): Promise<boolean> {
    this.draft = value;
    const result = new Promise<boolean>(resolve => this.queue.push({ value, resolve }));
    this.changed(this.draft, this);
    void this.drain();
    return result;
  }

  private async drain(): Promise<void> {
    if (this.running) return;
    this.running = true;
    while (this.queue.length > 0) {
      const next = this.queue.shift()!;
      try {
        this.confirmed = await this.save(next.value);
        if (this.queue.length === 0) {
          this.draft = this.confirmed;
          this.history[this.index] = this.confirmed;
        }
        next.resolve(true);
      } catch (error: unknown) {
        this.draft = this.confirmed;
        this.history = [this.confirmed];
        this.index = 0;
        next.resolve(false);
        this.queue.splice(0).forEach(item => item.resolve(false));
        this.failed(error);
      }
      this.changed(this.draft, this);
    }
    this.running = false;
    this.changed(this.draft, this);
    this.idleListeners.splice(0).forEach(resolve => resolve());
  }
}
