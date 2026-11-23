import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Menu, ShoppingBag, Sparkles, X } from 'lucide-react';
import { BrandEmblem } from './InteractivePrimitives';

export type NavSectionId = 'home' | 'menu' | 'story' | 'contact';

interface NavbarProps {
  activeSection: NavSectionId;
  cartCount: number;
  onNavigate: (section: NavSectionId) => void;
  onOpenCart: () => void;
  onOpenFutureWidget: () => void;
}

const NAV_ITEMS: Array<{ id: NavSectionId; label: string }> = [
  { id: 'home', label: 'Home' },
  { id: 'menu', label: 'Menu' },
  { id: 'story', label: 'Story' },
  { id: 'contact', label: 'Contact' },
];

export function Navbar({
  activeSection,
  cartCount,
  onNavigate,
  onOpenCart,
  onOpenFutureWidget,
}: NavbarProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleNavClick = (id: NavSectionId) => {
    setMobileMenuOpen(false);
    onNavigate(id);
  };

  return (
    <>
      <header className="sticky top-3 z-40 mx-auto w-full max-w-6xl px-4 sm:px-6">
        <div className="glass-panel-elevated flex h-14 items-center justify-between gap-4 rounded-full px-4 sm:h-16 sm:gap-8 sm:px-6">
          {/* Zone 1: Single-line Brand Wordmark + Custom SVG Emblem */}
          <a
            href="#home"
            onClick={(e) => {
              e.preventDefault();
              handleNavClick('home');
            }}
            className="flex shrink-0 items-center gap-2.5 whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F59E0B] focus-visible:rounded-full"
          >
            <BrandEmblem className="h-7 w-7 shrink-0" />
            <span className="font-serif text-base font-semibold tracking-[0.14em] text-[#F8FAFC] uppercase whitespace-nowrap sm:text-lg">
              Andhra Ruchulu
            </span>
          </a>

          {/* Zone 2: Center Smooth-Scrolling Navigation with Sliding Pill Indicator */}
          <nav
            aria-label="Primary navigation"
            className="hidden items-center gap-1 md:flex"
          >
            {NAV_ITEMS.map((item) => {
              const isActive = activeSection === item.id;
              return (
                <a
                  key={item.id}
                  href={`#${item.id}`}
                  onClick={(e) => {
                    e.preventDefault();
                    handleNavClick(item.id);
                  }}
                  className={`relative shrink-0 rounded-full px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F59E0B] ${
                    isActive ? 'text-[#F8FAFC]' : 'text-[#94A3B8] hover:text-[#F8FAFC]'
                  }`}
                >
                  {isActive && (
                    <motion.span
                      layoutId="activeNavIndicator"
                      transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                      className="absolute inset-0 -z-10 rounded-full border border-white/15 bg-white/[0.08]"
                    />
                  )}
                  {item.label}
                </a>
              );
            })}
          </nav>

          {/* Zone 3: Primary CTA + Cart Trigger + Reserved Future Integration Slot */}
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            {/* TODO: Mount upcoming AI Sommelier / Concierge integration widget here */}
            <button
              id="future-ai-widget-trigger"
              type="button"
              onClick={onOpenFutureWidget}
              title="Pairing & Spice Guide (Integration Slot)"
              aria-label="Open spice pairing guide integration slot"
              data-integration-slot="future-ai-widget"
              className="hidden h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full border border-white/12 bg-white/[0.03] text-[#94A3B8] transition-colors duration-200 hover:border-[#F59E0B]/40 hover:text-[#F59E0B] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F59E0B] sm:inline-flex"
            >
              <Sparkles className="h-4 w-4" aria-hidden="true" />
            </button>

            <button
              type="button"
              onClick={onOpenCart}
              aria-label={`Open order drawer, ${cartCount} items`}
              className="relative inline-flex h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-full border border-white/12 bg-white/[0.04] px-3 text-xs font-medium text-[#F8FAFC] whitespace-nowrap transition-colors duration-200 hover:border-white/25 hover:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F59E0B]"
            >
              <ShoppingBag className="h-3.5 w-3.5 text-[#F59E0B]" aria-hidden="true" />
              <span className="tabular-nums">{cartCount}</span>
            </button>

            <button
              type="button"
              onClick={() => handleNavClick('contact')}
              className="hidden h-9 shrink-0 cursor-pointer items-center justify-center rounded-full bg-[#F59E0B] px-4 text-xs font-semibold text-[#0B0C10] whitespace-nowrap transition-colors duration-200 hover:bg-[#FBBF24] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F59E0B] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0B0C10] sm:inline-flex"
            >
              Reserve Table
            </button>

            <button
              type="button"
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
              aria-expanded={mobileMenuOpen}
              className="inline-flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full border border-white/12 bg-white/[0.04] text-[#F8FAFC] transition-colors hover:border-white/25 md:hidden"
            >
              {mobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </header>

      {/* Glass Mobile Navigation Drawer */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 bg-black/65 backdrop-blur-md md:hidden"
            onClick={() => setMobileMenuOpen(false)}
          >
            <motion.aside
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', stiffness: 320, damping: 32 }}
              onClick={(e) => e.stopPropagation()}
              className="glass-panel-elevated ml-auto flex h-full w-72 flex-col justify-between p-6"
            >
              <div>
                <div className="flex items-center justify-between border-b border-white/10 pb-4">
                  <div className="flex items-center gap-2">
                    <BrandEmblem className="h-6 w-6" />
                    <span className="font-serif text-base font-semibold tracking-widest text-[#F8FAFC] uppercase">
                      Andhra Ruchulu
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setMobileMenuOpen(false)}
                    aria-label="Close mobile drawer"
                    className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border border-white/12 text-[#94A3B8] hover:text-[#F8FAFC]"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <nav className="mt-8 flex flex-col gap-2" aria-label="Mobile navigation">
                  {NAV_ITEMS.map((item) => {
                    const isActive = activeSection === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleNavClick(item.id)}
                        className={`flex min-h-[44px] w-full cursor-pointer items-center justify-between rounded-xl px-4 py-3 text-left text-base font-medium transition-colors ${
                          isActive
                            ? 'border border-[#F59E0B]/30 bg-[#F59E0B]/10 text-[#F8FAFC]'
                            : 'text-[#94A3B8] hover:bg-white/[0.04] hover:text-[#F8FAFC]'
                        }`}
                      >
                        <span>{item.label}</span>
                        {isActive && <span className="text-xs text-[#F59E0B]">Active</span>}
                      </button>
                    );
                  })}
                </nav>
              </div>

              <div className="flex flex-col gap-3 border-t border-white/10 pt-5">
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onOpenFutureWidget();
                  }}
                  className="flex min-h-[44px] w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-white/12 bg-white/[0.04] px-4 py-2.5 text-sm font-medium text-[#F8FAFC]"
                >
                  <Sparkles className="h-4 w-4 text-[#F59E0B]" />
                  <span>Spice Pairing Guide</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleNavClick('contact')}
                  className="flex min-h-[44px] w-full cursor-pointer items-center justify-center rounded-xl bg-[#F59E0B] px-4 py-2.5 text-sm font-semibold text-[#0B0C10]"
                >
                  Reserve Table
                </button>
              </div>
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
