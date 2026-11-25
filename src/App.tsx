/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, MotionConfig, motion, useScroll, useSpring } from 'motion/react';
import { CheckCircle2, X } from 'lucide-react';
import { AmbientSpiceCanvas } from './components/AmbientSpiceCanvas';
import { CartDrawer } from './components/CartDrawer';
import { ContactSection } from './components/ContactSection';
import { CustomizeModal } from './components/CustomizeModal';
import { Footer } from './components/Footer';
import { HeroSection } from './components/HeroSection';
import { MenuSection } from './components/MenuSection';
import { MyBookingsModal } from './components/MyBookingsModal';
import { Navbar, type NavSectionId } from './components/Navbar';
import { OwnerPortalPage } from './components/OwnerPortalPage';
import { ReviewsSection } from './components/ReviewsSection';
import { StorySection } from './components/StorySection';
import type {
  CartItem,
  MenuItem,
  PortionStyle,
  SpicePreference,
  TableBooking,
} from './types/restaurant';
import {
  appendMyBookingToStorage,
  BOOKINGS_STORAGE_KEY,
  BOOKINGS_UPDATED_EVENT,
  loadMyBookingsFromStorage,
  removeMyBookingFromStorage,
} from './utils/reservationsStorage';

interface ToastState {
  id: number;
  title: string;
  description: string;
}

