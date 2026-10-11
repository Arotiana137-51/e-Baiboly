// Local calendar dates as "yyyy-MM-dd" — the widget feed's day keys and the
// "Teny ho anao" start/check-in dates — plus whole-day arithmetic on them.

const DAY_MS = 86_400_000;

export const isoDay = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

// Days since 1970-01-01 for a local calendar date, via UTC midnight so a DST
// change never shifts it.
export const dayNumber = (day: Date | string): number => {
  if (typeof day === 'string') {
    const [y, m, d] = day.split('-').map(Number);
    return Date.UTC(y, m - 1, d) / DAY_MS;
  }
  return Date.UTC(day.getFullYear(), day.getMonth(), day.getDate()) / DAY_MS;
};
