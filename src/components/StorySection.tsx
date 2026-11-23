import { useRef } from 'react';
import { motion, useScroll, useTransform } from 'motion/react';
import { HERITAGE_CHAPTERS, HERO_MEDIA } from '../data/menuData';
import { FoodImage, TiltGlassCard } from './InteractivePrimitives';

const HERITAGE_METRICS = [
  {
    value: '35+',
    label: 'Hand-Roasted Spices',
    detail: 'Sun-dried, roasted, and granite-pounded each morning.',
  },
  {
    value: '100%',
    label: 'Traditional Claypot Cooking',
    detail: 'Seasoned earthen pots over tamarind wood embers.',
  },
  {
    value: '1984',
    label: 'Flagship Heritage Root',
    detail: 'Three generations of Coastal Andhra & Rayalaseema craft.',
  },
];

export function StorySection() {
  const sectionRef = useRef<HTMLElement | null>(null);
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ['start end', 'end start'],
  });

  const frameParallaxY = useTransform(scrollYProgress, [0, 1], [24, -24]);
  const imageScale = useTransform(scrollYProgress, [0, 0.6, 1], [1.06, 1.0, 1.02]);

  return (
    <section
      ref={sectionRef}
      id="story"
      className="relative z-10 mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-28"
    >
      <div className="grid grid-cols-1 items-stretch gap-12 lg:grid-cols-12 lg:gap-16">
        {/* Left Column: Scroll-Parallax Heritage Framing */}
        <motion.div
          style={{ y: frameParallaxY }}
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.15 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="flex flex-col justify-between gap-6 will-change-transform lg:col-span-5"
        >
          <TiltGlassCard maxTilt={4} className="flex-1 p-3 sm:p-4">
            <div className="relative aspect-[3/4] w-full overflow-hidden rounded-xl lg:h-full lg:min-h-[520px]">
              <motion.div style={{ scale: imageScale }} className="h-full w-full will-change-transform">
                <FoodImage
                  src={HERO_MEDIA.storyImage}
                  alt="Traditional Andhra spice kitchen with crimson Guntur chilies, stone mortar, and earthen claypots simmering over wood embers"
                  titleFallback="Andhra Heritage Spice Kitchen"
                />
              </motion.div>
              <div
                aria-hidden="true"
                className="absolute inset-0 bg-gradient-to-t from-[#0B0C10]/85 via-[#0B0C10]/20 to-transparent"
              />
              <div className="absolute inset-x-5 bottom-5 z-10">
                <p className="text-xs font-medium text-[#F59E0B]">
                  Godavari &amp; Rayalaseema Craft
                </p>
                <p className="mt-1 font-serif text-2xl font-semibold text-[#F8FAFC]">
                  Where Wood Smoke Meets Whole Spice
                </p>
              </div>
            </div>
          </TiltGlassCard>
        </motion.div>

        {/* Right Column: Editorial Scrollytelling Narrative & Adjacent Proof Metrics */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.15 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="flex flex-col justify-between lg:col-span-7"
        >
          <div>
            <p className="text-sm font-medium text-[#F59E0B]">Our Heritage</p>
            <h2
              className="text-balance mt-2 font-serif font-semibold tracking-tight text-[#F8FAFC]"
              style={{ fontSize: 'clamp(2.1rem, 3.8vw, 3.35rem)', lineHeight: 1.08 }}
            >
              A Generational Tribute to the Spice Coast of Andhra
            </h2>
            <p className="mt-5 max-w-2xl text-base leading-relaxed text-[#94A3B8]">
              Born along the fertile banks of the Godavari and tempered in the red-earth
              kitchens of Rayalaseema, Andhra Ruchulu reimagines regional feasting for the
              contemporary table—honoring patient stone-grinding, heirloom tamarind, and
              unhurried ember cooking.
            </p>
          </div>

          {/* 3-Chapter Editorial Timeline */}
          <div className="mt-10 divide-y divide-white/10 border-y border-white/10">
            {HERITAGE_CHAPTERS.map((chapter, idx) => (
              <motion.div
                key={chapter.number}
                initial={{ opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{
                  duration: 0.5,
                  delay: idx * 0.08,
                  ease: [0.16, 1, 0.3, 1],
                }}
                className="grid grid-cols-1 gap-2 py-6 sm:grid-cols-12 sm:gap-6"
              >
                <div className="sm:col-span-4">
                  <span className="text-xs font-semibold text-[#F59E0B] tabular-nums">
                    {chapter.number}.
                  </span>
                  <h3 className="mt-1 font-serif text-xl font-semibold text-[#F8FAFC]">
                    {chapter.title}
                  </h3>
                  <p className="mt-0.5 text-xs text-[#94A3B8]">{chapter.subtitle}</p>
                </div>
                <p className="text-sm leading-relaxed text-[#94A3B8] sm:col-span-8">
                  {chapter.description}
                </p>
              </motion.div>
            ))}
          </div>

          {/* Adjacent Floating Glass Stat Cards */}
          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
            {HERITAGE_METRICS.map((metric, idx) => (
              <motion.div
                key={metric.label}
                initial={{ opacity: 0, y: 18, scale: 0.97 }}
                whileInView={{ opacity: 1, y: 0, scale: 1 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{
                  duration: 0.45,
                  delay: idx * 0.08,
                  ease: [0.16, 1, 0.3, 1],
                }}
                className="glass-panel rounded-2xl p-5"
              >
                <p className="font-serif text-3xl font-semibold text-[#F59E0B] tabular-nums">
                  {metric.value}
                </p>
                <p className="mt-1 text-sm font-semibold text-[#F8FAFC]">{metric.label}</p>
                <p className="mt-1.5 text-xs leading-relaxed text-[#94A3B8]">{metric.detail}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
