const contentLengthHeader = Buffer.from("Content-Length");

export function getContentSizeFromHeaders(
  headers: Buffer[],
): number | undefined {
  const contentLengthHeaderIndex = headers.findIndex((header) =>
    header.equals(contentLengthHeader),
  );

  if (contentLengthHeaderIndex === -1) {
    return undefined;
  }

  const contentLengthHeaderValue =
    headers[contentLengthHeaderIndex + 1].toString();

  return Number.parseInt(contentLengthHeaderValue, 10);
}
