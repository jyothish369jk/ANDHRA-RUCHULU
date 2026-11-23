import { useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useScroll, useTransform } from 'motion/react';
import { Flame, Plus, SlidersHorizontal } from 'lucide-react';
import { MENU_CATEGORIES, MENU_ITEMS } from '../data/menuData';
import type { DietaryType, MenuCategory, MenuItem } from '../types/restaurant';
import { FoodImage, TiltGlassCard } from './InteractivePrimitives';

interface MenuSectionProps {
  onQuickAdd: (item: MenuItem) => void;
  onCustomizeItem: (item: MenuItem) => void;
}

export function MenuSection({ onQuickAdd, onCustomizeItem }: MenuSectionProps) {
  const sectionRef = useRef<HTMLElement | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<MenuCategory>('All');
  const [dietaryFilter, setDietaryFilter] = useState<'All' | DietaryType>('All');

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ['start end', 'end start'],
  });
  const headerParallaxY = useTransform(scrollYProgress, [0, 0.5], [18, 0]);

  const filteredItems = useMemo(() => {
    return MENU_ITEMS.filter((item) => {
      const matchesCategory = selectedCategory === 'All' || item.category === selectedCategory;
      const matchesDietary = dietaryFilter === 'All' || item.dietary === dietaryFilter;
      return matchesCategory && matchesDietary;
    });
  }, [selectedCategory, dietaryFilter]);

  return (
    <section
      ref={sectionRef}
      id="menu"
      className="relative z-10 mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-28"
    >
      {/* Section Header */}
      <motion.div
        style={{ y: headerParallaxY }}
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="flex flex-col gap-6 will-change-transform lg:flex-row lg:items-end lg:justify-between"
      >
        <div>
          <p className="text-sm font-medium text-[#F59E0B]">Curated Tasting Menu</p>
          <h2
            className="text-balance mt-2 font-serif font-semibold tracking-tight text-[#F8FAFC]"
            style={{ fontSize: 'clamp(2rem, 3.6vw, 3.15rem)', lineHeight: 1.08 }}
          >
            Signatures of the Krishna &amp; Godavari Delta
          </h2>
        </div>

        {/* Dietary Filter Toggle */}
        <div
          role="group"
          aria-label="Filter by dietary preference"
          className="glass-panel inline-flex w-fit items-center gap-1 rounded-xl p-1"
        >
          {(['All', 'Veg', 'Non-Veg'] as const).map((diet) => {
            const active = dietaryFilter === diet;
            return (
              <button
                key={diet}
                type="button"
                onClick={() => setDietaryFilter(diet)}
                className={`min-h-[38px] cursor-pointer rounded-lg px-3.5 py-1.5 text-xs font-medium whitespace-nowrap transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F59E0B] ${
                  active
                    ? 'bg-white/12 text-[#F8FAFC]'
                    : 'text-[#94A3B8] hover:text-[#F8FAFC]'
                }`}
              >
                {diet}
              </button>
            );
          })}
        </div>
      </motion.div>

      {/* Floating Glass Category Filter Bar (Smooth mobile horizontal swipe) */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: 0.5, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
        className="no-scrollbar mt-8 overflow-x-auto pb-2 [webkit-overflow-scrolling:touch]"
      >
        <div
          role="tablist"
          aria-label="Menu categories"
          className="glass-panel inline-flex min-w-max snap-x snap-mandatory items-center gap-1.5 rounded-2xl p-1.5"
        >
          {MENU_CATEGORIES.map((category) => {
            const isActive = selectedCategory === category;
            return (
              <button
                key={category}
                role="tab"
                aria-selected={isActive}
                type="button"
                onClick={() => setSelectedCategory(category)}
                className={`relative min-h-[40px] shrink-0 snap-start cursor-pointer rounded-xl px-4 py-2 text-xs font-medium whitespace-nowrap transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F59E0B] sm:text-sm ${
                  isActive ? 'text-[#0B0C10]' : 'text-[#94A3B8] hover:text-[#F8FAFC]'
                }`}
              >
                {isActive && (
                  <motion.span
                    layoutId="menuCategoryPill"
                    transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                    className="absolute inset-0 z-0 rounded-xl bg-[#F59E0B]"
                  />
                )}
                <span className="relative z-10">{category}</span>
              </button>
            );
          })}
        </div>
      </motion.div>

      {/* Menu Grid */}
      {filteredItems.length === 0 ? (
        <div className="glass-panel mt-10 flex flex-col items-center justify-center rounded-2xl p-12 text-center">
          <p className="font-serif text-2xl text-[#F8FAFC]">No dishes match this filter</p>
          <p className="mt-2 text-sm text-[#94A3B8]">
            Reset the dietary selection to view all dishes in {selectedCategory}.
          </p>
          <button
            type="button"
            onClick={() => {
              setSelectedCategory('All');
              setDietaryFilter('All');
            }}
            className="mt-5 min-h-[44px] cursor-pointer rounded-xl bg-[#F59E0B] px-5 py-2.5 text-xs font-semibold text-[#0B0C10]"
          >
            Show All Dishes
          </button>
        </div>
      ) : (
        <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 lg:gap-8">
          <AnimatePresence mode="popLayout">
            {filteredItems.map((dish, idx) => (
              <motion.article
                key={dish.id}
                layout="position"
                initial={{ opacity: 0, y: 22 }}
                whileInView={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96 }}
                viewport={{ once: true, amount: 0.12 }}
                transition={{
                  duration: 0.45,
                  delay: Math.min((idx % 3) * 0.06, 0.18),
                  ease: [0.16, 1, 0.3, 1],
                }}
                className="flex will-change-transform"
              >
                <TiltGlassCard maxTilt={5} className="flex w-full flex-col justify-between p-4">
                  <div>
                    {/* Consistent 4:3 Photography Container */}
                    <div className="group relative aspect-[4/3] w-full overflow-hidden rounded-xl bg-[#14110F]">
                      <FoodImage
                        src={dish.image}
                        alt={`${dish.name} — ${dish.teluguSubtitle}`}
                        titleFallback={dish.name}
                        className="group-hover:scale-105"
                      />
                      <div
                        aria-hidden="true"
                        className="absolute inset-0 bg-gradient-to-t from-[#0B0C10]/70 via-transparent to-transparent"
                      />
                    </div>

                    {/* Unboxed Clean Metadata Line */}
                    <div className="mt-4 flex items-center justify-between gap-3 text-xs text-[#94A3B8]">
                      <div className="flex items-center gap-2">
                        {/* Standard Indian Culinary Veg / Non-Veg Geometric Mark + Text */}
                        <span
                          className={`inline-flex h-3.5 w-3.5 items-center justify-center rounded-[3px] border ${
                            dish.dietary === 'Veg'
                              ? 'border-[#10B981]'
                              : 'border-[#DC2626]'
                          }`}
                          aria-hidden="true"
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${
                              dish.dietary === 'Veg' ? 'bg-[#10B981]' : 'bg-[#DC2626]'
                            }`}
                          />
                        </span>
                        <span>{dish.dietary}</span>
                        <span aria-hidden="true">·</span>
                        <span>{dish.region}</span>
                      </div>

                      {/* Spice Level Indicator */}
                      <div
                        className="flex items-center gap-1"
                        title={`Spice level: ${dish.spiceLabel}`}
                      >
                        {Array.from({ length: 3 }).map((_, idx) => (
                          <Flame
                            key={idx}
                            className={`h-3.5 w-3.5 ${
                              idx < dish.spiceLevel
                                ? 'fill-[#DC2626]/80 text-[#DC2626]'
                                : 'text-white/15'
                            }`}
                            aria-hidden="true"
                          />
                        ))}
                        <span className="ml-1 text-[11px] text-[#94A3B8]">
                          {dish.spiceLabel}
                        </span>
                      </div>
                    </div>

                    {/* Dish Title & Price Baseline */}
                    <div className="mt-2.5 flex items-baseline justify-between gap-4">
                      <h3 className="font-serif text-2xl font-semibold text-[#F8FAFC]">
                        {dish.name}
                      </h3>
                      <span className="shrink-0 text-base font-semibold text-[#F59E0B] tabular-nums">
                        ₹{dish.priceInr}
                      </span>
                    </div>

                    <p className="mt-1 text-xs font-medium text-[#94A3B8]/80">
                      {dish.teluguSubtitle}
                    </p>

                    <p className="mt-3 text-sm leading-relaxed text-[#94A3B8]">
                      {dish.description}
                    </p>
                  </div>

                  {/* Interactive Actions: Quick Add & Customize */}
                  <div className="mt-6 flex items-center gap-2.5 border-t border-white/10 pt-4">
                    <button
                      type="button"
                      onClick={() => onQuickAdd(dish)}
                      className="inline-flex min-h-[42px] flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-[#F59E0B] px-4 py-2 text-xs font-semibold text-[#0B0C10] whitespace-nowrap transition-colors duration-200 hover:bg-[#FBBF24] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F59E0B]"
                    >
                      <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Add to Order</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => onCustomizeItem(dish)}
                      aria-label={`Customize ${dish.name}`}
                      className="inline-flex min-h-[42px] shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-white/12 bg-white/[0.04] px-3.5 py-2 text-xs font-medium text-[#F8FAFC] whitespace-nowrap transition-colors duration-200 hover:border-white/25 hover:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F59E0B]"
                    >
                      <SlidersHorizontal className="h-3.5 w-3.5 text-[#F59E0B]" aria-hidden="true" />
                      <span>Customize</span>
                    </button>
                  </div>
                </TiltGlassCard>
              </motion.article>
            ))}
          </AnimatePresence>
        </div>
      )}
    </section>
  );
}
