import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Flame, X } from 'lucide-react';
import type { MenuItem, PortionStyle, SpicePreference } from '../types/restaurant';

interface CustomizeModalProps {
  dish: MenuItem | null;
  onClose: () => void;
  onConfirmAdd: (
    dish: MenuItem,
    spicePreference: SpicePreference,
    portionStyle: PortionStyle,
    notes: string,
  ) => void;
}

const SPICE_PREFERENCES: SpicePreference[] = [
  'Mild Temper',
  'Authentic Andhra',
  'Fiery Guntur',
];

const PORTION_STYLES: PortionStyle[] = ['Signature Plate', 'Claypot Feast (+₹180)'];

export function CustomizeModal({ dish, onClose, onConfirmAdd }: CustomizeModalProps) {
  const [spice, setSpice] = useState<SpicePreference>('Authentic Andhra');
  const [portion, setPortion] = useState<PortionStyle>('Signature Plate');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (dish) {
      setSpice(dish.spiceLevel === 3 ? 'Fiery Guntur' : 'Authentic Andhra');
      setPortion('Signature Plate');
      setNotes('');
    }
  }, [dish]);

  const computedPrice = dish ? dish.priceInr + (portion.includes('180') ? 180 : 0) : 0;

  return (
    <AnimatePresence>
      {dish && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={`Customize ${dish.name}`}
            initial={{ opacity: 0, scale: 0.95, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 12 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="glass-panel-elevated w-full max-w-lg rounded-3xl p-6 sm:p-8"
          >
            <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-4">
              <div>
                <p className="text-xs font-medium text-[#F59E0B]">{dish.category}</p>
                <h3 className="mt-1 font-serif text-2xl font-semibold text-[#F8FAFC]">
                  {dish.name}
                </h3>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close customization dialog"
                className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border border-white/12 text-[#94A3B8] hover:text-[#F8FAFC]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-6 space-y-6">
              {/* Spice Temper Selector */}
              <div>
                <label className="flex items-center gap-1.5 text-xs font-medium text-[#94A3B8]">
                  <Flame className="h-3.5 w-3.5 text-[#DC2626]" aria-hidden="true" />
                  <span>Spice Temper</span>
                </label>
                <div className="mt-2.5 grid grid-cols-1 gap-2 sm:grid-cols-3">
                  {SPICE_PREFERENCES.map((opt) => {
                    const active = spice === opt;
                    return (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => setSpice(opt)}
                        className={`min-h-[42px] cursor-pointer rounded-xl border px-3 py-2 text-xs font-medium transition-colors ${
                          active
                            ? 'border-[#F59E0B] bg-[#F59E0B]/15 text-[#F8FAFC]'
                            : 'border-white/12 bg-white/[0.03] text-[#94A3B8] hover:text-[#F8FAFC]'
                        }`}
                      >
                        {opt}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Portion Format */}
              <div>
                <label className="block text-xs font-medium text-[#94A3B8]">
                  Serving Style
                </label>
                <div className="mt-2.5 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {PORTION_STYLES.map((opt) => {
                    const active = portion === opt;
                    return (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => setPortion(opt)}
                        className={`min-h-[42px] cursor-pointer rounded-xl border px-3.5 py-2 text-xs font-medium transition-colors ${
                          active
                            ? 'border-[#F59E0B] bg-[#F59E0B]/15 text-[#F8FAFC]'
                            : 'border-white/12 bg-white/[0.03] text-[#94A3B8] hover:text-[#F8FAFC]'
                        }`}
                      >
                        {opt}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Kitchen Note */}
              <div>
                <label htmlFor="dish-notes" className="block text-xs font-medium text-[#94A3B8]">
                  Chef&apos;s Note (Allergies or Finishing Preference)
                </label>
                <input
                  id="dish-notes"
                  name="dishNotes"
                  type="text"
                  autoComplete="off"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g., Extra roasted curry leaves, no cashews"
                  className="glass-input mt-2 h-11 w-full rounded-xl px-4 text-sm text-[#F8FAFC] placeholder:text-[#94A3B8]/45"
                />
              </div>
            </div>

            <div className="mt-8 flex items-center justify-between gap-4 border-t border-white/10 pt-5">
              <div>
                <span className="text-xs text-[#94A3B8]">Item Total</span>
                <p className="font-sans text-2xl font-semibold tracking-tight text-[#F59E0B] tabular-nums">
                  ₹{computedPrice}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onConfirmAdd(dish, spice, portion, notes)}
                className="min-h-[44px] cursor-pointer rounded-xl bg-[#F59E0B] px-6 py-3 text-sm font-semibold text-[#0B0C10] transition-colors hover:bg-[#FBBF24]"
              >
                Add Customized Dish
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
