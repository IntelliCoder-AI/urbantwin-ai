export function parseSeed(draft: string): number | null {
  if (!/^\d+$/.test(draft)) return null;
  const seed = Number(draft);
  return Number.isSafeInteger(seed) && seed >= 0 && seed <= 999999 ? seed : null;
}
