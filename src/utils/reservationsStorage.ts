import type {
  BookingStatus,
  ReservationOccasion,
  TableBooking,
} from '../types/restaurant';

export const OWNER_WHATSAPP_NUMBER = '919381228257';
export const BOOKINGS_UPDATED_EVENT = 'ar-bookings-updated';
export const TABLE_BOOKINGS_STORAGE_KEY = 'andhra_ruchulu_table_bookings_v1';

const VALID_OCCASIONS: ReservationOccasion[] = [
  'Birthday',
  'Anniversary',
  'Family Dinner',
  'Casual Dining',
  'Corporate Event',
  'Other',
];

const VALID_BOOKING_STATUSES: BookingStatus[] = [
  'Pending',
  'Sent via WhatsApp (Awaiting Reply)',
  'Confirmed',
  'Seated',
  'Completed',
  'Cancelled',
];

let inMemoryBookingsFallback: TableBooking[] = [];

export function sanitizeTableBooking(raw: unknown): TableBooking | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  const rawId = obj.id;
  const id =
    rawId !== undefined && rawId !== null ? String(rawId).trim() : '';
  const name = String(obj.customer_name ?? obj.name ?? '').trim();
  if (!id || !name) return null;

  const phone = String(obj.phone_number ?? obj.phone ?? '').trim();
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

  const rawDateTime = obj.booking_time ?? obj.dateTime;
  const dateTime =
    typeof rawDateTime === 'string' && rawDateTime.trim()
      ? rawDateTime.trim()
      : new Date().toISOString();

  const rawBookedAt = obj.created_at ?? obj.bookedAt ?? rawDateTime;
  const bookedAt =
    typeof rawBookedAt === 'string' && rawBookedAt.trim()
      ? rawBookedAt.trim()
      : new Date().toISOString();

  const status: BookingStatus = VALID_BOOKING_STATUSES.includes(
    obj.status as BookingStatus,
  )
    ? (obj.status as BookingStatus)
    : 'Pending';

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

function readBookingsStorage(): TableBooking[] {
  try {
    const raw = window.localStorage.getItem(TABLE_BOOKINGS_STORAGE_KEY);
    if (!raw) return [...inMemoryBookingsFallback];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map(sanitizeTableBooking)
      .filter((item): item is TableBooking => item !== null)
      .sort(
        (a, b) =>
          (new Date(b.bookedAt || b.dateTime).getTime() || 0) -
          (new Date(a.bookedAt || a.dateTime).getTime() || 0),
      );
  } catch {
    return [...inMemoryBookingsFallback];
  }
}

function writeBookingsStorage(bookings: TableBooking[]): void {
  inMemoryBookingsFallback = [...bookings];
  try {
    window.localStorage.setItem(
      TABLE_BOOKINGS_STORAGE_KEY,
      JSON.stringify(bookings),
    );
  } catch {
    // Fallback remains in memory if localStorage is blocked
  }
}

export const bookingsService = {
  async listBookings(): Promise<TableBooking[]> {
    return readBookingsStorage();
  },

  async createBooking(input: {
    name: string;
    phone: string;
    occasion: ReservationOccasion;
    guests: number;
    dateTime: string;
  }): Promise<TableBooking> {
    const parsedTime = new Date(input.dateTime);
    const bookingTimeIso = Number.isNaN(parsedTime.getTime())
      ? input.dateTime
      : parsedTime.toISOString();
    const nowIso = new Date().toISOString();

    const created: TableBooking = {
      id: `AR-${Date.now().toString().slice(-5)}${Math.floor(10 + Math.random() * 90)}`,
      name: input.name.trim(),
      phone: input.phone.trim(),
      occasion: input.occasion,
      guests: Math.max(1, Math.round(input.guests)),
      dateTime: bookingTimeIso,
      bookedAt: nowIso,
      status: 'Pending',
      locationName: 'Madhuravada Flagship',
      updatedAt: nowIso,
    };

    const existing = readBookingsStorage();
    writeBookingsStorage([created, ...existing]);
    notifyBookingsUpdated();
    return created;
  },

  async updateBookingStatus(
    id: string,
    status: BookingStatus,
  ): Promise<TableBooking> {
    const existing = readBookingsStorage();
    const targetIdx = existing.findIndex((b) => b.id === id);
    if (targetIdx === -1) {
      throw new Error(`Booking #${id} could not be found.`);
    }

    const updated: TableBooking = {
      ...existing[targetIdx],
      status,
      updatedAt: new Date().toISOString(),
    };
    const nextList = existing.map((b) => (b.id === id ? updated : b));
    writeBookingsStorage(nextList);
    notifyBookingsUpdated();
    return updated;
  },

  async deleteBooking(id: string): Promise<void> {
    const existing = readBookingsStorage();
    const filtered = existing.filter((b) => b.id !== id);
    writeBookingsStorage(filtered);
    notifyBookingsUpdated();
  },
};

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
