const BAR_COMPLETE_CHAR = "\u2588";
const BAR_INCOMPLETE_CHAR = "\u2591";

export function buildStringProgressBar({
  width,
  currentProgress,
}: {
  // The width of the progress bar
  width: number;

  // Between 0-100
  currentProgress: number;
}): string {
  const completeSize = clapToRange({
    min: 0,
    max: width,
    value: Math.round((currentProgress / 100) * width),
  });
  const incompleteSize = clapToRange({
    min: 0,
    max: width,
    value: width - completeSize,
  });

  // generate bar string by stripping the pre-rendered strings
  return (
    BAR_COMPLETE_CHAR.repeat(completeSize) +
    BAR_INCOMPLETE_CHAR.repeat(incompleteSize)
  );
}

function clapToRange({
  min,
  max,
  value,
}: {
  min: number;
  max: number;
  value: number;
}): number {
  return Math.min(max, Math.max(min, value));
}
