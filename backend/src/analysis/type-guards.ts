export const ensureNumber = (value: unknown): number => {
  const n = Number(value);
  return Number.isFinite(n) ? n : NaN;
};



