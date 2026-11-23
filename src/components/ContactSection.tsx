import React, { useMemo, useRef, useState } from 'react';
import { motion, useScroll, useTransform } from 'motion/react';
import {
  AlertTriangle,
  CalendarCheck,
  CheckCircle2,
  Clock,
  ExternalLink,
  Mail,
  MapPin,
  MessageCircle,
  Minus,
  Navigation,
  Phone,
  Plus,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { FLAGSHIP_LOCATIONS } from '../data/menuData';
import type { ReservationOccasion, TableBooking } from '../types/restaurant';
import {
  buildWhatsAppBookingUrl,
  formatDisplayDateTime,
  getDefaultBookingDateTime,
  getMinAdvanceDateTime,
} from '../utils/reservationsStorage';
import { MagneticButton } from './InteractivePrimitives';

interface ContactSectionProps {
  onShowToast: (title: string, description: string) => void;
  onBookingCreated: (booking: TableBooking) => void;
  onOpenMyBookings: () => void;
}

const OCCASION_OPTIONS: ReservationOccasion[] = [
  'Birthday',
  'Anniversary',
  'Family Dinner',
  'Casual Dining',
  'Corporate Event',
  'Other',
];

interface FormErrors {
  name?: string;
  phone?: string;
  occasion?: string;
  guests?: string;
  dateTime?: string;
}

export function ContactSection({
  onShowToast,
  onBookingCreated,
  onOpenMyBookings,
}: ContactSectionProps) {
  const sectionRef = useRef<HTMLElement | null>(null);
  const [selectedCity, setSelectedCity] = useState<'hyderabad' | 'visakhapatnam'>('hyderabad');
  const [selectedLandmarkId, setSelectedLandmarkId] = useState<string>('jubilee');
  const [mapZoomed, setMapZoomed] = useState(false);

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ['start end', 'end start'],
  });
  const cardParallaxY = useTransform(scrollYProgress, [0, 0.5], [24, 0]);

  const [minDateTime, setMinDateTime] = useState<string>(() => getMinAdvanceDateTime());
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [occasion, setOccasion] = useState<ReservationOccasion>('Family Dinner');
  const [guests, setGuests] = useState<number>(2);
  const [dateTime, setDateTime] = useState<string>(() => getDefaultBookingDateTime());
  const [formErrors, setFormErrors] = useState<FormErrors>({});

  const [confirmedState, setConfirmedState] = useState<{
    booking: TableBooking;
    whatsappUrl: string;
  } | null>(null);

  const activeLocation = useMemo(
    () => FLAGSHIP_LOCATIONS.find((loc) => loc.id === selectedCity) ?? FLAGSHIP_LOCATIONS[0],
    [selectedCity],
  );

  const activeLandmark = useMemo(
    () =>
      activeLocation.landmarks.find((l) => l.id === selectedLandmarkId) ??
      activeLocation.landmarks[0],
    [activeLocation, selectedLandmarkId],
  );

  const handleCitySwitch = (cityId: 'hyderabad' | 'visakhapatnam') => {
    setSelectedCity(cityId);
    const nextLoc = FLAGSHIP_LOCATIONS.find((l) => l.id === cityId);
    if (nextLoc) {
      setSelectedLandmarkId(nextLoc.landmarks[0].id);
    }
  };

  const handleDateTimeFocus = () => {
    setMinDateTime(getMinAdvanceDateTime());
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const freshMinStr = getMinAdvanceDateTime();
    setMinDateTime(freshMinStr);

    const errors: FormErrors = {};

    if (!name.trim() || name.trim().length < 2) {
      errors.name = 'Please enter customer name.';
    }

    const cleanDigits = phone.replace(/\D/g, '');
    if (cleanDigits.length !== 10) {
      errors.phone = 'Please enter a valid 10-digit phone number.';
    }

    if (!occasion) {
      errors.occasion = 'Please select an occasion.';
    }

    if (!Number.isFinite(guests) || guests < 1) {
      errors.guests = 'Minimum 1 guest is required.';
    }

    if (!dateTime) {
      errors.dateTime = 'Please select your preferred date and time.';
    } else {
      const selectedMs = new Date(dateTime).getTime();
      const minRequiredMs = Date.now() + 24 * 60 * 60 * 1000;
      if (Number.isNaN(selectedMs) || selectedMs < minRequiredMs - 60_000) {
        errors.dateTime = 'Bookings must be made at least 24 hours in advance.';
      }
    }

    setFormErrors(errors);
    if (Object.keys(errors).length > 0) return;

    const newBooking: TableBooking = {
      id: `AR-${Date.now().toString().slice(-5)}`,
      name: name.trim(),
      phone: cleanDigits,
      occasion,
      guests,
      dateTime,
      bookedAt: new Date().toISOString(),
      status: 'Sent via WhatsApp (Awaiting Reply)',
      locationName: activeLocation.neighborhood,
    };

    onBookingCreated(newBooking);

    const whatsappUrl = buildWhatsAppBookingUrl(newBooking);
    window.open(whatsappUrl, '_blank', 'noopener,noreferrer');

    setConfirmedState({ booking: newBooking, whatsappUrl });
    onShowToast(
      'Saved to My Bookings',
      'Your table request was saved to My Bookings and redirected to WhatsApp.',
    );
  };

  return (
    <section
      ref={sectionRef}
      id="contact"
      className="relative z-10 mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-28"
    >
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="mb-10"
      >
        <p className="text-sm font-medium text-[#F59E0B]">Reservations &amp; Flagships</p>
        <h2
          className="text-balance mt-2 font-serif font-semibold tracking-tight text-[#F8FAFC]"
          style={{ fontSize: 'clamp(2.1rem, 3.8vw, 3.3rem)', lineHeight: 1.08 }}
        >
          Reserve a Table at the Obsidian Hearth
        </h2>
      </motion.div>

      {/* Split Glass Container */}
      <motion.div
        style={{ y: cardParallaxY }}
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.1 }}
        transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
        className="glass-panel-elevated grid grid-cols-1 overflow-hidden rounded-3xl will-change-transform lg:grid-cols-12"
      >
        {/* Left Side: Location, Hours & Stylized Interactive Dark-Mode Map */}
        <div className="flex flex-col justify-between border-b border-white/10 p-6 sm:p-8 lg:col-span-6 lg:border-r lg:border-b-0 lg:p-10">
          <div>
            {/* Flagship Location Switcher */}
            <div
              role="tablist"
              aria-label="Flagship locations"
              className="inline-flex items-center gap-1 rounded-xl border border-white/10 bg-white/[0.03] p-1"
            >
              {FLAGSHIP_LOCATIONS.map((loc) => {
                const isSelected = loc.id === selectedCity;
                return (
                  <button
                    key={loc.id}
                    type="button"
                    role="tab"
                    aria-selected={isSelected}
                    onClick={() => handleCitySwitch(loc.id)}
                    className={`min-h-[38px] cursor-pointer rounded-lg px-4 py-1.5 text-xs font-semibold whitespace-nowrap transition-colors ${
                      isSelected
                        ? 'bg-[#F59E0B] text-[#0B0C10]'
                        : 'text-[#94A3B8] hover:text-[#F8FAFC]'
                    }`}
                  >
                    {loc.city}
                  </button>
                );
              })}
            </div>

            <h3 className="mt-6 font-serif text-2xl font-semibold text-[#F8FAFC] sm:text-3xl">
              {activeLocation.neighborhood}
            </h3>

            <div className="mt-5 space-y-4 text-sm text-[#94A3B8]">
              <div className="flex items-start gap-3">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[#F59E0B]" aria-hidden="true" />
                <span>{activeLocation.address}</span>
              </div>
              <div className="flex items-start gap-3">
                <Clock className="mt-0.5 h-4 w-4 shrink-0 text-[#F59E0B]" aria-hidden="true" />
                <span>{activeLocation.hours}</span>
              </div>
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2 pt-1">
                <a
                  href={`tel:${activeLocation.phone.replace(/\s+/g, '')}`}
                  className="inline-flex items-center gap-2 text-[#F8FAFC] transition-colors hover:text-[#F59E0B]"
                >
                  <Phone className="h-4 w-4 text-[#F59E0B]" aria-hidden="true" />
                  <span className="tabular-nums">{activeLocation.phone}</span>
                </a>
                <a
                  href={`mailto:${activeLocation.email}`}
                  className="inline-flex items-center gap-2 text-[#F8FAFC] transition-colors hover:text-[#F59E0B]"
                >
                  <Mail className="h-4 w-4 text-[#F59E0B]" aria-hidden="true" />
                  <span>{activeLocation.email}</span>
                </a>
              </div>
            </div>
          </div>

          {/* Interactive Stylized Dark-Mode Architectural Map */}
          <div className="mt-8 overflow-hidden rounded-2xl border border-white/12 bg-[#08090C]">
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-2.5 text-xs text-[#94A3B8]">
              <span className="inline-flex items-center gap-1.5 tabular-nums">
                <Navigation className="h-3.5 w-3.5 text-[#F59E0B]" aria-hidden="true" />
                {activeLocation.coordinatesLabel}
              </span>
              <button
                type="button"
                onClick={() => setMapZoomed((prev) => !prev)}
                aria-label={mapZoomed ? 'Zoom out map' : 'Zoom in map'}
                className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-white/10 px-2 py-1 text-[11px] text-[#F8FAFC] transition-colors hover:border-[#F59E0B]/50"
              >
                {mapZoomed ? (
                  <>
                    <ZoomOut className="h-3 w-3" />
                    <span>Overview</span>
                  </>
                ) : (
                  <>
                    <ZoomIn className="h-3 w-3" />
                    <span>Focus</span>
                  </>
                )}
              </button>
            </div>

            <div className="relative h-52 w-full overflow-hidden">
              <svg
                viewBox="0 0 400 210"
                className={`h-full w-full transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                  mapZoomed ? 'scale-125' : 'scale-100'
                }`}
                role="img"
                aria-label={`Stylized dark architectural map of ${activeLocation.neighborhood}`}
              >
                <defs>
                  <pattern id="urbanGrid" width="28" height="28" patternUnits="userSpaceOnUse">
                    <path
                      d="M 28 0 L 0 0 0 28"
                      fill="none"
                      stroke="rgba(255,255,255,0.045)"
                      strokeWidth="1"
                    />
                  </pattern>
                </defs>
                <rect width="400" height="210" fill="url(#urbanGrid)" />

                <path
                  d={
                    selectedCity === 'hyderabad'
                      ? 'M 0 155 Q 140 120 220 95 T 400 52'
                      : 'M 0 175 Q 190 150 400 120'
                  }
                  fill="none"
                  stroke="rgba(245, 158, 11, 0.25)"
                  strokeWidth="2"
                />
                <path
                  d="M 110 0 Q 160 95 215 210"
                  fill="none"
                  stroke="rgba(255, 255, 255, 0.08)"
                  strokeWidth="1.5"
                />
                <path
                  d="M 275 0 L 245 210"
                  fill="none"
                  stroke="rgba(255, 255, 255, 0.06)"
                  strokeWidth="1"
                />
              </svg>

              {activeLocation.landmarks.map((pin, idx) => {
                const isActivePin = pin.id === activeLandmark.id;
                const isPrimary = idx === 0;
                return (
                  <button
                    key={pin.id}
                    type="button"
                    onClick={() => setSelectedLandmarkId(pin.id)}
                    style={{ left: `${pin.x}%`, top: `${pin.y}%` }}
                    className={`absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer rounded-full px-2.5 py-1 text-[11px] font-medium whitespace-nowrap transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F59E0B] ${
                      isPrimary
                        ? 'border border-[#F59E0B] bg-[#F59E0B] text-[#0B0C10] shadow-[0_0_20px_rgba(245,158,11,0.45)]'
                        : isActivePin
                          ? 'border border-white/40 bg-[#14110F] text-[#F8FAFC]'
                          : 'border border-white/15 bg-[#0B0C10]/90 text-[#94A3B8] hover:text-[#F8FAFC]'
                    }`}
                  >
                    {pin.label}
                  </button>
                );
              })}

              <div className="glass-panel absolute inset-x-3 bottom-3 flex items-center justify-between rounded-xl px-3.5 py-2 text-xs">
                <span className="font-medium text-[#F8FAFC]">{activeLandmark.label}</span>
                <span className="text-[#F59E0B]">{activeLandmark.distance}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Table Reservation Form with 24h Rule & WhatsApp Integration */}
        <div className="p-6 sm:p-8 lg:col-span-6 lg:p-10">
          {confirmedState ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex h-full flex-col justify-between rounded-2xl border border-[#10B981]/30 bg-[#10B981]/[0.06] p-6 sm:p-8"
            >
              <div>
                <div className="inline-flex items-center gap-2 text-sm font-semibold text-[#10B981]">
                  <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
                  <span>Saved to My Bookings &amp; Sent to WhatsApp</span>
                </div>
                <h3 className="mt-3 font-serif text-3xl font-semibold text-[#F8FAFC]">
                  Thank you, {confirmedState.booking.name}.
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-[#94A3B8]">
                  Reference{' '}
                  <span className="font-semibold text-[#F59E0B] tabular-nums">
                    {confirmedState.booking.id}
                  </span>{' '}
                  is saved on your device under{' '}
                  <span className="text-[#F8FAFC]">My Bookings</span> with status{' '}
                  <span className="text-[#F8FAFC]">{confirmedState.booking.status}</span>.
                </p>

                <dl className="mt-6 grid grid-cols-2 gap-4 border-y border-white/10 py-5 text-sm">
                  <div>
                    <dt className="text-xs text-[#94A3B8]">Occasion</dt>
                    <dd className="mt-1 font-medium text-[#F8FAFC]">
                      {confirmedState.booking.occasion}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-[#94A3B8]">Party Size</dt>
                    <dd className="mt-1 font-medium text-[#F8FAFC] tabular-nums">
                      {confirmedState.booking.guests} Guest(s)
                    </dd>
                  </div>
                  <div className="col-span-2">
                    <dt className="text-xs text-[#94A3B8]">Preferred Date &amp; Time</dt>
                    <dd className="mt-1 font-medium text-[#F8FAFC] tabular-nums">
                      {formatDisplayDateTime(confirmedState.booking.dateTime)}
                    </dd>
                  </div>
                </dl>
              </div>

              <div className="mt-6 flex flex-col gap-3">
                <a
                  href={confirmedState.whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-[#10B981] px-5 py-3 text-sm font-semibold text-[#0B0C10] transition-colors hover:bg-[#34D399]"
                >
                  <MessageCircle className="h-4 w-4" aria-hidden="true" />
                  <span>Open WhatsApp Chat</span>
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                </a>

                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={onOpenMyBookings}
                    className="inline-flex min-h-[44px] w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-[#F59E0B]/40 bg-[#F59E0B]/10 px-4 py-2.5 text-xs font-semibold text-[#F59E0B] transition-colors hover:bg-[#F59E0B]/20"
                  >
                    <CalendarCheck className="h-4 w-4" aria-hidden="true" />
                    <span>View My Bookings</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setConfirmedState(null);
                      setName('');
                      setPhone('');
                      setGuests(2);
                      setDateTime(getDefaultBookingDateTime());
                    }}
                    className="min-h-[44px] w-full cursor-pointer rounded-xl border border-white/15 bg-white/[0.04] px-4 py-2.5 text-xs font-medium text-[#F8FAFC] transition-colors hover:bg-white/[0.08]"
                  >
                    Book Another Table
                  </button>
                </div>
              </div>
            </motion.div>
          ) : (
            <form onSubmit={handleSubmit} noValidate className="flex h-full flex-col justify-between">
              <div>
                <h3 className="font-serif text-2xl font-semibold text-[#F8FAFC]">
                  Reserve a Table
                </h3>
                <p className="mt-1 text-sm text-[#94A3B8]">
                  Instant WhatsApp dispatch &amp; saved automatically to your My Bookings drawer.
                </p>

                <div className="mt-6 space-y-4">
                  {/* Customer Name & 10-Digit Phone Number */}
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label htmlFor="res-name" className="block text-xs font-medium text-[#94A3B8]">
                        Customer Name *
                      </label>
                      <input
                        id="res-name"
                        type="text"
                        required
                        placeholder="Ananya Rao"
                        value={name}
                        onChange={(e) => {
                          setName(e.target.value);
                          if (formErrors.name) setFormErrors({ ...formErrors, name: undefined });
                        }}
                        className="glass-input mt-1.5 h-11 w-full rounded-xl px-4 text-sm text-[#F8FAFC] placeholder:text-[#94A3B8]/45"
                      />
                      {formErrors.name && (
                        <p className="mt-1 text-xs text-[#DC2626]">{formErrors.name}</p>
                      )}
                    </div>

                    <div>
                      <label htmlFor="res-phone" className="block text-xs font-medium text-[#94A3B8]">
                        Phone Number (10 digits) *
                      </label>
                      <input
                        id="res-phone"
                        type="tel"
                        inputMode="numeric"
                        maxLength={10}
                        required
                        placeholder="9849000000"
                        value={phone}
                        onChange={(e) => {
                          const digits = e.target.value.replace(/\D/g, '').slice(0, 10);
                          setPhone(digits);
                          if (formErrors.phone) setFormErrors({ ...formErrors, phone: undefined });
                        }}
                        className="glass-input mt-1.5 h-11 w-full rounded-xl px-4 text-sm text-[#F8FAFC] tabular-nums placeholder:text-[#94A3B8]/45"
                      />
                      {formErrors.phone && (
                        <p className="mt-1 text-xs text-[#DC2626]">{formErrors.phone}</p>
                      )}
                    </div>
                  </div>

                  {/* Occasion & Number of Guests */}
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label
                        htmlFor="res-occasion"
                        className="block text-xs font-medium text-[#94A3B8]"
                      >
                        Occasion *
                      </label>
                      <select
                        id="res-occasion"
                        required
                        value={occasion}
                        onChange={(e) => {
                          setOccasion(e.target.value as ReservationOccasion);
                          if (formErrors.occasion) {
                            setFormErrors({ ...formErrors, occasion: undefined });
                          }
                        }}
                        className="glass-input mt-1.5 h-11 w-full rounded-xl bg-[#14110F] px-3.5 text-sm text-[#F8FAFC]"
                      >
                        {OCCASION_OPTIONS.map((item) => (
                          <option key={item} value={item} className="bg-[#0B0C10]">
                            {item}
                          </option>
                        ))}
                      </select>
                      {formErrors.occasion && (
                        <p className="mt-1 text-xs text-[#DC2626]">{formErrors.occasion}</p>
                      )}
                    </div>

                    <div>
                      <label htmlFor="res-guests" className="block text-xs font-medium text-[#94A3B8]">
                        Number of Guests *
                      </label>
                      <div className="mt-1.5 flex h-11 items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setGuests((g) => Math.max(1, g - 1))}
                          aria-label="Decrease guests"
                          className="glass-input flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-xl text-[#F8FAFC] hover:border-[#F59E0B]/50"
                        >
                          <Minus className="h-4 w-4" />
                        </button>
                        <input
                          id="res-guests"
                          type="number"
                          min={1}
                          max={40}
                          required
                          value={guests}
                          onChange={(e) => {
                            const val = parseInt(e.target.value, 10);
                            setGuests(Number.isNaN(val) ? 1 : Math.max(1, val));
                            if (formErrors.guests) {
                              setFormErrors({ ...formErrors, guests: undefined });
                            }
                          }}
                          className="glass-input h-11 w-full rounded-xl px-3 text-center text-sm font-semibold text-[#F8FAFC] tabular-nums"
                        />
                        <button
                          type="button"
                          onClick={() => setGuests((g) => Math.min(40, g + 1))}
                          aria-label="Increase guests"
                          className="glass-input flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-xl text-[#F8FAFC] hover:border-[#F59E0B]/50"
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                      </div>
                      {formErrors.guests && (
                        <p className="mt-1 text-xs text-[#DC2626]">{formErrors.guests}</p>
                      )}
                    </div>
                  </div>

                  {/* Preferred Date & Time (datetime-local with 24h min enforcement) */}
                  <div>
                    <label
                      htmlFor="res-datetime"
                      className="block text-xs font-medium text-[#94A3B8]"
                    >
                      Preferred Date &amp; Time *
                    </label>
                    <input
                      id="res-datetime"
                      type="datetime-local"
                      required
                      min={minDateTime}
                      value={dateTime}
                      onFocus={handleDateTimeFocus}
                      onChange={(e) => {
                        setDateTime(e.target.value);
                        if (formErrors.dateTime) {
                          setFormErrors({ ...formErrors, dateTime: undefined });
                        }
                      }}
                      className="glass-input mt-1.5 h-11 w-full rounded-xl px-3.5 text-sm text-[#F8FAFC] tabular-nums [color-scheme:dark]"
                    />
                    {formErrors.dateTime && (
                      <p role="alert" className="mt-1.5 text-xs font-medium text-[#DC2626]">
                        {formErrors.dateTime}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Prominent 24-Hour Advance Notice Right Above Submit Button */}
              <div className="mt-6 space-y-4 pt-2">
                <div
                  role="note"
                  className="flex items-start gap-3 rounded-2xl border border-[#F59E0B]/35 bg-[#F59E0B]/[0.08] p-3.5 text-xs leading-relaxed text-[#F8FAFC]"
                >
                  <AlertTriangle
                    className="mt-0.5 h-4 w-4 shrink-0 text-[#F59E0B]"
                    aria-hidden="true"
                  />
                  <p>
                    ⚠️ Note: Table reservations must be booked at least 24 hours in advance.
                    Confirmation is subject to restaurant approval via WhatsApp.
                  </p>
                </div>

                <MagneticButton type="submit" variant="primary" className="w-full">
                  <MessageCircle className="h-4 w-4" aria-hidden="true" />
                  <span>Confirm &amp; Send to WhatsApp</span>
                </MagneticButton>
              </div>
            </form>
          )}
        </div>
      </motion.div>
    </section>
  );
}
