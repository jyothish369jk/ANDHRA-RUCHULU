import { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  CheckCircle2,
  Loader2,
  MapPin,
  MessageCircle,
  Minus,
  Plus,
  ShoppingBag,
  Store,
  Trash2,
  X,
} from 'lucide-react';
import type { CartItem, OrderFulfillmentType } from '../types/restaurant';
import { localOrdersService } from '../services/dataService';
import { OWNER_WHATSAPP_NUMBER } from '../utils/reservationsStorage';
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

interface CheckoutErrors {
  customerName?: string;
  customerPhone?: string;
  deliveryAddress?: string;
  submit?: string;
}

interface PlacedOrderSummary {
  id: string;
  totalAmountInr: number;
  customerName: string;
  fulfillmentType: OrderFulfillmentType;
  whatsappUrl: string;
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
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [fulfillmentType, setFulfillmentType] =
    useState<OrderFulfillmentType>('Delivery');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [errors, setErrors] = useState<CheckoutErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [placedOrder, setPlacedOrder] = useState<PlacedOrderSummary | null>(
    null,
  );

  const handleClose = useCallback(() => {
    setPlacedOrder(null);
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (items.length > 0 && placedOrder) {
      setPlacedOrder(null);
    }
  }, [items.length, placedOrder]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        handleClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleClose]);

  const subtotal = items.reduce(
    (sum, entry) => sum + entry.unitPriceInr * entry.quantity,
    0,
  );
  const taxes = Math.round(subtotal * 0.05);
  const grandTotal = subtotal + taxes;

  const normalizePhoneDigits = (raw: string): string => {
    const digits = raw.replace(/\D/g, '');
    if (digits.length > 10 && digits.startsWith('91')) {
      return digits.slice(-10);
    }
    if (digits.length === 11 && digits.startsWith('0')) {
      return digits.slice(1);
    }
    return digits.slice(0, 10);
  };

  const validateCheckout = (): boolean => {
    const nextErrors: CheckoutErrors = {};

    if (!customerName.trim() || customerName.trim().length < 2) {
      nextErrors.customerName = 'Please enter your name.';
    }

    const cleanPhone = normalizePhoneDigits(customerPhone);
    if (cleanPhone.length !== 10) {
      nextErrors.customerPhone = 'Enter a valid 10-digit phone number.';
    }

    if (
      fulfillmentType === 'Delivery' &&
      (!deliveryAddress.trim() || deliveryAddress.trim().length < 5)
    ) {
      nextErrors.deliveryAddress =
        'Please enter your delivery address in Visakhapatnam.';
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const buildOrderWhatsAppUrl = (orderId: string, cleanPhone: string) => {
    const summaryLines = items.map(
      (entry) =>
        `• ${entry.quantity}x ${entry.item.name} (${entry.spicePreference}, ${entry.portionStyle}) — ₹${
          entry.unitPriceInr * entry.quantity
        }`,
    );
    const locationLine =
      fulfillmentType === 'Delivery'
        ? `Delivery Address: ${deliveryAddress.trim()}`
        : `Pickup / Dine-in Note: ${
            deliveryAddress.trim() || 'Madhuravada Flagship Pickup'
          }`;

    const message = [
      `Namaskaram Andhra Ruchulu! New Order #${orderId}`,
      `Customer: ${customerName.trim()} (${cleanPhone})`,
      `Order Type: ${fulfillmentType}`,
      locationLine,
      '',
      ...summaryLines,
      '',
      `Total (incl. 5% GST): ₹${grandTotal}`,
    ].join('\n');

    return `https://wa.me/${OWNER_WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
  };

  const submitOrder = async (openWhatsAppAfter: boolean) => {
    if (items.length === 0 || isSubmitting) return;
    if (!validateCheckout()) return;

    setIsSubmitting(true);
    setErrors({});

    const cleanPhone = normalizePhoneDigits(customerPhone);

    const finalizeSuccess = (orderId: string, totalAmountInr: number) => {
      const whatsappUrl = buildOrderWhatsAppUrl(orderId, cleanPhone);

      if (openWhatsAppAfter) {
        window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
      }

      setPlacedOrder({
        id: orderId,
        totalAmountInr,
        customerName: customerName.trim(),
        fulfillmentType,
        whatsappUrl,
      });

      onClearCart();
      setCustomerName('');
      setCustomerPhone('');
      setDeliveryAddress('');
      onShowToast(
        `Order Placed · #${orderId}`,
        'Your order has been sent to the Andhra Ruchulu kitchen.',
      );
    };

    try {
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: customerName.trim(),
          customerPhone: cleanPhone,
          fulfillmentType,
          deliveryAddress: deliveryAddress.trim(),
          items: items.map((entry) => ({
            itemId: entry.item.id,
            quantity: entry.quantity,
            spicePreference: entry.spicePreference,
            portionStyle: entry.portionStyle,
            notes: entry.notes,
          })),
        }),
      });

      const contentType = response.headers.get('content-type') || '';
      if (response.status === 404 || !contentType.includes('application/json')) {
        const localSaved = localOrdersService.createOrder({
          customerName,
          customerPhone: cleanPhone,
          fulfillmentType,
          deliveryAddress,
          cartItems: items,
        });
        finalizeSuccess(localSaved.id, localSaved.totalAmountInr);
        return;
      }

      const data = (await response.json()) as {
        order?: { id: string; totalAmountInr: number };
        error?: string;
      };

      if (!response.ok || !data.order) {
        setErrors({
          submit: data.error || 'Could not submit order. Please try again.',
        });
        return;
      }

      finalizeSuccess(data.order.id, data.order.totalAmountInr);
    } catch {
      const localSaved = localOrdersService.createOrder({
        customerName,
        customerPhone: cleanPhone,
        fulfillmentType,
        deliveryAddress,
        cartItems: items,
      });
      finalizeSuccess(localSaved.id, localSaved.totalAmountInr);
    } finally {
      setIsSubmitting(false);
    }
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
          onClick={handleClose}
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
                onClick={handleClose}
                aria-label="Close order drawer"
                className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border border-white/12 text-[#94A3B8] transition-colors hover:border-white/25 hover:text-[#F8FAFC]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Body */}
            <div className="my-4 flex-1 overflow-y-auto pr-1">
              {placedOrder ? (
                <div className="flex h-full flex-col items-center justify-center rounded-2xl border border-[#10B981]/30 bg-[#10B981]/[0.06] p-6 text-center">
                  <CheckCircle2 className="h-10 w-10 text-[#10B981]" aria-hidden="true" />
                  <h3 className="mt-4 font-serif text-2xl font-semibold text-[#F8FAFC]">
                    Order <span className="font-sans tabular-nums">#{placedOrder.id}</span> Confirmed
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-[#94A3B8]">
                    Thank you, {placedOrder.customerName}. Your{' '}
                    {placedOrder.fulfillmentType.toLowerCase()} order for{' '}
                    <span className="font-semibold text-[#F59E0B] tabular-nums">
                      ₹{placedOrder.totalAmountInr}
                    </span>{' '}
                    has been received by our kitchen.
                  </p>

                  <div className="mt-6 flex w-full flex-col gap-2.5">
                    <a
                      href={placedOrder.whatsappUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-[#10B981] px-5 py-2.5 text-xs font-semibold text-[#0B0C10] transition-colors hover:bg-[#34D399]"
                    >
                      <MessageCircle className="h-4 w-4" aria-hidden="true" />
                      <span>Send Copy on WhatsApp</span>
                    </a>
                    <button
                      type="button"
                      onClick={handleClose}
                      className="min-h-[44px] w-full cursor-pointer rounded-xl bg-[#F59E0B] px-6 py-2.5 text-xs font-semibold text-[#0B0C10]"
                    >
                      Return to Menu
                    </button>
                  </div>
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
                <div className="space-y-5">
                  <ul className="space-y-3.5">
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

                  {/* Customer Order Details */}
                  <div className="space-y-3 border-t border-white/10 pt-4">
                    <p className="text-xs font-semibold tracking-wide text-[#F59E0B]">
                      Guest &amp; Fulfillment Details
                    </p>

                    <div
                      role="radiogroup"
                      aria-label="Order fulfillment type"
                      className="grid grid-cols-2 gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-1"
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setFulfillmentType('Delivery');
                          setErrors((prev) => ({ ...prev, deliveryAddress: undefined }));
                        }}
                        className={`inline-flex min-h-[38px] cursor-pointer items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                          fulfillmentType === 'Delivery'
                            ? 'bg-[#F59E0B] text-[#0B0C10]'
                            : 'text-[#94A3B8] hover:text-[#F8FAFC]'
                        }`}
                      >
                        <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Delivery</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setFulfillmentType('Pickup');
                          setErrors((prev) => ({ ...prev, deliveryAddress: undefined }));
                        }}
                        className={`inline-flex min-h-[38px] cursor-pointer items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                          fulfillmentType === 'Pickup'
                            ? 'bg-[#F59E0B] text-[#0B0C10]'
                            : 'text-[#94A3B8] hover:text-[#F8FAFC]'
                        }`}
                      >
                        <Store className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Pickup</span>
                      </button>
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div>
                        <label
                          htmlFor="cart-name"
                          className="block text-[11px] font-medium text-[#94A3B8]"
                        >
                          Your Name *
                        </label>
                        <input
                          id="cart-name"
                          name="customerName"
                          type="text"
                          autoComplete="name"
                          value={customerName}
                          onChange={(e) => {
                            setCustomerName(e.target.value);
                            if (errors.customerName) {
                              setErrors((prev) => ({ ...prev, customerName: undefined }));
                            }
                          }}
                          placeholder="Ananya Rao"
                          className="glass-input mt-1 h-10 w-full rounded-xl px-3 text-xs text-[#F8FAFC] placeholder:text-[#94A3B8]/45"
                        />
                        {errors.customerName && (
                          <p className="mt-1 text-[11px] text-[#DC2626]">
                            {errors.customerName}
                          </p>
                        )}
                      </div>

                      <div>
                        <label
                          htmlFor="cart-phone"
                          className="block text-[11px] font-medium text-[#94A3B8]"
                        >
                          Phone (10 digits) *
                        </label>
                        <input
                          id="cart-phone"
                          name="customerPhone"
                          type="tel"
                          inputMode="numeric"
                          autoComplete="tel"
                          maxLength={16}
                          value={customerPhone}
                          onChange={(e) => {
                            const digits = normalizePhoneDigits(e.target.value);
                            setCustomerPhone(digits);
                            if (errors.customerPhone) {
                              setErrors((prev) => ({ ...prev, customerPhone: undefined }));
                            }
                          }}
                          placeholder="9849000000"
                          className="glass-input mt-1 h-10 w-full rounded-xl px-3 text-xs text-[#F8FAFC] tabular-nums placeholder:text-[#94A3B8]/45"
                        />
                        {errors.customerPhone && (
                          <p className="mt-1 text-[11px] text-[#DC2626]">
                            {errors.customerPhone}
                          </p>
                        )}
                      </div>
                    </div>

                    <div>
                      <label
                        htmlFor="cart-address"
                        className="block text-[11px] font-medium text-[#94A3B8]"
                      >
                        {fulfillmentType === 'Delivery'
                          ? 'Delivery Address *'
                          : 'Pickup Time / Table Note (Optional)'}
                      </label>
                      <textarea
                        id="cart-address"
                        name="deliveryAddress"
                        autoComplete={
                          fulfillmentType === 'Delivery' ? 'street-address' : 'off'
                        }
                        rows={2}
                        value={deliveryAddress}
                        onChange={(e) => {
                          setDeliveryAddress(e.target.value);
                          if (errors.deliveryAddress) {
                            setErrors((prev) => ({ ...prev, deliveryAddress: undefined }));
                          }
                        }}
                        placeholder={
                          fulfillmentType === 'Delivery'
                            ? 'Flat 302, MVP Colony / Madhuravada, Visakhapatnam'
                            : 'Picking up at 8:00 PM at Madhuravada flagship'
                        }
                        className="glass-input mt-1 w-full rounded-xl px-3 py-2 text-xs text-[#F8FAFC] placeholder:text-[#94A3B8]/45"
                      />
                      {errors.deliveryAddress && (
                        <p className="mt-1 text-[11px] text-[#DC2626]">
                          {errors.deliveryAddress}
                        </p>
                      )}
                    </div>

                    {errors.submit && (
                      <p role="alert" className="text-xs font-medium text-[#DC2626]">
                        {errors.submit}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Footer Totals & Checkout Actions */}
            {items.length > 0 && !placedOrder && (
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
                    disabled={isSubmitting}
                    onClick={() => submitOrder(false)}
                    className="inline-flex min-h-[44px] w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-[#F59E0B] px-5 py-3 text-sm font-semibold text-[#0B0C10] transition-colors hover:bg-[#FBBF24] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isSubmitting && (
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    )}
                    <span>Confirm &amp; Place Order</span>
                  </button>

                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => submitOrder(true)}
                    className="inline-flex min-h-[44px] w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-[#10B981]/35 bg-[#10B981]/10 px-5 py-2.5 text-xs font-semibold text-[#10B981] transition-colors hover:bg-[#10B981]/20 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <MessageCircle className="h-4 w-4" aria-hidden="true" />
                    <span>Place Order &amp; Send on WhatsApp</span>
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
