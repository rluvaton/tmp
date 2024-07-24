import fs from "node:fs";
import * as os from "node:os";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import zlib from "node:zlib";
import tar from "tar-stream";

export async function createTmpTgzFile(
	content: Record<string, string>,
): Promise<string> {
	const tmpFilePath = path.join(os.tmpdir(), `${crypto.randomUUID()}.tgz`);

	const pack = tar.pack(); // pack is a stream
	const gzip = zlib.createGzip();
	const outputFile = fs.createWriteStream(tmpFilePath);

	for (const [pathInFile, fileContent] of Object.entries(content)) {
		await new Promise<void>((resolve, reject) => {
			pack.entry({ name: pathInFile }, fileContent, (err) =>
				err ? reject(err) : resolve(),
			);
		});
	}

	pack.finalize();

	await pipeline(pack, gzip, outputFile);

	return tmpFilePath;
}
