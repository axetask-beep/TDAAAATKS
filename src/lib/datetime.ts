// Combines a YYYY-MM-DD date (from CalendarPicker) and an HH:mm time (from a
// native time input) into an absolute ISO string, using the browser's local
// timezone — so it round-trips unambiguously through the server's
// `timestamp` columns regardless of server timezone.
export function combineDateAndTime(date: string, time: string): string | undefined {
  if (!date) return undefined;
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm] = (time || '00:00').split(':').map(Number);
  if (!y || !m || !d) return undefined;
  return new Date(y, m - 1, d, hh || 0, mm || 0, 0).toISOString();
}

export const DATE_ORDER_ERROR = 'La date de fin ne peut pas être avant la date de début.';

// True when both dates are set and the end falls before the start.
export function isEndBeforeStart(startDate: string, startTime: string, endDate: string, endTime: string): boolean {
  const s = combineDateAndTime(startDate, startTime), e = combineDateAndTime(endDate, endTime);
  return !!s && !!e && e < s;
}

export function splitISOToDateAndTime(iso?: string | null): { date: string; time: string } {
  if (!iso) return { date: '', time: '' };
  const dt = new Date(iso);
  if (isNaN(dt.getTime())) return { date: '', time: '' };
  const pad = (n: number) => String(n).padStart(2, '0');
  return {
    date: `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`,
    time: `${pad(dt.getHours())}:${pad(dt.getMinutes())}`,
  };
}
