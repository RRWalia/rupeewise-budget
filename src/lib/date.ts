const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export function parseDateOnlyLocal(dateString: string): Date {
  const match = DATE_ONLY_PATTERN.exec(dateString);
  if (!match) {
    return new Date(dateString);
  }

  const [, year, month, day] = match;
  return new Date(Number(year), Number(month) - 1, Number(day));
}

export function getLocalDateInputValue(date = new Date()): string {
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return localDate.toISOString().slice(0, 10);
}

export function addDaysLocal(date: Date, days: number): Date {
  const copy = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  copy.setDate(copy.getDate() + days);
  return copy;
}

export function getMonthKey(input: Date | string = new Date()): string {
  const date = typeof input === 'string' ? parseDateOnlyLocal(input) : input;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export function getCurrentMonthKey(date = new Date()): string {
  return getMonthKey(date);
}

export function getRelativeMonthKey(monthKey: string, offsetMonths: number): string {
  const [year, month] = monthKey.split('-').map(Number);
  const date = new Date(year, month - 1 + offsetMonths, 1);
  return getMonthKey(date);
}

export function getDaysInMonth(input: Date | string = new Date()): number {
  const date = typeof input === 'string'
    ? parseDateOnlyLocal(input.length === 7 ? `${input}-01` : input)
    : input;
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}

export function isInMonth(dateString: string, monthKey: string): boolean {
  return getMonthKey(dateString) === monthKey;
}

export function formatMonthLabel(monthKey: string, locale = 'en-IN'): string {
  const [year, month] = monthKey.split('-').map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString(locale, {
    month: 'long',
    year: 'numeric',
  });
}

export function formatShortMonthLabel(monthKey: string, locale = 'en-IN'): string {
  const [year, month] = monthKey.split('-').map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString(locale, {
    month: 'short',
  });
}
