export const kProgressBar = Symbol("kProgressBar");
export const kValue = Symbol("kValue");
export const kTotal = Symbol("kTotal");
export const kPercent = Symbol("kPercent");

export const AVAILABLE_PROGRESS_BAR_VARIABLES = [
  kProgressBar,
  kValue,
  kTotal,
  kPercent,
] as const;

export type AvailableProgressBarTemplateVariables =
  (typeof AVAILABLE_PROGRESS_BAR_VARIABLES)[number];
