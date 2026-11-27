import React, { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ChevronDown, ShoppingBag, Sparkles, X } from 'lucide-react';
import { MENU_ITEMS } from '../data/menuData';
import type {
  MenuItem,
  PortionStyle,
  SpicePreference,
} from '../types/restaurant';

export type ConciergeMoodId =
  | 'fiery-guntur'
  | 'royal-biryani'
  | 'veg-feast'
  | 'coastal-spice';

export interface PairingCourseOrder {
  dish: MenuItem;
  courseLabel: string;
  quantity: number;
  spicePreference: SpicePreference;
  portionStyle: PortionStyle;
}

interface CulinaryConciergeSectionProps {
  onAddPairingToCart: (
    courses: PairingCourseOrder[],
    moodTitle: string,
    totalInr: number,
  ) => void;
}

type SimpleSpiceLevel = 'Mild' | 'Medium' | 'Andhra Hot';

interface MoodConfig {
  id: ConciergeMoodId;
  chipLabel: string;
  comboTitle: string;
  chefNote: string;
  defaultSpice: SimpleSpiceLevel;
  courseIds: [string, string, string];
  taste: {
    spice: number;
    richness: number;
    aroma: number;
  };
}

const SPICE_LEVELS: Array<{
  label: SimpleSpiceLevel;
  preference: SpicePreference;
  delta: number;
}> = [
  { label: 'Mild', preference: 'Mild Temper', delta: -18 },
  { label: 'Medium', preference: 'Authentic Andhra', delta: 0 },
  { label: 'Andhra Hot', preference: 'Fiery Guntur', delta: 16 },
];

const COOLING_DRINK: MenuItem = {
  id: 'nimmakaya-majjiga',
  name: 'Spiced Nimmakaya Majjiga',
  teluguSubtitle: 'Chilled Tempered Buttermilk',
  category: 'Traditional Sweets',
  description:
    'Churned coastal buttermilk tempered with ginger, curry leaves, and roasted cumin.',
  priceInr: 140,
  dietary: 'Veg',
  spiceLevel: 1,
  spiceLabel: 'Cooling',
  region: 'Coastal Andhra',
  image: '/src/assets/images/story_claypot_spices_1794933152141.jpg',
  pairingNote: 'Cooling finish to balance rich Andhra spices.',
};

const CRISPY_STARTER_VEG: MenuItem = {
  id: 'punugulu-bites',
  name: 'Vijayawada Crispy Punugulu',
  teluguSubtitle: 'Crisp Lentil Fritters & Ginger Chutney',
  category: 'Starters (Vepudu)',
  description:
    'Golden-crisp lentil fritters paired with stone-ground allam ginger chutney.',
  priceInr: 280,
  dietary: 'Veg',
  spiceLevel: 2,
  spiceLabel: 'Medium Spice',
  region: 'Vijayawada',
  image: '/src/assets/images/hero_telugu_bhojanam_1795437422889.jpg',
  pairingNote: 'Crisp opening plate before heirloom curries.',
};

const MOODS: MoodConfig[] = [
  {
    id: 'fiery-guntur',
    chipLabel: '🔥 Fiery Guntur',
    comboTitle: 'Guntur Ember & Sorrel Pairing',
    chefNote:
      'Sun-cured Teja chili heat cut cleanly by tangy red gongura and chilled buttermilk.',
    defaultSpice: 'Andhra Hot',
    courseIds: ['kodi-vepudu', 'gongura-mamsam', 'nimmakaya-majjiga'],
    taste: { spice: 82, richness: 80, aroma: 86 },
  },
  {
    id: 'royal-biryani',
    chipLabel: '🍲 Royal Biryani',
    comboTitle: 'Earthen Claypot Dum Combo',
    chefNote:
      'Slow-sealed saffron basmati layered with spiced morsels and tempered Majjiga.',
    defaultSpice: 'Medium',
    courseIds: ['kodi-vepudu', 'rayalaseema-dum-biryani', 'nimmakaya-majjiga'],
    taste: { spice: 72, richness: 92, aroma: 95 },
  },
  {
    id: 'veg-feast',
    chipLabel: '🍃 Veg Feast',
    comboTitle: 'Godavari Heirloom Veg Tasting',
    chefNote:
      'Crisp Punugulu followed by sesame-peanut stuffed brinjal and cooling buttermilk.',
    defaultSpice: 'Mild',
    courseIds: ['punugulu-bites', 'gutti-vankaya', 'nimmakaya-majjiga'],
    taste: { spice: 52, richness: 82, aroma: 90 },
  },
  {
    id: 'coastal-spice',
    chipLabel: '🦐 Coastal Spice',
    comboTitle: 'Konaseema Prawn & Curry Leaf Flight',
    chefNote:
      'Flash-tossed estuary prawns paired with glossy Bhimavaram masala and Majjiga.',
    defaultSpice: 'Medium',
    courseIds: ['karivepaku-royyalu', 'royyala-iguru', 'nimmakaya-majjiga'],
    taste: { spice: 76, richness: 85, aroma: 93 },
  },
];

