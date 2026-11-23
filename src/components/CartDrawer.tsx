import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { CheckCircle2, MessageCircle, Minus, Plus, ShoppingBag, Trash2, X } from 'lucide-react';
import type { CartItem } from '../types/restaurant';
import { FoodImage } from './InteractivePrimitives';

interface CartDrawerProps {
  isOpen: boolean;
  items: CartItem[];
  onClose: () => void;
  onUpdateQty: (cartKey: string, delta: number) => void;
  onRemoveItem: (cartKey: string) => void;
  onClearCart: () => void;
  onShowToast: (title: string, description: string) => void;
}

export function CartDrawer({
  isOpen,
  items,
  onClose,
  onUpdateQty,
  onRemoveItem,
  onClearCart,
  onShowToast,
}: CartDrawerProps) {
  const [orderPlacedCode, setOrderPlacedCode] = useState<string | null>(null);

  const subtotal = items.reduce((sum, entry) => sum + entry.unitPriceInr * entry.quantity, 0);
  const taxes = Math.round(subtotal * 0.05);
  const grandTotal = subtotal + taxes;

  const handleWhatsAppCheckoutHook = async () => {
    // TODO: Integrate WhatsApp Checkout API here
    const summaryLines = items.map(
      (entry) =>
        `• ${entry.quantity}x ${entry.item.name} (${entry.spicePreference}, ${entry.portionStyle}) — ₹${
          entry.unitPriceInr * entry.quantity
        }`,
    );
    const payloadText = `Andhra Ruchulu Order Request:\n${summaryLines.join(
      '\n',
    )}\nTotal (incl. 5% GST): ₹${grandTotal}`;

    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(payloadText);
      }
    } catch {
      // Clipboard access optional in sandbox
    }

    onShowToast(
      'WhatsApp Checkout Hook Ready',
      'Order summary copied to clipboard. Connect WhatsApp Business API in CartDrawer.tsx.',
    );
  };

  const handleConfirmDiningOrder = () => {
    const code = `AR-${Math.floor(4000 + Math.random() * 5999)}`;
    setOrderPlacedCode(code);
    onClearCart();
    onShowToast(
      `Pre-Order Received · #${code}`,
      'Our kitchen concierge has received your customized dish selection.',
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
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.aside
            role="dialog"
            aria-modal="true"
            aria-label="Your Andhra Ruchulu Order"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 320, damping: 32 }}
            onClick={(e) => e.stopPropagation()}
            className="glass-panel-elevated ml-auto flex h-full w-full max-w-md flex-col justify-between p-6"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-2.5">
                <ShoppingBag className="h-5 w-5 text-[#F59E0B]" aria-hidden="true" />
                <h2 className="font-serif text-2xl font-semibold text-[#F8FAFC]">
                  Your Dining Selection
                </h2>
              </div>
              <button
                type="button"
                onClick={() => {
                  setOrderPlacedCode(null);
                  onClose();
                }}
                aria-label="Close order drawer"
                className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border border-white/12 text-[#94A3B8] transition-colors hover:border-white/25 hover:text-[#F8FAFC]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Body */}
            <div className="my-4 flex-1 overflow-y-auto pr-1">
              {orderPlacedCode ? (
                <div className="flex h-full flex-col items-center justify-center rounded-2xl border border-[#10B981]/30 bg-[#10B981]/[0.06] p-6 text-center">
                  <CheckCircle2 className="h-10 w-10 text-[#10B981]" aria-hidden="true" />
                  <h3 className="mt-4 font-serif text-2xl font-semibold text-[#F8FAFC]">
                    Order #{orderPlacedCode} Sent to Kitchen
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-[#94A3B8]">
                    Your dishes are queued for claypot preparation. Share this reference upon
                    arrival or during table service.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setOrderPlacedCode(null);
                      onClose();
                    }}
                    className="mt-6 min-h-[44px] cursor-pointer rounded-xl bg-[#F59E0B] px-6 py-2.5 text-xs font-semibold text-[#0B0C10]"
                  >
                    Return to Menu
                  </button>
                </div>
              ) : items.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center py-12 text-center">
                  <ShoppingBag className="h-9 w-9 text-white/20" aria-hidden="true" />
                  <p className="mt-4 font-serif text-2xl text-[#F8FAFC]">Your tray is empty</p>
                  <p className="mt-2 max-w-xs text-sm text-[#94A3B8]">
                    Select signature claypot biryanis, coastal curries, or vepudu starters from the
                    tasting menu.
                  </p>
                </div>
              ) : (
                <ul className="space-y-4">
                  {items.map((entry) => (
                    <li
                      key={entry.cartKey}
                      className="glass-panel flex gap-3.5 rounded-2xl p-3.5"
                    >
                      <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-[#14110F]">
                        <FoodImage
                          src={entry.item.image}
                          alt={entry.item.name}
                          titleFallback={entry.item.name}
                        />
                      </div>

                      <div className="flex min-w-0 flex-1 flex-col justify-between">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="truncate font-serif text-lg font-semibold text-[#F8FAFC]">
                            {entry.item.name}
                          </h3>
                          <button
                            type="button"
                            onClick={() => onRemoveItem(entry.cartKey)}
                            aria-label={`Remove ${entry.item.name}`}
                            className="cursor-pointer text-[#94A3B8] transition-colors hover:text-[#DC2626]"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>

                        <p className="mt-0.5 text-xs text-[#94A3B8]">
                          {entry.spicePreference} · {entry.portionStyle}
                        </p>
                        {entry.notes && (
                          <p className="mt-1 truncate text-[11px] italic text-[#F59E0B]/85">
                            Note: {entry.notes}
                          </p>
                        )}

                        <div className="mt-2.5 flex items-center justify-between">
                          <div className="inline-flex items-center gap-2 rounded-lg border border-white/12 bg-white/[0.03] px-1.5 py-0.5">
                            <button
                              type="button"
                              onClick={() => onUpdateQty(entry.cartKey, -1)}
                              aria-label="Decrease quantity"
                              className="flex h-6 w-6 cursor-pointer items-center justify-center rounded text-[#94A3B8] hover:text-[#F8FAFC]"
                            >
                              <Minus className="h-3 w-3" />
                            </button>
                            <span className="min-w-[1.25rem] text-center text-xs font-semibold text-[#F8FAFC] tabular-nums">
                              {entry.quantity}
                            </span>
                            <button
                              type="button"
                              onClick={() => onUpdateQty(entry.cartKey, 1)}
                              aria-label="Increase quantity"
                              className="flex h-6 w-6 cursor-pointer items-center justify-center rounded text-[#94A3B8] hover:text-[#F8FAFC]"
                            >
                              <Plus className="h-3 w-3" />
                            </button>
                          </div>

                          <span className="text-sm font-semibold text-[#F59E0B] tabular-nums">
                            ₹{entry.unitPriceInr * entry.quantity}
                          </span>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Footer Totals & Future-Ready Checkout Actions */}
            {items.length > 0 && !orderPlacedCode && (
              <div className="border-t border-white/10 pt-4">
                <div className="space-y-1.5 text-xs text-[#94A3B8]">
                  <div className="flex justify-between">
                    <span>Subtotal</span>
                    <span className="text-[#F8FAFC] tabular-nums">₹{subtotal}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Hospitality GST (5%)</span>
                    <span className="text-[#F8FAFC] tabular-nums">₹{taxes}</span>
                  </div>
                  <div className="flex justify-between border-t border-white/10 pt-2 text-sm font-semibold text-[#F8FAFC]">
                    <span>Total</span>
                    <span className="text-[#F59E0B] tabular-nums">₹{grandTotal}</span>
                  </div>
                </div>

                <div className="mt-4 flex flex-col gap-2.5">
                  <button
                    type="button"
                    onClick={handleConfirmDiningOrder}
                    className="min-h-[44px] w-full cursor-pointer rounded-xl bg-[#F59E0B] px-5 py-3 text-sm font-semibold text-[#0B0C10] transition-colors hover:bg-[#FBBF24]"
                  >
                    Confirm Table Pre-Order
                  </button>

                  {/* // TODO: Integrate WhatsApp Checkout API here */}
                  <button
                    type="button"
                    onClick={handleWhatsAppCheckoutHook}
                    data-checkout-hook="whatsapp-api"
                    className="inline-flex min-h-[44px] w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-[#10B981]/35 bg-[#10B981]/10 px-5 py-2.5 text-xs font-semibold text-[#10B981] transition-colors hover:bg-[#10B981]/20"
                  >
                    <MessageCircle className="h-4 w-4" aria-hidden="true" />
                    <span>Order via WhatsApp (API Ready)</span>
                  </button>
                </div>
              </div>
            )}
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
