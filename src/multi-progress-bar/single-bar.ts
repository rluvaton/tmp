import { EventEmitter } from "node:events";
import type tty from "node:tty";
import {
  AVAILABLE_PROGRESS_BAR_VARIABLES,
  type AvailableProgressBarTemplateVariables,
  kPercent,
  kProgressBar,
  kTotal,
  kValue,
} from "./predefined-variables.js";
import { buildStringProgressBar } from "./progress-bar-variable-impl.js";
import { getNumberOfColumns } from "./tty-stream-helpers.js";

// Variables should be symbols
type Template = (
  | string
  | symbol
  | false
  | { key: string }
  | AvailableProgressBarTemplateVariables
)[];

// biome-ignore lint/suspicious/noExplicitAny: anything
export type Formatter = (value: any) => string;

export type CreateTemplate<Payload = object> = (payload: Payload) => Template;

export interface SingleProgressBarOptions<Payload = object> {
  output?: tty.WriteStream;
  template: Template | CreateTemplate<Payload>;
  value: number;
  total: number;
  payload?: Payload;
  formatters?: Record<symbol, Formatter>;
}

// TODO - CHANGE THIS

// Maybe avoid printing a single progress bar and instead print everything each time
export class SingleProgressBar<Payload = object> extends EventEmitter<{
  progress: [progressContent: string];
  complete: [];
  error: [Error];
  remove: [];
}> {
  #output: tty.WriteStream;
  #currentLineContent = "";
  #template: Template | CreateTemplate<Payload>;
  #payload: Payload;
  #value: number;
  #total: number;
  #formatters: Record<symbol | string, Formatter> = {
    // Keep integer
    [kPercent]: (value: number) => `${Math.floor(value)}%`,
  };

  constructor(options: SingleProgressBarOptions<Payload>) {
    super();
    this.#output = options.output || process.stdout;
    this.#template = options.template;
    this.#value = options.value;
    this.#total = options.total;
    this.#payload = options.payload || ({} as Payload);
    this.#formatters = Object.assign(
      this.#formatters,
      options.formatters || {},
    );
  }

  increment(step = 1) {
    this.#value += step;
    this.triggerUpdate();
  }

  decrement(step = 1) {
    this.#value -= step;
    this.triggerUpdate();
  }

  update(newPayload: Payload) {
    this.#payload = newPayload;
    this.triggerUpdate();
  }

  getPayload() {
    return this.#payload;
  }

  getTotal() {
    return this.#total;
  }

  setTotal(total: number) {
    this.#total = total;
    this.triggerUpdate();
  }

  setValue(value: number) {
    this.#value = value;
    this.triggerUpdate();
  }

  getCurrent() {
    return this.#value;
  }

  stop() {
    this.emit("remove");
  }

  remove() {
    this.emit("remove");
  }

  get line(): string {
    return this.#currentLineContent;
  }

  #getTemplate() {
    if (typeof this.#template === "function") {
      return this.#template(this.#payload);
    }

    return this.#template;
  }

  #updateLine() {
    this.#currentLineContent = this.#getTemplate()
      .map((item) => {
        if (item === false) {
          return "";
        }

        if (typeof item === "string") {
          return item;
        }

        if (
          AVAILABLE_PROGRESS_BAR_VARIABLES.includes(
            item as AvailableProgressBarTemplateVariables,
          )
        ) {
          return this.#getSpecialVariable(
            item as AvailableProgressBarTemplateVariables,
          );
        }

        if (!this.#payload) {
          return "";
        }

        if (typeof item === "object") {
          return this.#runFormatter(item.key, this.#payload[item.key]);
        }

        return this.#runFormatter(item, this.#payload[item]);
      })
      .join("");
  }

  #getSpecialVariable(variable: AvailableProgressBarTemplateVariables): string {
    switch (variable) {
      case kProgressBar:
        return buildStringProgressBar({
          width: Math.min(getNumberOfColumns(this.#output), 40),
          currentProgress: (this.#value / this.#total) * 100,
        });

      case kPercent:
        return this.#runFormatter(kPercent, (this.#value / this.#total) * 100);

      case kValue:
        return this.#runFormatter(kValue, this.#value);

      case kTotal:
        return this.#runFormatter(kValue, this.#total);

      default:
        throw new Error(`Unknown variable ${(variable as symbol).toString()}`);
    }
  }

  triggerUpdate() {
    // TODO - should merge
    this.#updateLine();

    this.emit("progress", this.#currentLineContent);
  }

  #runFormatter(key: string | symbol, value: unknown): string {
    if (this.#formatters[key]) {
      return this.#formatters[key](value);
    }

    if (value === undefined) {
      return key.toString();
    }

    // biome-ignore lint/suspicious/noExplicitAny:
    return (value as any).toString();
  }
}
