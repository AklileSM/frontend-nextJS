import { format, parseISO } from 'date-fns';

export function formatCaptureDate(iso: string): string {
  return format(parseISO(iso), 'EEE, MMM d, yyyy');
}

export function formatCaptureDateShort(iso: string): string {
  return format(parseISO(iso), 'MMM d, yyyy');
}

export function formatTimestamp(isoOrDate: string | Date): string {
  const d = typeof isoOrDate === 'string' ? new Date(isoOrDate) : isoOrDate;
  return format(d, 'MMM d, yyyy · HH:mm');
}
