export function pastYearRange(now = new Date()) {
  const to = new Date(now.getTime() + 7 * 3_600_000).toISOString().slice(0, 10);
  const [year, month, day] = to.split("-").map(Number) as [number, number, number];
  const previousMonthEnd = new Date(Date.UTC(year - 1, month, 0)).getUTCDate();
  const from = new Date(Date.UTC(year - 1, month - 1, Math.min(day, previousMonthEnd)))
    .toISOString()
    .slice(0, 10);
  return { from, to };
}

export function vietnamDateBounds(from: string, to: string) {
  return {
    from: from ? `${from}T00:00:00+07:00` : undefined,
    to: to ? `${to}T23:59:59.999+07:00` : undefined,
  };
}
