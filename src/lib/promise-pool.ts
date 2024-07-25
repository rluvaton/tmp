import assert from "node:assert";

type PoolFunction<R> = () => Promise<R>;

const kId = Symbol("id");

function* generateId() {
  let i = 0;

  while (true) {
    yield i++;
  }
}

const idGenerator = generateId();

interface PromiseWithId<T> extends Promise<T> {
  [kId]?: number;
}

export class PromisePool<R> {
  private pool: PromiseWithId<R>[] = [];
  private readonly poolSize: number;
  private readonly signal: AbortSignal | undefined;
  private pending = 0;

  constructor(options: {
    concurrency: number;
    signal?: AbortSignal;
  }) {
    this.poolSize = options.concurrency;
    this.signal = options.signal;
  }

  async add(fn: PoolFunction<R>): Promise<R | undefined> {
    if (this.signal?.aborted) {
      throw this.signal.reason || new Error("Cant add while aborted");
    }
    // biome-ignore lint/style/noNonNullAssertion: the idGenerator is infinite
    const id = idGenerator.next().value!;

    this.pending++;

    return this.runFunction(fn, id);
  }

  private async runFunction(
    fn: PoolFunction<R>,
    id: number,
  ): Promise<R | undefined> {
    if (this.signal?.aborted) {
      return;
    }

    if (this.pool.length >= this.poolSize) {
      return Promise.race(this.pool).then(() => this.runFunction(fn, id));
    }
    let removedAlready = false;

    const originalPromise = fn();

    const promise: PromiseWithId<R> = originalPromise.finally(() => {
      const index = this.pool.findIndex((p) => p[kId] === id);

      if (index !== -1) {
        removedAlready = true;
        this.pool.splice(index, 1);
      }

      this.pending--;
    });

    promise[kId] = id;

    if (!removedAlready) {
      this.pool.push(promise);
    }

    assert.ok(
      this.pool.length <= this.poolSize,
      `The amount of promises that are currently running (${this.pool.length}) should not exceed the pool size (${this.poolSize})`,
    );

    return await originalPromise;
  }

  async waitAll() {
    await Promise.all(this.pool);
  }

  isEmpty() {
    return this.signal?.aborted || this.pool.length === 0;
  }

  getNumberOfPendingPromises() {
    return this.pending;
  }
}
