import assert from "node:assert";
import { describe, it } from "node:test";
import { PromisePool } from "./promise-pool.js";

import { setTimeout as sleep } from "node:timers/promises";

interface DeferredPromise<T> {
	promise: Promise<T>;
	resolve: (value: T) => void;
	reject: (reason?: unknown) => void;
}

function createDeferredPromise<T>(): DeferredPromise<T> {
	let resolve!: (value: T) => void;
	let reject!: (reason?: unknown) => void;

	const promise = new Promise<T>((res, rej) => {
		resolve = res;
		reject = rej;
	});

	return {
		promise,
		resolve,
		reject,
	};
}

function getLargestIndex(arr: { index: number }[]): number {
	return Math.max(...arr.map((item) => item.index));
}

describe("Promise Pool", () => {
	it("should run all functions immediately when the pool is not filled yet", () => {
		const poolSize = 5;
		const promisePool = new PromisePool<void>(poolSize);
		const deferredPromises: DeferredPromise<void>[] = [];

		for (let i = 0; i < poolSize; i++) {
			promisePool.add(() => {
				const deferred = createDeferredPromise<void>();

				deferredPromises.push(deferred);

				return deferred.promise;
			});
		}

		// This means that everything has executed immediately as none resolved yet
		assert.strictEqual(deferredPromises.length, poolSize);
	});

	it("should execute all functions in the pool eventually when exceeding the pool size", async () => {
		const poolSize = 6;
		const promisePool = new PromisePool<void>(poolSize);
		const deferredPromises: (DeferredPromise<void> & { index: number })[] = [];

		const promises: Promise<void>[] = [];

		for (let i = 0; i < poolSize * 2; i++) {
			promises.push(
				promisePool
					.add(() => {
						const deferred = createDeferredPromise<void>();

						deferredPromises.push({ ...deferred, index: i });

						return deferred.promise;
					})
					.then(() => {
						const deferredPromiseIndex = deferredPromises.findIndex(
							(item) => item.index === i,
						);

						deferredPromises.splice(deferredPromiseIndex, 1);
					}),
			);
		}

		let maxLoops = poolSize * 2 + 1;

		while (deferredPromises.length && maxLoops-- > 0) {
			deferredPromises[0].resolve();
			await new Promise((resolve) => setTimeout(resolve, 0));
		}

		assert.notStrictEqual(
			maxLoops,
			0,
			"The loop should not have reached the maximum amount of loops",
		);

		await Promise.all(promises);
	});

	it("should wait for the first promise to finish before running the next function that are out of the pool (when pool size reached)", async () => {
		const poolSize = 5;
		const promisePool = new PromisePool<void>(poolSize);
		const deferredPromises: (DeferredPromise<void> & { index: number })[] = [];

		for (let i = 0; i < poolSize * 2; i++) {
			promisePool.add(() => {
				const deferred = createDeferredPromise<void>();

				deferredPromises.push({ ...deferred, index: i });

				return deferred.promise;
			});
		}

		const largestIndex = getLargestIndex(deferredPromises);

		const middleExecutingPromiseIndex = Math.floor(poolSize / 2);

		deferredPromises[middleExecutingPromiseIndex].resolve();

		await sleep(0);
		const largestPromise = deferredPromises.find(
			(item) => item.index === largestIndex + 1,
		);
		assert.ok(largestPromise, "The next promise should be added");

		// biome-ignore lint/complexity/noForEach: cleaner
		deferredPromises.forEach((deferred) => deferred.resolve());
	});

	it("should execute functions in the order of insertion", async () => {
		const poolSize = 6;
		const promisePool = new PromisePool<void>(poolSize);
		const deferredPromises: (DeferredPromise<void> & { index: number })[] = [];

		const promises: Promise<void>[] = [];

		for (let i = 0; i < poolSize * 2; i++) {
			promises.push(
				promisePool
					.add(() => {
						const deferred = createDeferredPromise<void>();

						deferredPromises.push({ ...deferred, index: i });

						return deferred.promise;
					})
					.then(() => {
						const deferredPromiseIndex = deferredPromises.findIndex(
							(item) => item.index === i,
						);

						deferredPromises.splice(deferredPromiseIndex, 1);
					}),
			);
		}

		let maxLoops = poolSize * 2 + 1;

		let maxIndex = getLargestIndex(deferredPromises) - 1;

		while (deferredPromises.length && maxLoops-- > 0) {
			const largestIndex = getLargestIndex(deferredPromises);
			if (deferredPromises.length === poolSize) {
				assert.strictEqual(
					maxIndex + 1,
					largestIndex,
					"The maximum index should be the the previous iteration largest index + 1",
				);
			}
			maxIndex++;
			const randomIndex = Math.floor(Math.random() * deferredPromises.length);
			deferredPromises[randomIndex].resolve();
			await sleep(0);
		}

		assert.notStrictEqual(
			maxLoops,
			0,
			"The loop should not have reached the maximum amount of loops",
		);

		await Promise.all(promises);
	});

	it("should not execute more than the pool size when adding all the functions added at the beginning", () => {
		const poolSize = 5;
		const promisePool = new PromisePool<void>(poolSize);
		const deferredPromises: DeferredPromise<void>[] = [];

		for (let i = 0; i < poolSize * 2; i++) {
			promisePool.add(() => {
				const deferred = createDeferredPromise<void>();

				deferredPromises.push(deferred);

				return deferred.promise;
			});
		}

		// This means that everything has executed immediately as none resolved yet
		assert.strictEqual(deferredPromises.length, poolSize);
	});

	it("should return the function result when adding when pool is not filled", async () => {
		const poolSize = 5;
		const promisePool = new PromisePool<number>(poolSize);
		const deferredPromises: DeferredPromise<number>[] = [];
		const promises: Promise<number>[] = [];

		for (let i = 0; i < poolSize; i++) {
			promises.push(
				promisePool.add(() => {
					const deferred = createDeferredPromise<number>();

					deferredPromises.push(deferred);

					return deferred.promise;
				}),
			);
		}

		// This means that everything has executed immediately as none resolved yet
		assert.strictEqual(deferredPromises.length, poolSize);

		deferredPromises.forEach((deferred, i) => {
			deferred.resolve(i);
		});

		const results = await Promise.all(promises);
		assert.deepStrictEqual(results, [0, 1, 2, 3, 4]);
	});

	it("should return the function result when adding when pool is already full", async () => {
		const poolSize = 6;
		const promisePool = new PromisePool<number>(poolSize);
		const deferredPromises: (DeferredPromise<number> & { index: number })[] =
			[];
		const promises: Promise<number>[] = [];

		const pendingSize = poolSize * 2;

		for (let i = 0; i < pendingSize; i++) {
			const deferred = createDeferredPromise<number>();

			deferredPromises.push({ ...deferred, index: i });
		}

		for (let i = 0; i < pendingSize; i++) {
			promises.push(promisePool.add(() => deferredPromises[i].promise));
		}

		// biome-ignore lint/complexity/noForEach: cleaner
		deferredPromises.forEach((deferred) => deferred.resolve(deferred.index));

		const results = await Promise.all(promises);
		assert.deepStrictEqual(
			results,
			Array.from({ length: pendingSize }, (_, i) => i),
		);
	});
});