function findDish(id: string): MenuItem {
  if (id === COOLING_DRINK.id) return COOLING_DRINK;
  if (id === CRISPY_STARTER_VEG.id) return CRISPY_STARTER_VEG;
  return MENU_ITEMS.find((item) => item.id === id) ?? MENU_ITEMS[0];
}

export function CulinaryConciergeSection({
  onAddPairingToCart,
}: CulinaryConciergeSectionProps) {
  const [selectedMoodId, setSelectedMoodId] =
    useState<ConciergeMoodId>('fiery-guntur');
  const [spiceLevel, setSpiceLevel] = useState<SimpleSpiceLevel>('Andhra Hot');
  const [isExpanded, setIsExpanded] = useState<boolean>(false);

  const activeMood = useMemo(
    () => MOODS.find((m) => m.id === selectedMoodId) ?? MOODS[0],
    [selectedMoodId],
  );

  const activeSpice =
    SPICE_LEVELS.find((s) => s.label === spiceLevel) ?? SPICE_LEVELS[1];

  const handleSelectMood = (mood: MoodConfig) => {
    if (isExpanded && selectedMoodId === mood.id) {
      setIsExpanded(false);
      return;
    }
    setSelectedMoodId(mood.id);
    setSpiceLevel(mood.defaultSpice);
    setIsExpanded(true);
  };

  const courses = useMemo<PairingCourseOrder[]>(() => {
    const roles = ['Starter', 'Main', 'Cooling Drink'] as const;
    return activeMood.courseIds.map((id, idx) => {
      const dish = findDish(id);
      const isDrink = idx === 2;
      return {
        dish,
        courseLabel: roles[idx],
        quantity: 1,
        spicePreference: isDrink ? 'Mild Temper' : activeSpice.preference,
        portionStyle: 'Signature Plate',
      };
    });
  }, [activeMood, activeSpice.preference]);

  const totalInr = useMemo(
    () => courses.reduce((sum, c) => sum + c.dish.priceInr * c.quantity, 0),
    [courses],
  );

  const tasteBars = useMemo(() => {
    const clamp = (val: number) => Math.max(20, Math.min(98, val));
    return [
      { label: 'Spice', value: clamp(activeMood.taste.spice + activeSpice.delta) },
      { label: 'Richness', value: clamp(activeMood.taste.richness) },
      { label: 'Aroma', value: clamp(activeMood.taste.aroma) },
    ];
  }, [activeMood.taste, activeSpice.delta]);

  return (
    <section
      aria-label="Chef's Concierge Pairing Bar"
      className="relative z-10 mx-auto max-w-7xl px-4 pt-10 pb-2 sm:px-6 lg:px-8"
    >
      {/* Slim Single-Row Dark-Glass Concierge Bar */}
      <div className="flex flex-col gap-3 rounded-2xl border border-white/[0.08] bg-[#121216]/85 px-4 py-3 backdrop-blur-xl transition-colors duration-250 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
          <button
            type="button"
            onClick={() => setIsExpanded((prev) => !prev)}
            className="inline-flex cursor-pointer items-center gap-1.5 pr-1 text-xs font-medium text-[#F8FAFC] transition-colors duration-250 hover:text-[#F59E0B]"
          >
            <Sparkles
              className="h-3.5 w-3.5 text-[#F59E0B]"
              aria-hidden="true"
            />
            <span className="whitespace-nowrap">
              Not sure what to order? Ask Chef
            </span>
          </button>

          <div
            role="group"
            aria-label="Quick mood pairings"
            className="flex flex-wrap items-center gap-1.5"
          >
            {MOODS.map((mood) => {
              const active = isExpanded && mood.id === selectedMoodId;
              return (
                <button
                  key={mood.id}
                  type="button"
                  onClick={() => handleSelectMood(mood)}
                  className={`cursor-pointer rounded-full border px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-all duration-250 ${
                    active
                      ? 'border-[#F59E0B]/60 bg-[#F59E0B]/15 text-[#F59E0B]'
                      : 'border-white/[0.08] bg-white/[0.03] text-[#CBD5E1] hover:border-white/20 hover:text-[#F8FAFC]'
                  }`}
                >
                  {mood.chipLabel}
                </button>
              );
            })}
          </div>
        </div>

        {/* Spice Toggle + Expand Toggle */}
        <div className="flex items-center justify-between gap-2.5 lg:justify-end">
          <div
            role="group"
            aria-label="Spice level preference"
            className="inline-flex items-center rounded-xl border border-white/[0.08] bg-[#09090B]/80 p-0.5"
          >
            {SPICE_LEVELS.map((tier) => {
              const active = tier.label === spiceLevel;
              return (
                <button
                  key={tier.label}
                  type="button"
                  onClick={() => {
                    setSpiceLevel(tier.label);
                    if (!isExpanded) setIsExpanded(true);
                  }}
                  className={`cursor-pointer rounded-lg px-2.5 py-1 text-[11px] font-medium whitespace-nowrap transition-colors duration-250 ${
                    active
                      ? 'bg-[#F59E0B] text-[#09090B]'
                      : 'text-[#94A3B8] hover:text-[#F8FAFC]'
                  }`}
                >
                  {tier.label}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => setIsExpanded((prev) => !prev)}
            aria-expanded={isExpanded}
            aria-label={
              isExpanded ? 'Collapse Chef pairing card' : 'Expand Chef pairing card'
            }
            className="inline-flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.03] text-[#94A3B8] transition-colors duration-250 hover:text-[#F8FAFC]"
          >
            {isExpanded ? (
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
            )}
          </button>
        </div>
      </div>

      {/* Expanded Refined Pairing Card (On Click) */}
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="mt-3 rounded-2xl border border-[#F59E0B]/35 bg-[#121216] p-5 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.85)] sm:p-6"
          >
            <div className="flex flex-col justify-between gap-4 border-b border-white/[0.08] pb-4 sm:flex-row sm:items-center">
              <div>
                <p className="text-[11px] font-semibold tracking-[0.14em] text-[#F59E0B] uppercase">
                  Chef&apos;s Curated Combo · {spiceLevel}
                </p>
                <h3 className="font-editorial mt-0.5 text-xl font-semibold text-[#F8FAFC] sm:text-2xl">
                  {activeMood.comboTitle}
                </h3>
              </div>
              <p className="max-w-md text-xs leading-relaxed text-[#94A3B8]">
                <span className="font-medium text-[#F8FAFC]">Chef&apos;s Note:</span>{' '}
                {activeMood.chefNote}
              </p>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-5 lg:grid-cols-12 lg:items-center">
              {/* 3-Course Combo Summary (Starter + Main + Cooling Drink) */}
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3 lg:col-span-7">
                {courses.map((course) => (
                  <div
                    key={`${course.courseLabel}-${course.dish.id}`}
                    className="flex flex-col justify-between rounded-xl border border-white/[0.08] bg-[#09090B]/70 p-3.5"
                  >
                    <div>
                      <span className="text-[10px] font-semibold tracking-wider text-[#F59E0B] uppercase">
                        {course.courseLabel}
                      </span>
                      <p className="mt-1 text-xs font-semibold text-[#F8FAFC]">
                        {course.dish.name}
                      </p>
                    </div>
                    <p className="mt-2 text-xs font-medium text-[#94A3B8] tabular-nums">
                      ₹{course.dish.priceInr}
                    </p>
                  </div>
                ))}
              </div>

              {/* Simple 3-Bar Taste Indicator */}
              <div className="space-y-2 rounded-xl border border-white/[0.08] bg-[#09090B]/70 p-3.5 lg:col-span-2">
                {tasteBars.map((bar) => (
                  <div key={bar.label}>
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-[#94A3B8]">{bar.label}</span>
                      <span className="font-medium text-[#F8FAFC] tabular-nums">
                        {bar.value}%
                      </span>
                    </div>
                    <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full rounded-full bg-[#F59E0B] transition-all duration-250"
                        style={{ width: `${bar.value}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* Single CTA Button */}
              <div className="flex flex-col justify-center lg:col-span-3">
                <button
                  type="button"
                  onClick={() =>
                    onAddPairingToCart(
                      courses,
                      activeMood.comboTitle,
                      totalInr,
                    )
                  }
                  className="inline-flex min-h-[46px] w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-[#F59E0B] px-4 py-2.5 text-xs font-semibold text-[#09090B] whitespace-nowrap transition-colors duration-250 hover:bg-[#FBBF24] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F59E0B]"
                >
                  <ShoppingBag className="h-3.5 w-3.5" aria-hidden="true" />
                  <span className="tabular-nums">
                    Add Combo to Cart — ₹{totalInr.toLocaleString('en-IN')}
                  </span>
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
