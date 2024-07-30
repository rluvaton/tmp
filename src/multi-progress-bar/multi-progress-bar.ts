import type tty from "node:tty";
import {
  SingleProgressBar,
  type SingleProgressBarOptions,
} from "./single-bar.js";
import { clearScreen, moveToLine } from "./tty-stream-helpers.js";

interface Options {
  output?: tty.WriteStream;
}

export class MultiProgressBar {
  #output: tty.WriteStream;
  // biome-ignore lint/suspicious/noExplicitAny: the payload does not matter
  #progressBars: SingleProgressBar<any>[] = [];
  #abortController = new AbortController();

  constructor(options: Options = {}) {
    this.#output = options.output || process.stdout;
  }

  start() {
    if (this.#abortController.signal.aborted) {
      throw new Error("cant start a finished progress bar");
    }
  }

  add<Payload = object>(
    options: Omit<SingleProgressBarOptions<Payload>, "output">,
  ): SingleProgressBar<Payload> {
    // add listeners
    const bar = new SingleProgressBar<Payload>({
      output: this.#output,
      ...options,
    });

    bar.addListener("progress", this.#render);
    bar.addListener("remove", this.remove.bind(this, bar));
    this.#progressBars.push(bar);

    return bar;
  }

  // biome-ignore lint/suspicious/noExplicitAny: the payload does not matter
  remove(bar: SingleProgressBar<any>): void {
    const index = this.#progressBars.indexOf(bar);

    if (index === -1) {
      return;
    }

    this.#progressBars.splice(index, 1);

    this.#render();
  }

  stop() {
    this.#abortController.abort(new Error("Progress bar stopped"));
  }

  #render = () => {
    // Clear screen and update again
    moveToLine(this.#output, 0);
    clearScreen(this.#output);

    const outputText = this.#progressBars.map((bar) => bar.line).join("\n");

    this.#output.write(outputText);
  };
}
