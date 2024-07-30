import type { Formatter } from "./single-bar.js";

export function createNumberFormatter({
  maxFractionDigits,
}: { maxFractionDigits: number }): Formatter {
  return (value) => {
    // noinspection SuspiciousTypeOfGuard
    if (typeof value === "number") {
      return value % 1 === 0
        ? value.toString()
        : value.toFixed(maxFractionDigits);
    }
    return value;
  };
}
