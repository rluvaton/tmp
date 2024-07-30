import type * as tty from "node:tty";

export function moveToLine(
  output: tty.WriteStream,
  lineNumber: number,
  column = 0,
) {
  output.write(`\x1b[${lineNumber};${column}H`);
}

export function clearLine(output: tty.WriteStream) {
  output.write("\x1b[K");
}

export function clearScreen(output: tty.WriteStream) {
  output.write("\x1b[2J");
}

export function getNumberOfLines(output: tty.WriteStream): number {
  return output.rows;
}

export function getNumberOfColumns(output: tty.WriteStream): number {
  return output.columns;
}
