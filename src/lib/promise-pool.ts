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
	private pending = 0;

	constructor(size: number) {
		this.poolSize = size;
	}

	async add(fn: PoolFunction<R>): Promise<R> {
		// biome-ignore lint/style/noNonNullAssertion: the idGenerator is infinite
		const id = idGenerator.next().value!;

		this.pending++;

		return this.runFunction(fn, id);
	}

	private async runFunction(fn: PoolFunction<R>, id: number): Promise<R> {
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
		return this.pool.length === 0;
	}

	getNumberOfPendingPromises() {
		return this.pending;
	}
}