export default function App() {
  const [isAdminRoute, setIsAdminRoute] = useState<boolean>(() =>
    window.location.pathname.replace(/\/+$/, '') === '/admin',
  );
  const [activeSection, setActiveSection] = useState<NavSectionId>('home');
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [customizingDish, setCustomizingDish] = useState<MenuItem | null>(null);
  const [myBookingsOpen, setMyBookingsOpen] = useState(false);
  const [bookings, setBookings] = useState<TableBooking[]>(() => loadMyBookingsFromStorage());
  const [mapsQuotaExceeded, setMapsQuotaExceeded] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const syncBookings = () => {
      setBookings(loadMyBookingsFromStorage());
    };
    const handleStorage = (event: StorageEvent) => {
      if (!event.key || event.key === BOOKINGS_STORAGE_KEY) {
        syncBookings();
      }
    };
    window.addEventListener(BOOKINGS_UPDATED_EVENT, syncBookings);
    window.addEventListener('storage', handleStorage);
    return () => {
      window.removeEventListener(BOOKINGS_UPDATED_EVENT, syncBookings);
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  useEffect(() => {
    const syncRoute = () => {
      setIsAdminRoute(window.location.pathname.replace(/\/+$/, '') === '/admin');
    };
    window.addEventListener('popstate', syncRoute);
    return () => window.removeEventListener('popstate', syncRoute);
  }, []);

  const navigateRoute = useCallback((targetPath: '/' | '/admin') => {
    const normalizedCurrent = window.location.pathname.replace(/\/+$/, '') || '/';
    if (normalizedCurrent !== targetPath) {
      window.history.pushState({}, '', targetPath);
    }
    setIsAdminRoute(targetPath === '/admin');
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, []);

  useEffect(() => {
    const handleQuotaExceeded = () => setMapsQuotaExceeded(true);
    window.addEventListener('gmp-quota-exceeded', handleQuotaExceeded);
    return () => window.removeEventListener('gmp-quota-exceeded', handleQuotaExceeded);
  }, []);

  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 180,
    damping: 28,
    restDelta: 0.001,
  });

  const showToast = useCallback((title: string, description: string) => {
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
    }
    setToast({ id: Date.now(), title, description });
    toastTimerRef.current = window.setTimeout(() => {
      setToast(null);
    }, 4200);
  }, []);

  useEffect(() => {
    if (isAdminRoute) return;
    const sectionIds: NavSectionId[] = ['home', 'menu', 'story', 'reviews', 'contact'];
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id as NavSectionId);
          }
        }
      },
      { rootMargin: '-25% 0px -55% 0px', threshold: 0.02 },
    );

    for (const id of sectionIds) {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    }

    return () => observer.disconnect();
  }, [isAdminRoute]);

  const scrollToSection = useCallback((section: NavSectionId) => {
    setActiveSection(section);
    const el = document.getElementById(section);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);

  const addDishToCart = useCallback(
    (
      dish: MenuItem,
      spicePreference: SpicePreference,
      portionStyle: PortionStyle,
      notes = '',
    ) => {
      const unitPriceInr = dish.priceInr + (portionStyle.includes('180') ? 180 : 0);
      const cartKey = `${dish.id}__${spicePreference}__${portionStyle}__${notes.trim()}`;

      setCartItems((prev) => {
        const existing = prev.find((item) => item.cartKey === cartKey);
        if (existing) {
          return prev.map((item) =>
            item.cartKey === cartKey ? { ...item, quantity: item.quantity + 1 } : item,
          );
        }
        return [
          ...prev,
          {
            cartKey,
            item: dish,
            quantity: 1,
            spicePreference,
            portionStyle,
            unitPriceInr,
            notes: notes.trim() || undefined,
          },
        ];
      });

      showToast(`Added ${dish.name}`, `${spicePreference} · ${portionStyle}`);
    },
    [showToast],
  );

  const handleQuickAdd = useCallback(
    (dish: MenuItem) => {
      const defaultSpice: SpicePreference =
        dish.spiceLevel === 3 ? 'Fiery Guntur' : 'Authentic Andhra';
      addDishToCart(dish, defaultSpice, 'Signature Plate');
      setCartOpen(true);
    },
    [addDishToCart],
  );

  const handleConfirmCustomizedAdd = useCallback(
    (
      dish: MenuItem,
      spicePreference: SpicePreference,
      portionStyle: PortionStyle,
      notes: string,
    ) => {
      addDishToCart(dish, spicePreference, portionStyle, notes);
      setCustomizingDish(null);
      setCartOpen(true);
    },
    [addDishToCart],
  );

  const handleUpdateQty = useCallback((cartKey: string, delta: number) => {
    setCartItems((prev) =>
      prev
        .map((entry) =>
          entry.cartKey === cartKey ? { ...entry, quantity: entry.quantity + delta } : entry,
        )
        .filter((entry) => entry.quantity > 0),
    );
  }, []);

  const handleRemoveItem = useCallback((cartKey: string) => {
    setCartItems((prev) => prev.filter((entry) => entry.cartKey !== cartKey));
  }, []);

  const handleBookingCreated = useCallback((newBooking: TableBooking) => {
    const updated = appendMyBookingToStorage(newBooking);
    setBookings(updated);
  }, []);

  const handleRemoveMyBooking = useCallback((id: string) => {
    const updated = removeMyBookingFromStorage(id);
    setBookings(updated);
  }, []);

  const openMyBookings = useCallback(() => {
    setBookings(loadMyBookingsFromStorage());
    setMyBookingsOpen(true);
  }, []);

  const totalItemCount = cartItems.reduce((sum, entry) => sum + entry.quantity, 0);

  return (
    <MotionConfig reducedMotion="user">
      <div className="relative min-h-screen bg-[#0B0C10] text-[#F8FAFC]">
        {mapsQuotaExceeded && (
          <div className="sticky top-0 z-50 border-b border-amber-200 bg-amber-50 px-4 py-2.5 text-center text-xs text-amber-900 shadow-sm md:text-sm">
            <span>
              Google Maps Platform quota reached. If you are the app owner, visit{' '}
              <a
                href="https://developers.google.com/maps/ai/ai-studio?utm_campaign=gmp_mcp_codeassist_v1_aistudio#quota_exceeded_errors"
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-amber-950 underline hover:text-amber-800"
              >
                maps developer site
              </a>{' '}
              for instructions to update your account.
            </span>
          </div>
        )}

        {/* Top Scroll Progress Ribbon */}
        <motion.div
          aria-hidden="true"
          style={{ scaleX }}
          className="pointer-events-none fixed inset-x-0 top-0 z-50 h-[2px] origin-left bg-gradient-to-r from-[#F59E0B] via-[#DC2626] to-[#F59E0B]"
        />

        <AmbientSpiceCanvas />

        {isAdminRoute ? (
          <OwnerPortalPage
            onBackToSite={() => navigateRoute('/')}
            onShowToast={showToast}
          />
        ) : (
          <>
            <Navbar
              activeSection={activeSection}
              cartCount={totalItemCount}
              bookingsCount={bookings.length}
              onNavigate={scrollToSection}
              onOpenCart={() => setCartOpen(true)}
              onOpenMyBookings={openMyBookings}
              onOpenAdmin={() => navigateRoute('/admin')}
            />

            <main>
              <HeroSection
                onExploreMenu={() => scrollToSection('menu')}
                onBookTable={() => scrollToSection('contact')}
              />
              <MenuSection
                onQuickAdd={handleQuickAdd}
                onCustomizeItem={(dish) => setCustomizingDish(dish)}
              />
              <StorySection />
              <ReviewsSection />
              <ContactSection
                onShowToast={showToast}
                onBookingCreated={handleBookingCreated}
                onOpenMyBookings={openMyBookings}
              />
            </main>

            <Footer
              onNavigate={scrollToSection}
              onOpenAdmin={() => navigateRoute('/admin')}
            />

            <CartDrawer
              isOpen={cartOpen}
              items={cartItems}
              onClose={() => setCartOpen(false)}
              onUpdateQty={handleUpdateQty}
              onRemoveItem={handleRemoveItem}
              onClearCart={() => setCartItems([])}
              onShowToast={showToast}
            />

            <CustomizeModal
              dish={customizingDish}
              onClose={() => setCustomizingDish(null)}
              onConfirmAdd={handleConfirmCustomizedAdd}
            />

            <MyBookingsModal
              isOpen={myBookingsOpen}
              bookings={bookings}
              onClose={() => setMyBookingsOpen(false)}
              onReserveNow={() => scrollToSection('contact')}
              onRemoveBooking={handleRemoveMyBooking}
              onShowToast={showToast}
            />
          </>
        )}

        {/* Interactive Toast Notification */}
        <AnimatePresence>
          {toast && (
            <motion.div
              key={toast.id}
              role="status"
              aria-live="polite"
              initial={{ opacity: 0, y: 20, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.96 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              className="glass-panel-elevated fixed right-4 bottom-5 z-50 flex w-[calc(100%-2rem)] max-w-sm items-start gap-3 rounded-2xl p-4 sm:right-6 sm:bottom-6"
            >
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[#10B981]" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-[#F8FAFC]">{toast.title}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-[#94A3B8]">
                  {toast.description}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setToast(null)}
                aria-label="Dismiss notification"
                className="cursor-pointer text-[#94A3B8] hover:text-[#F8FAFC]"
              >
                <X className="h-4 w-4" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </MotionConfig>
  );
}
