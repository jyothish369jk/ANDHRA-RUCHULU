import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  CalendarCheck,
  Clock,
  MessageCircle,
  Phone,
  Trash2,
  User,
  Users,
  X,
} from 'lucide-react';
import type { TableBooking } from '../types/restaurant';
import {
  buildWhatsAppCancelUrl,
  buildWhatsAppFollowUpUrl,
  formatDisplayDateTime,
} from '../utils/reservationsStorage';

interface MyBookingsModalProps {
  isOpen: boolean;
  bookings: TableBooking[];
  onClose: () => void;
  onReserveNow: () => void;
  onRemoveBooking: (id: string) => void;
  onShowToast: (title: string, description: string) => void;
}

export function MyBookingsModal({
  isOpen,
  bookings,
  onClose,
  onReserveNow,
  onRemoveBooking,
  onShowToast,
}: MyBookingsModalProps) {
  const [confirmingRemoveId, setConfirmingRemoveId] = useState<string | null>(null);

  const handleClose = () => {
    setConfirmingRemoveId(null);
    onClose();
  };

  const handleFollowUp = (booking: TableBooking) => {
    const url = buildWhatsAppFollowUpUrl(booking);
    window.open(url, '_blank', 'noopener,noreferrer');
    onShowToast(
      'Opening WhatsApp',
      `Follow-up message prepared for your ${booking.occasion} reservation.`,
    );
  };

  const handleCancelViaWhatsApp = (booking: TableBooking) => {
    const url = buildWhatsAppCancelUrl(booking);
    window.open(url, '_blank', 'noopener,noreferrer');
    onRemoveBooking(booking.id);
    setConfirmingRemoveId(null);
    onShowToast(
      'Cancellation Sent & Removed',
      `Opened WhatsApp cancellation for ${booking.id} and removed it from My Bookings.`,
    );
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm"
          onClick={handleClose}
        >
          <motion.aside
            role="dialog"
            aria-modal="true"
            aria-label="My Reservations"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 320, damping: 32 }}
            onClick={(e) => e.stopPropagation()}
            className="glass-panel-elevated ml-auto flex h-full w-full max-w-lg flex-col justify-between p-5 sm:p-6"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-2.5">
                <CalendarCheck className="h-5 w-5 text-[#F59E0B]" aria-hidden="true" />
                <div>
                  <h2 className="font-serif text-2xl font-semibold text-[#F8FAFC]">
                    My Reservations
                  </h2>
                  <p className="text-xs text-[#94A3B8]">
                    Saved locally on this device ({bookings.length})
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleClose}
                aria-label="Close My Reservations"
                className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border border-white/12 text-[#94A3B8] transition-colors hover:border-white/25 hover:text-[#F8FAFC]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Body */}
            <div className="my-4 flex-1 overflow-y-auto pr-1">
              {bookings.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center rounded-2xl border border-white/10 bg-white/[0.02] p-8 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full border border-[#F59E0B]/30 bg-[#F59E0B]/10 text-[#F59E0B]">
                    <CalendarCheck className="h-6 w-6" aria-hidden="true" />
                  </div>
                  <h3 className="mt-4 font-serif text-2xl font-semibold text-[#F8FAFC]">
                    You have no table reservations yet
                  </h3>
                  <p className="mt-2 max-w-xs text-sm leading-relaxed text-[#94A3B8]">
                    Reserve a table at least 24 hours in advance and your WhatsApp requests will
                    appear right here.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      handleClose();
                      onReserveNow();
                    }}
                    className="mt-6 min-h-[44px] cursor-pointer rounded-xl bg-[#F59E0B] px-6 py-3 text-sm font-semibold text-[#0B0C10] transition-colors hover:bg-[#FBBF24]"
                  >
                    Reserve Now
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {bookings.map((booking) => {
                    const isConfirming = confirmingRemoveId === booking.id;
                    return (
                      <article
                        key={booking.id}
                        className="glass-panel rounded-2xl p-4 sm:p-5"
                      >
                        {/* Top Row: Occasion & Status */}
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="inline-flex items-center rounded-lg border border-[#F59E0B]/35 bg-[#F59E0B]/12 px-2.5 py-1 text-xs font-semibold text-[#F59E0B]">
                            {booking.occasion}
                          </span>
                          <span className="inline-flex items-center rounded-lg border border-[#10B981]/30 bg-[#10B981]/12 px-2.5 py-1 text-[11px] font-medium text-[#10B981]">
                            Sent via WhatsApp
                          </span>
                        </div>

                        {/* Date & Time */}
                        <div className="mt-3.5 flex items-start gap-2.5">
                          <Clock
                            className="mt-0.5 h-4 w-4 shrink-0 text-[#F59E0B]"
                            aria-hidden="true"
                          />
                          <div>
                            <p className="text-sm font-semibold text-[#F8FAFC] tabular-nums">
                              {formatDisplayDateTime(booking.dateTime)}
                            </p>
                            <p className="mt-0.5 text-[11px] text-[#94A3B8]">
                              Ref {booking.id} · Booked {formatDisplayDateTime(booking.bookedAt)}
                            </p>
                          </div>
                        </div>

                        {/* Guest Details */}
                        <div className="mt-4 grid grid-cols-1 gap-2.5 border-y border-white/10 py-3 text-xs sm:grid-cols-3">
                          <div className="flex items-center gap-1.5 text-[#F8FAFC]">
                            <User className="h-3.5 w-3.5 shrink-0 text-[#94A3B8]" aria-hidden="true" />
                            <span className="truncate font-medium">{booking.name}</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-[#F8FAFC] tabular-nums">
                            <Users className="h-3.5 w-3.5 shrink-0 text-[#94A3B8]" aria-hidden="true" />
                            <span>{booking.guests} Guest(s)</span>
                          </div>
                          <a
                            href={`tel:+91${booking.phone}`}
                            className="flex items-center gap-1.5 text-[#F59E0B] tabular-nums hover:underline"
                          >
                            <Phone className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                            <span>{booking.phone}</span>
                          </a>
                        </div>

                        {/* Action Buttons */}
                        {isConfirming ? (
                          <div className="mt-4 space-y-2 rounded-xl border border-white/12 bg-white/[0.03] p-3">
                            <p className="text-xs font-medium text-[#F8FAFC]">
                              Remove this booking from your device or notify the restaurant?
                            </p>
                            <div className="flex flex-wrap items-center gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  onRemoveBooking(booking.id);
                                  setConfirmingRemoveId(null);
                                  onShowToast(
                                    'Booking Removed',
                                    'Deleted reservation from My Bookings.',
                                  );
                                }}
                                className="min-h-[38px] flex-1 cursor-pointer rounded-lg bg-[#DC2626] px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[#EF4444]"
                              >
                                Remove Only
                              </button>
                              <button
                                type="button"
                                onClick={() => handleCancelViaWhatsApp(booking)}
                                className="min-h-[38px] flex-1 cursor-pointer rounded-lg border border-[#F59E0B]/40 bg-[#F59E0B]/15 px-3 py-1.5 text-xs font-semibold text-[#F59E0B] transition-colors hover:bg-[#F59E0B]/25"
                              >
                                Cancel via WhatsApp
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmingRemoveId(null)}
                                className="min-h-[38px] cursor-pointer rounded-lg px-3 py-1.5 text-xs text-[#94A3B8] hover:text-[#F8FAFC]"
                              >
                                Keep
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                            <button
                              type="button"
                              onClick={() => handleFollowUp(booking)}
                              className="inline-flex min-h-[42px] flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-[#10B981]/35 bg-[#10B981]/12 px-3.5 py-2 text-xs font-semibold text-[#10B981] transition-colors hover:bg-[#10B981]/20"
                            >
                              <MessageCircle className="h-3.5 w-3.5" aria-hidden="true" />
                              <span>Follow Up on WhatsApp</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => setConfirmingRemoveId(booking.id)}
                              className="inline-flex min-h-[42px] cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-white/12 bg-white/[0.04] px-3.5 py-2 text-xs font-medium text-[#94A3B8] transition-colors hover:border-[#DC2626]/40 hover:text-[#DC2626]"
                            >
                              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                              <span>Cancel / Remove</span>
                            </button>
                          </div>
                        )}
                      </article>
                    );
                  })}
                </div>
              )}
            </div>

            {bookings.length > 0 && (
              <div className="border-t border-white/10 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    handleClose();
                    onReserveNow();
                  }}
                  className="min-h-[44px] w-full cursor-pointer rounded-xl bg-[#F59E0B] px-5 py-3 text-sm font-semibold text-[#0B0C10] transition-colors hover:bg-[#FBBF24]"
                >
                  Book Another Table
                </button>
              </div>
            )}
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
