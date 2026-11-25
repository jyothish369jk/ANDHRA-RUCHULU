import type {
  BookingStatus,
  ReservationOccasion,
  TableBooking,
} from '../types/restaurant';

export const BOOKINGS_STORAGE_KEY = 'my_restaurant_bookings';
export const OWNER_WHATSAPP_NUMBER = '919381228257';
export const BOOKINGS_UPDATED_EVENT = 'ar-bookings-updated';

const VALID_OCCASIONS: ReservationOccasion[] = [
  'Birthday',
  'Anniversary',
  'Family Dinner',
  'Casual Dining',
  'Corporate Event',
  'Other',
];

const VALID_BOOKING_STATUSES: BookingStatus[] = [
  'Sent via WhatsApp (Awaiting Reply)',
  'Confirmed',
  'Seated',
  'Completed',
  'Cancelled',
];

export function sanitizeTableBooking(raw: unknown): TableBooking | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  const id = typeof obj.id === 'string' ? obj.id.trim() : '';
  const name = typeof obj.name === 'string' ? obj.name.trim() : '';
  if (!id || !name) return null;

  const phone = typeof obj.phone === 'string' ? obj.phone.trim() : '';
  const occasion: ReservationOccasion = VALID_OCCASIONS.includes(
    obj.occasion as ReservationOccasion,
  )
    ? (obj.occasion as ReservationOccasion)
    : 'Other';
  const rawGuests = Number(obj.guests);
  const guests =
    Number.isFinite(rawGuests) && rawGuests >= 1
      ? Math.min(100, Math.round(rawGuests))
      : 2;
  const dateTime =
    typeof obj.dateTime === 'string' && obj.dateTime.trim()
      ? obj.dateTime.trim()
      : new Date().toISOString();
  const bookedAt =
    typeof obj.bookedAt === 'string' && obj.bookedAt.trim()
      ? obj.bookedAt.trim()
      : new Date().toISOString();
  const status: BookingStatus = VALID_BOOKING_STATUSES.includes(
    obj.status as BookingStatus,
  )
    ? (obj.status as BookingStatus)
    : 'Sent via WhatsApp (Awaiting Reply)';

  return {
    id,
    name,
    phone,
    occasion,
    guests,
    dateTime,
    bookedAt,
    status,
    locationName:
      typeof obj.locationName === 'string' && obj.locationName.trim()
        ? obj.locationName.trim()
        : undefined,
    updatedAt:
      typeof obj.updatedAt === 'string' && obj.updatedAt.trim()
        ? obj.updatedAt.trim()
        : undefined,
  };
}

function notifyBookingsUpdated(): void {
  try {
    window.dispatchEvent(new CustomEvent(BOOKINGS_UPDATED_EVENT));
  } catch {
    // Ignore in non-DOM environments
  }
}

export function toLocalDateTimeInputValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

export function getTomorrowStartMs(referenceNow: Date = new Date()): number {
  return new Date(
    referenceNow.getFullYear(),
    referenceNow.getMonth(),
    referenceNow.getDate() + 1,
    0,
    0,
    0,
    0,
  ).getTime();
}

export function getMinAdvanceDateTime(): string {
  const now = new Date();
  const minMs = Math.max(
    getTomorrowStartMs(now),
    now.getTime() + 24 * 60 * 60 * 1000,
  );
  return toLocalDateTimeInputValue(new Date(minMs));
}

export function getDefaultBookingDateTime(): string {
  const now = new Date();
  const minRequiredMs = Math.max(
    getTomorrowStartMs(now),
    now.getTime() + 24 * 60 * 60 * 1000,
  );

  // Prefer tomorrow evening (7:00 PM) whenever it satisfies the 24-hour advance rule
  const tomorrowDinner = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 1,
    19,
    0,
    0,
    0,
  );
  if (tomorrowDinner.getTime() >= minRequiredMs + 5 * 60 * 1000) {
    return toLocalDateTimeInputValue(tomorrowDinner);
  }

  // Otherwise choose a clean 15-minute slot >= 24h from now while staying on tomorrow's date
  const candidate = new Date(minRequiredMs + 15 * 60 * 1000);
  const roundedMinutes = Math.ceil(candidate.getMinutes() / 15) * 15;
  candidate.setMinutes(roundedMinutes, 0, 0);

  const tomorrowEnd = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 1,
    23,
    59,
    0,
    0,
  );
  if (candidate.getTime() > tomorrowEnd.getTime()) {
    return toLocalDateTimeInputValue(tomorrowEnd);
  }
  return toLocalDateTimeInputValue(candidate);
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
    return parsed
      .map(sanitizeTableBooking)
      .filter((item): item is TableBooking => item !== null)
      .sort(
        (a, b) =>
          (new Date(b.bookedAt).getTime() || 0) -
          (new Date(a.bookedAt).getTime() || 0),
      );
  } catch {
    return [];
  }
}

export function saveMyBookingsToStorage(bookings: TableBooking[]): void {
  try {
    window.localStorage.setItem(BOOKINGS_STORAGE_KEY, JSON.stringify(bookings));
    notifyBookingsUpdated();
  } catch {
    // Graceful fallback if storage quota or privacy mode restricts writes
  }
}

export function appendMyBookingToStorage(booking: TableBooking): TableBooking[] {
  const existing = loadMyBookingsFromStorage();
  const deduped = existing.filter((item) => item.id !== booking.id);
  const updated = [booking, ...deduped];
  saveMyBookingsToStorage(updated);
  return updated;
}

export function updateMyBookingStatusInStorage(
  id: string,
  status: BookingStatus,
): TableBooking | null {
  const existing = loadMyBookingsFromStorage();
  let updatedBooking: TableBooking | null = null;
  const nextList = existing.map((item) => {
    if (item.id !== id) return item;
    updatedBooking = {
      ...item,
      status,
      updatedAt: new Date().toISOString(),
    };
    return updatedBooking;
  });
  if (updatedBooking) {
    saveMyBookingsToStorage(nextList);
  }
  return updatedBooking;
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
