import React, { useMemo, useRef, useState } from 'react';
import { motion, useScroll, useTransform } from 'motion/react';
import { CheckCircle2, Clock, Mail, MapPin, Navigation, Phone, ZoomIn, ZoomOut } from 'lucide-react';
import { FLAGSHIP_LOCATIONS } from '../data/menuData';
import type { ReservationDetails } from '../types/restaurant';
import { MagneticButton } from './InteractivePrimitives';

interface ContactSectionProps {
  onShowToast: (title: string, description: string) => void;
}

const TIME_SLOTS = ['12:30 PM', '1:45 PM', '7:00 PM', '8:15 PM', '9:30 PM'];
const GUEST_OPTIONS = ['2 Guests', '4 Guests', '6 Guests', '8+ Private Dining'];

export function ContactSection({ onShowToast }: ContactSectionProps) {
  const sectionRef = useRef<HTMLElement | null>(null);
  const [selectedCity, setSelectedCity] = useState<'hyderabad' | 'visakhapatnam'>('hyderabad');
  const [selectedLandmarkId, setSelectedLandmarkId] = useState<string>('jubilee');
  const [mapZoomed, setMapZoomed] = useState(false);

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ['start end', 'end start'],
  });
  const cardParallaxY = useTransform(scrollYProgress, [0, 0.5], [24, 0]);

  const todayIso = useMemo(() => new Date().toISOString().split('T')[0], []);

  const [form, setForm] = useState<ReservationDetails>({
    name: '',
    phone: '',
    date: todayIso,
    time: '8:15 PM',
    guests: '2 Guests',
    locationId: 'hyderabad',
  });
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof ReservationDetails, string>>>({});
  const [confirmedReservation, setConfirmedReservation] = useState<
    (ReservationDetails & { confirmationCode: string }) | null
  >(null);

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
    setForm((prev) => ({ ...prev, locationId: cityId }));
  };

  const validateAndSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const errors: Partial<Record<keyof ReservationDetails, string>> = {};

    if (!form.name.trim() || form.name.trim().length < 2) {
      errors.name = 'Please enter your full name.';
    }
    const digitsOnly = form.phone.replace(/\D/g, '');
    if (digitsOnly.length < 10) {
      errors.phone = 'Enter a valid 10-digit phone number.';
    }
    if (!form.date) {
      errors.date = 'Select a preferred dining date.';
    }

    setFormErrors(errors);
    if (Object.keys(errors).length > 0) return;

    const code = `AR-${Math.floor(1000 + Math.random() * 9000)}`;
    const confirmed = { ...form, confirmationCode: code };
    setConfirmedReservation(confirmed);

    const locName =
      FLAGSHIP_LOCATIONS.find((l) => l.id === form.locationId)?.neighborhood ?? 'Flagship';
    onShowToast(
      `Table Reserved · ${code}`,
      `${form.guests} confirmed at ${locName} for ${form.date} at ${form.time}.`,
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
          Reserve Your Table at the Obsidian Hearth
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
                {/* Subtle Urban Grid */}
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

                {/* Architectural Avenues / Coastal Curve */}
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

              {/* Interactive Landmark Pins */}
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

              {/* Selected Landmark Detail Footer */}
              <div className="glass-panel absolute inset-x-3 bottom-3 flex items-center justify-between rounded-xl px-3.5 py-2 text-xs">
                <span className="font-medium text-[#F8FAFC]">{activeLandmark.label}</span>
                <span className="text-[#F59E0B]">{activeLandmark.distance}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Minimalist Table Booking Form */}
        <div className="p-6 sm:p-8 lg:col-span-6 lg:p-10">
          {confirmedReservation ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex h-full flex-col justify-between rounded-2xl border border-[#10B981]/30 bg-[#10B981]/[0.06] p-6 sm:p-8"
            >
              <div>
                <div className="inline-flex items-center gap-2 text-sm font-semibold text-[#10B981]">
                  <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
                  <span>Reservation Confirmed</span>
                </div>
                <h3 className="mt-3 font-serif text-3xl font-semibold text-[#F8FAFC]">
                  We look forward to welcoming you, {confirmedReservation.name}.
                </h3>
                <p className="mt-2 text-sm text-[#94A3B8]">
                  Your table has been held under reference{' '}
                  <span className="font-semibold text-[#F59E0B] tabular-nums">
                    {confirmedReservation.confirmationCode}
                  </span>
                  .
                </p>

                <dl className="mt-6 grid grid-cols-2 gap-4 border-y border-white/10 py-5 text-sm">
                  <div>
                    <dt className="text-xs text-[#94A3B8]">Flagship</dt>
                    <dd className="mt-1 font-medium text-[#F8FAFC]">
                      {
                        FLAGSHIP_LOCATIONS.find((l) => l.id === confirmedReservation.locationId)
                          ?.neighborhood
                      }
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-[#94A3B8]">Party Size</dt>
                    <dd className="mt-1 font-medium text-[#F8FAFC] tabular-nums">
                      {confirmedReservation.guests}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-[#94A3B8]">Date</dt>
                    <dd className="mt-1 font-medium text-[#F8FAFC] tabular-nums">
                      {confirmedReservation.date}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-[#94A3B8]">Seating Time</dt>
                    <dd className="mt-1 font-medium text-[#F8FAFC] tabular-nums">
                      {confirmedReservation.time}
                    </dd>
                  </div>
                </dl>
              </div>

              <button
                type="button"
                onClick={() => setConfirmedReservation(null)}
                className="mt-6 min-h-[44px] w-full cursor-pointer rounded-xl border border-white/15 bg-white/[0.04] px-5 py-3 text-sm font-medium text-[#F8FAFC] transition-colors hover:bg-white/[0.08]"
              >
                Modify or Book Another Table
              </button>
            </motion.div>
          ) : (
            <form onSubmit={validateAndSubmit} noValidate className="flex h-full flex-col justify-between">
              <div>
                <h3 className="font-serif text-2xl font-semibold text-[#F8FAFC]">
                  Table Reservation Request
                </h3>
                <p className="mt-1.5 text-sm text-[#94A3B8]">
                  Instant table hold for main dining room or chef&apos;s spice bar seating.
                </p>

                <div className="mt-7 space-y-5">
                  <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                    <div>
                      <label htmlFor="res-name" className="block text-xs font-medium text-[#94A3B8]">
                        Full Name
                      </label>
                      <input
                        id="res-name"
                        type="text"
                        required
                        placeholder="Ananya Rao"
                        value={form.name}
                        onChange={(e) => {
                          setForm({ ...form, name: e.target.value });
                          if (formErrors.name) setFormErrors({ ...formErrors, name: undefined });
                        }}
                        className="glass-input mt-2 h-11 w-full rounded-xl px-4 text-sm text-[#F8FAFC] placeholder:text-[#94A3B8]/45"
                      />
                      {formErrors.name && (
                        <p className="mt-1.5 text-xs text-[#DC2626]">{formErrors.name}</p>
                      )}
                    </div>

                    <div>
                      <label htmlFor="res-phone" className="block text-xs font-medium text-[#94A3B8]">
                        Phone Number
                      </label>
                      <input
                        id="res-phone"
                        type="tel"
                        required
                        placeholder="+91 98490 00000"
                        value={form.phone}
                        onChange={(e) => {
                          setForm({ ...form, phone: e.target.value });
                          if (formErrors.phone) setFormErrors({ ...formErrors, phone: undefined });
                        }}
                        className="glass-input mt-2 h-11 w-full rounded-xl px-4 text-sm text-[#F8FAFC] tabular-nums placeholder:text-[#94A3B8]/45"
                      />
                      {formErrors.phone && (
                        <p className="mt-1.5 text-xs text-[#DC2626]">{formErrors.phone}</p>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
                    <div>
                      <label htmlFor="res-date" className="block text-xs font-medium text-[#94A3B8]">
                        Date
                      </label>
                      <input
                        id="res-date"
                        type="date"
                        min={todayIso}
                        required
                        value={form.date}
                        onChange={(e) => setForm({ ...form, date: e.target.value })}
                        className="glass-input mt-2 h-11 w-full rounded-xl px-3.5 text-sm text-[#F8FAFC] tabular-nums [color-scheme:dark]"
                      />
                    </div>

                    <div>
                      <label htmlFor="res-time" className="block text-xs font-medium text-[#94A3B8]">
                        Time
                      </label>
                      <select
                        id="res-time"
                        value={form.time}
                        onChange={(e) => setForm({ ...form, time: e.target.value })}
                        className="glass-input mt-2 h-11 w-full rounded-xl bg-[#14110F] px-3.5 text-sm text-[#F8FAFC] tabular-nums"
                      >
                        {TIME_SLOTS.map((slot) => (
                          <option key={slot} value={slot} className="bg-[#0B0C10]">
                            {slot}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label htmlFor="res-guests" className="block text-xs font-medium text-[#94A3B8]">
                        Guest Count
                      </label>
                      <select
                        id="res-guests"
                        value={form.guests}
                        onChange={(e) => setForm({ ...form, guests: e.target.value })}
                        className="glass-input mt-2 h-11 w-full rounded-xl bg-[#14110F] px-3.5 text-sm text-[#F8FAFC] tabular-nums"
                      >
                        {GUEST_OPTIONS.map((count) => (
                          <option key={count} value={count} className="bg-[#0B0C10]">
                            {count}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label htmlFor="res-location" className="block text-xs font-medium text-[#94A3B8]">
                      Dining Room
                    </label>
                    <select
                      id="res-location"
                      value={form.locationId}
                      onChange={(e) =>
                        handleCitySwitch(e.target.value as 'hyderabad' | 'visakhapatnam')
                      }
                      className="glass-input mt-2 h-11 w-full rounded-xl bg-[#14110F] px-3.5 text-sm text-[#F8FAFC]"
                    >
                      {FLAGSHIP_LOCATIONS.map((loc) => (
                        <option key={loc.id} value={loc.id} className="bg-[#0B0C10]">
                          {loc.city} — {loc.neighborhood}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="mt-8 pt-2">
                <MagneticButton type="submit" variant="primary" className="w-full">
                  Confirm Reservation
                </MagneticButton>
              </div>
            </form>
          )}
        </div>
      </motion.div>
    </section>
  );
}
