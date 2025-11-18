const formatter = new Intl.DateTimeFormat('ar-EG', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
});

export function fmtDateStable(value: string | number | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return formatter.format(date);
}

export default fmtDateStable;
