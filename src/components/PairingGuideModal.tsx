import { AnimatePresence, motion } from 'motion/react';
import { Flame, Sparkles, X } from 'lucide-react';
import { MENU_ITEMS } from '../data/menuData';

interface PairingGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function PairingGuideModal({ isOpen, onClose }: PairingGuideModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
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
            aria-label="Spice and Beverage Pairing Guide"
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="glass-panel-elevated max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-3xl p-6 sm:p-8"
          >
            <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-4">
              <div>
                <p className="inline-flex items-center gap-1.5 text-xs font-medium text-[#F59E0B]">
                  <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Culinary Concierge Extension Slot</span>
                </p>
                <h3 className="mt-1 font-serif text-2xl font-semibold text-[#F8FAFC]">
                  Chef&apos;s Spice &amp; Pairing Matrix
                </h3>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close pairing guide"
                className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border border-white/12 text-[#94A3B8] hover:text-[#F8FAFC]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="mt-4 text-sm leading-relaxed text-[#94A3B8]">
              Each Andhra Ruchulu preparation balances single-origin heat with cooling coastal
              accompaniments. Use this reference while building your tasting table.
            </p>

            <div className="mt-6 divide-y divide-white/10 border-y border-white/10">
              {MENU_ITEMS.map((dish) => (
                <div
                  key={dish.id}
                  className="grid grid-cols-1 gap-2 py-3.5 sm:grid-cols-12 sm:items-center"
                >
                  <div className="sm:col-span-5">
                    <p className="font-serif text-lg font-semibold text-[#F8FAFC]">{dish.name}</p>
                    <p className="text-xs text-[#94A3B8]">{dish.region}</p>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-[#94A3B8] sm:col-span-2">
                    <Flame className="h-3.5 w-3.5 text-[#DC2626]" aria-hidden="true" />
                    <span>{dish.spiceLabel}</span>
                  </div>
                  <p className="text-xs text-[#94A3B8] sm:col-span-5">{dish.pairingNote}</p>
                </div>
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
