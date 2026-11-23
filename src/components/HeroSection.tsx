import { useRef } from 'react';
import { motion, useScroll, useTransform } from 'motion/react';
import { ArrowRight, Calendar } from 'lucide-react';
import { HERO_MEDIA } from '../data/menuData';
import { FoodImage, MagneticButton, TiltGlassCard } from './InteractivePrimitives';

interface HeroSectionProps {
  onExploreMenu: () => void;
  onBookTable: () => void;
}

const SIGNATURE_PILLARS = [
  {
    index: '01',
    title: 'Authentic Recipes',
    detail: 'Heirloom Coastal Andhra & Rayalaseema family formulations preserved without compromise.',
  },
  {
    index: '02',
    title: 'Farm-to-Fire Spices',
    detail: 'Single-origin Guntur chilies, Konaseema coconuts, and granite-ground masalas roasted daily.',
  },
  {
    index: '03',
    title: 'Royal Hospitality',
    detail: 'Intimate dark-stone dining rooms shaped around warm southern hospitality rituals.',
  },
];

export function HeroSection({ onExploreMenu, onBookTable }: HeroSectionProps) {
  const sectionRef = useRef<HTMLElement | null>(null);
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ['start start', 'end start'],
  });

  const showcaseY = useTransform(scrollYProgress, [0, 1], [0, -28]);
  const copyY = useTransform(scrollYProgress, [0, 1], [0, 18]);

  return (
    <section
      ref={sectionRef}
      id="home"
      className="relative z-10 mx-auto max-w-7xl px-4 pt-10 pb-20 sm:px-6 lg:px-8 lg:pt-16 lg:pb-24"
    >
      {/* Asymmetric Minimalist Split Hero */}
      <div className="grid grid-cols-1 items-stretch gap-10 lg:grid-cols-12 lg:gap-14">
        {/* Left Column: Editorial Value Proposition */}
        <motion.div
          style={{ y: copyY }}
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="flex flex-col justify-center will-change-transform lg:col-span-6"
        >
          <p className="text-sm font-medium tracking-wide text-[#F59E0B]">
            Hyderabad · Visakhapatnam Flagship
          </p>

          <h1
            className="text-balance mt-4 font-serif font-semibold tracking-tight text-[#F8FAFC]"
            style={{ fontSize: 'clamp(2.65rem, 4.8vw, 4.5rem)', lineHeight: 1.04 }}
          >
            Heritage Spice.
            <br />
            <span className="italic font-normal text-[#F59E0B]">Modern Soul.</span>
          </h1>

          <p className="mt-6 max-w-xl text-base leading-relaxed text-[#94A3B8] sm:text-lg">
            Andhra Ruchulu brings the untamed depth of sun-cured Guntur chilies, Godavari
            sorrel reductions, and blackened earthen claypot dum cooking to a calm,
            contemporary obsidian dining room.
          </p>

          <div className="mt-9 flex flex-wrap items-center gap-4">
            <MagneticButton variant="primary" onClick={onExploreMenu}>
              <span>Explore Menu</span>
              <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
            </MagneticButton>

            <MagneticButton variant="glass" onClick={onBookTable}>
              <Calendar className="h-4 w-4 text-[#F59E0B]" />
              <span>Book a Table</span>
            </MagneticButton>
          </div>

          <div className="mt-10 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-white/10 pt-6 text-xs text-[#94A3B8]">
            <span>Wood-Ember Claypot Kitchen</span>
            <span aria-hidden="true">·</span>
            <span>Daily Coastal Catch</span>
            <span aria-hidden="true">·</span>
            <span>Open Tue – Sun</span>
          </div>
        </motion.div>

        {/* Right Column: Floating Parallax Showcase with Layered Glass Framing */}
        <motion.div
          style={{ y: showcaseY }}
          initial={{ opacity: 0, scale: 0.96, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.12, ease: [0.16, 1, 0.3, 1] }}
          className="relative flex items-stretch will-change-transform lg:col-span-6"
        >
          <TiltGlassCard maxTilt={5} className="w-full p-3 sm:p-4">
            <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl lg:h-full lg:min-h-[470px]">
              <FoodImage
                src={HERO_MEDIA.feastImage}
                alt="Traditional Telugu festive Vistaraku feast served on a banana leaf with brass katoris, gongura, avakaya, steaming rice with ghee, garelu, brass deepam lamp, and jasmine flowers"
                titleFallback="Traditional Telugu Vistaraku"
                className="group-hover:scale-105"
              />
              {/* Measured Contrast Scrim */}
              <div
                aria-hidden="true"
                className="absolute inset-0 bg-gradient-to-t from-[#0B0C10]/90 via-[#0B0C10]/25 to-transparent"
              />

              {/* Layered Glass Spice-Note Callouts */}
              <div className="absolute inset-x-4 bottom-4 z-10 flex flex-col gap-3 sm:inset-x-6 sm:bottom-6 sm:flex-row sm:items-end sm:justify-between">
                <div className="glass-panel rounded-xl px-4 py-3">
                  <p className="text-xs font-medium text-[#F59E0B]">Vistaraku Heritage</p>
                  <p className="mt-0.5 font-serif text-xl font-semibold text-[#F8FAFC]">
                    Traditional Telugu Bhojanam
                  </p>
                </div>

                <div className="glass-panel rounded-xl px-4 py-3">
                  <p className="text-xs font-medium text-[#DC2626]">Single-Origin Heat</p>
                  <p className="mt-0.5 font-serif text-xl font-semibold text-[#F8FAFC]">
                    Avakaya &amp; Gongura Craft
                  </p>
                </div>
              </div>
            </div>
          </TiltGlassCard>
        </motion.div>
      </div>

      {/* Full-Width 3-Column Signature Glass Strip */}
      <div className="glass-panel mt-12 grid grid-cols-1 divide-y divide-white/10 rounded-2xl md:grid-cols-3 md:divide-x md:divide-y-0">
        {SIGNATURE_PILLARS.map((pillar, idx) => (
          <motion.div
            key={pillar.index}
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.5, delay: idx * 0.08, ease: [0.16, 1, 0.3, 1] }}
            className="p-6 sm:p-7"
          >
            <p className="text-xs font-semibold tracking-widest text-[#F59E0B] tabular-nums">
              {pillar.index}.
            </p>
            <h2 className="mt-2 font-serif text-2xl font-semibold text-[#F8FAFC]">
              {pillar.title}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-[#94A3B8]">{pillar.detail}</p>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
