import { Writable } from "node:stream";

export class InMemoryWritable extends Writable {
	internalData: Buffer[] = [];

	override _write(
		chunk: Buffer,
		encoding: BufferEncoding,
		callback: (error?: Error | null) => void,
	) {
		this.internalData.push(chunk);
		callback();
	}
}

export class SinkStream extends Writable {
	override _write(
		chunk: Buffer,
		encoding: BufferEncoding,
		callback: (error?: Error | null) => void,
	) {
		callback();
	}
}
