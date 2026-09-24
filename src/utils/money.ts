export function parseBrlAmountToCents(value: string): number | null {
  let normalized = value.trim().replace(/^R\$\s*/i, '').replace(/\s/g, '');
  if (!normalized) return null;

  if (normalized.includes(',')) {
    if ((normalized.match(/,/g) ?? []).length !== 1) return null;
    const [whole, cents] = normalized.split(',');
    const validWhole = /^\d+$/.test(whole) || /^\d{1,3}(?:\.\d{3})+$/.test(whole);
    if (!validWhole || !/^\d{1,2}$/.test(cents)) return null;
    normalized = `${whole.replace(/\./g, '')}.${cents}`;
  }

  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) return null;
  const [whole, fraction = ''] = normalized.split('.');
  const amountCents = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  return Number.isSafeInteger(amountCents) && amountCents > 0 ? amountCents : null;
}
