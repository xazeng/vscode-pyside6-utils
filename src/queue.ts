interface Entry<T> {
  value: T;
  timer?: ReturnType<typeof setTimeout>;
  running: boolean;
  pending: boolean;
}

/** 合并保存事件；同一文件串行执行，执行中发生的新修改仍会再次生成。 */
export class GenerationQueue<T> {
  private readonly entries = new Map<string, Entry<T>>();
  private disposed = false;

  constructor(
    private readonly run: (value: T) => Promise<void>,
    private readonly report: (error: unknown) => void,
    private readonly delay = 300,
  ) {}

  schedule(key: string, value: T): void {
    if (this.disposed) { return; }
    let entry = this.entries.get(key);
    if (!entry) {
      entry = { value, running: false, pending: false };
      this.entries.set(key, entry);
    }
    entry.value = value;
    entry.pending = true;
    if (entry.timer) { clearTimeout(entry.timer); }
    entry.timer = setTimeout(() => {
      entry!.timer = undefined;
      if (!entry!.running) { void this.flush(key, entry!); }
    }, this.delay);
  }

  cancel(key: string): void {
    const entry = this.entries.get(key);
    if (!entry) { return; }
    if (entry.timer) { clearTimeout(entry.timer); entry.timer = undefined; }
    entry.pending = false;
    if (!entry.running) { this.entries.delete(key); }
  }

  private async flush(key: string, entry: Entry<T>): Promise<void> {
    entry.running = true;
    entry.pending = false;
    try { await this.run(entry.value); }
    catch (error) { this.report(error); }
    finally {
      entry.running = false;
      if (!this.disposed && entry.pending) {
        if (!entry.timer) { void this.flush(key, entry); }
      } else {
        this.entries.delete(key);
      }
    }
  }

  dispose(): void {
    this.disposed = true;
    for (const entry of this.entries.values()) {
      if (entry.timer) { clearTimeout(entry.timer); }
    }
    this.entries.clear();
  }
}
