import type { TableBooking } from '../types/restaurant';

export const BOOKINGS_STORAGE_KEY = 'my_restaurant_bookings';
export const OWNER_WHATSAPP_NUMBER = '919381228257';

export function toLocalDateTimeInputValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

export function getMinAdvanceDateTime(): string {
  const nowPlus24h = new Date(Date.now() + 24 * 60 * 60 * 1000);
  return toLocalDateTimeInputValue(nowPlus24h);
}

export function getDefaultBookingDateTime(): string {
  const target = new Date(Date.now() + 25 * 60 * 60 * 1000);
  const minutes = target.getMinutes();
  const roundedMinutes = Math.ceil(minutes / 15) * 15;
  target.setMinutes(roundedMinutes, 0, 0);
  return toLocalDateTimeInputValue(target);
}

export function formatDisplayDateTime(dateTimeStr: string): string {
  const parsed = new Date(dateTimeStr);
  if (Number.isNaN(parsed.getTime())) return dateTimeStr;
  return parsed.toLocaleString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

export function loadMyBookingsFromStorage(): TableBooking[] {
  try {
    const raw = window.localStorage.getItem(BOOKINGS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.sort(
      (a: TableBooking, b: TableBooking) =>
        new Date(b.bookedAt).getTime() - new Date(a.bookedAt).getTime(),
    );
  } catch {
    return [];
  }
}

export function saveMyBookingsToStorage(bookings: TableBooking[]): void {
  try {
    window.localStorage.setItem(BOOKINGS_STORAGE_KEY, JSON.stringify(bookings));
  } catch {
    // Graceful fallback if storage quota or privacy mode restricts writes
  }
}

export function appendMyBookingToStorage(booking: TableBooking): TableBooking[] {
  const existing = loadMyBookingsFromStorage();
  const updated = [booking, ...existing];
  saveMyBookingsToStorage(updated);
  return updated;
}

export function removeMyBookingFromStorage(id: string): TableBooking[] {
  const existing = loadMyBookingsFromStorage();
  const updated = existing.filter((item) => item.id !== id);
  saveMyBookingsToStorage(updated);
  return updated;
}

export function buildWhatsAppBookingUrl(booking: {
  name: string;
  phone: string;
  occasion: string;
  guests: number;
  dateTime: string;
}): string {
  const formattedDateTime = formatDisplayDateTime(booking.dateTime);
  const message = [
    'Hello! I would like to reserve a table at your restaurant.',
    `*Name:* ${booking.name}`,
    `*Phone:* ${booking.phone}`,
    `*Occasion:* ${booking.occasion}`,
    `*Guests:* ${booking.guests}`,
    `*Date & Time:* ${formattedDateTime}`,
    'Please let me know if this slot is available!',
  ].join('\n');

  return `https://wa.me/${OWNER_WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
}

export function buildWhatsAppFollowUpUrl(booking: TableBooking): string {
  const formattedDateTime = formatDisplayDateTime(booking.dateTime);
  const message = [
    'Hello! I am following up on my table reservation request.',
    `*Ref:* ${booking.id}`,
    `*Name:* ${booking.name}`,
    `*Occasion:* ${booking.occasion}`,
    `*Guests:* ${booking.guests}`,
    `*Date & Time:* ${formattedDateTime}`,
    'Could you please confirm if my table is reserved?',
  ].join('\n');

  return `https://wa.me/${OWNER_WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
}

export function buildWhatsAppCancelUrl(booking: TableBooking): string {
  const formattedDateTime = formatDisplayDateTime(booking.dateTime);
  const message = [
    'Hello! Please cancel my table reservation request.',
    `*Ref:* ${booking.id}`,
    `*Name:* ${booking.name}`,
    `*Date & Time:* ${formattedDateTime}`,
    'Thank you!',
  ].join('\n');

  return `https://wa.me/${OWNER_WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
}
