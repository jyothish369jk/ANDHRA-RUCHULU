import { useEffect, useRef, useState } from 'react';
import {
  AnimatePresence,
  animate,
  motion,
  useInView,
  useReducedMotion,
} from 'motion/react';
import { ChevronLeft, ChevronRight, ExternalLink, Quote, Star } from 'lucide-react';
import { RESTAURANT_LOCATION } from '../data/menuData';
import { GOOGLE_REVIEWS } from '../data/reviewsData';
import { TiltGlassCard } from './InteractivePrimitives';

function GoogleMark({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      aria-hidden="true"
    >
      <path
        fill="#4285F4"
        d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96Z"
      />
    </svg>
  );
}

function StarRow({ count = 5, animateCascade = false }: { count?: number; animateCascade?: boolean }) {
  return (
    <div className="inline-flex items-center gap-1" aria-label={`${count} out of 5 stars`}>
      {Array.from({ length: count }).map((_, idx) => (
        <motion.span
          key={idx}
          initial={animateCascade ? { opacity: 0, scale: 0.4, rotate: -18 } : false}
          whileInView={animateCascade ? { opacity: 1, scale: 1, rotate: 0 } : undefined}
          viewport={{ once: true, amount: 0.4 }}
          transition={{
            duration: 0.35,
            delay: animateCascade ? 0.1 + idx * 0.06 : 0,
            ease: [0.16, 1, 0.3, 1],
          }}
        >
          <Star className="h-4 w-4 fill-[#F59E0B] text-[#F59E0B]" aria-hidden="true" />
        </motion.span>
      ))}
    </div>
  );
}

export function ReviewsSection() {
  const sectionRef = useRef<HTMLElement | null>(null);
  const isInView = useInView(sectionRef, { once: true, amount: 0.2 });
  const prefersReducedMotion = useReducedMotion();

  const [activeIndex, setActiveIndex] = useState(0);
  const [direction, setDirection] = useState(1);
  const [isPaused, setIsPaused] = useState(false);
  const [displayRating, setDisplayRating] = useState('4.9');

  useEffect(() => {
    if (!isInView || prefersReducedMotion) {
      setDisplayRating('4.9');
      return;
    }
    const controls = animate(3.8, 4.9, {
      duration: 1.1,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (latest) => {
        setDisplayRating(latest.toFixed(1));
      },
    });
    return () => controls.stop();
  }, [isInView, prefersReducedMotion]);

  useEffect(() => {
    if (isPaused || prefersReducedMotion) return;
    const timer = window.setInterval(() => {
      setDirection(1);
      setActiveIndex((prev) => (prev + 1) % GOOGLE_REVIEWS.length);
    }, 5500);
    return () => window.clearInterval(timer);
  }, [isPaused, prefersReducedMotion]);

  const handleStep = (delta: number) => {
    setDirection(delta >= 0 ? 1 : -1);
    setActiveIndex(
      (prev) => (prev + delta + GOOGLE_REVIEWS.length) % GOOGLE_REVIEWS.length,
    );
  };

  const activeReview = GOOGLE_REVIEWS[activeIndex];
  const marqueeItems = [...GOOGLE_REVIEWS, ...GOOGLE_REVIEWS];

  return (
    <section
      ref={sectionRef}
      id="reviews"
      className="relative z-10 mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24"
    >
      {/* Header & Animated Google Rating Summary */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end"
      >
        <div>
          <p className="text-sm font-medium text-[#F59E0B]">Google Guest Acclaim</p>
          <h2
            className="text-balance mt-2 font-serif font-semibold tracking-tight text-[#F8FAFC]"
            style={{ fontSize: 'clamp(2.05rem, 3.6vw, 3.2rem)', lineHeight: 1.08 }}
          >
            Five-Star Evenings Around the Claypot
          </h2>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-[#94A3B8] sm:text-base">
            Stories shared by guests dining at our Madhuravada kitchen in Visakhapatnam.
          </p>
        </div>

        <div className="glass-panel flex flex-wrap items-center gap-5 rounded-2xl px-5 py-4">
          <div className="flex items-center gap-3.5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/12 bg-white/[0.04]">
              <GoogleMark className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-baseline gap-2">
                <span className="font-sans text-3xl font-semibold tracking-tight text-[#F8FAFC] tabular-nums">
                  {displayRating}
                </span>
                <span className="text-xs text-[#94A3B8] tabular-nums">/ 5.0</span>
              </div>
              <div className="mt-0.5 flex items-center gap-2">
                <StarRow count={5} animateCascade />
                <span className="text-xs text-[#94A3B8] tabular-nums">· 480+ Google Reviews</span>
              </div>
            </div>
          </div>

          <a
            href={RESTAURANT_LOCATION.directionsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-[#F59E0B]/40 bg-[#F59E0B]/10 px-4 py-2 text-xs font-semibold text-[#F59E0B] whitespace-nowrap transition-colors hover:bg-[#F59E0B]/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F59E0B]"
          >
            <span>View on Google</span>
            <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
          </a>
        </div>
      </motion.div>

      {/* Interactive Motion-Graphics Spotlight Card */}
      <div
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
        className="mt-10"
      >
        <TiltGlassCard maxTilt={3} className="glass-panel-elevated p-6 sm:p-8 lg:p-10">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <GoogleMark className="h-4 w-4 shrink-0" />
                  <StarRow count={activeReview.rating} />
                  <span className="text-xs text-[#94A3B8]">
                    Google Review · {activeReview.timeAgo}
                  </span>
                </div>

                <Quote className="hidden h-7 w-7 text-[#F59E0B]/35 sm:block" aria-hidden="true" />
              </div>

              <div className="relative mt-5 min-h-[130px] sm:min-h-[110px]">
                <AnimatePresence mode="wait" custom={direction}>
                  <motion.div
                    key={activeReview.id}
                    custom={direction}
                    initial={
                      prefersReducedMotion
                        ? { opacity: 0 }
                        : { opacity: 0, x: direction > 0 ? 28 : -28, filter: 'blur(4px)' }
                    }
                    animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
                    exit={
                      prefersReducedMotion
                        ? { opacity: 0 }
                        : { opacity: 0, x: direction > 0 ? -28 : 28, filter: 'blur(4px)' }
                    }
                    transition={{ duration: 0.36, ease: [0.16, 1, 0.3, 1] }}
                  >
                    <blockquote className="font-serif text-xl leading-snug font-medium text-[#F8FAFC] sm:text-2xl lg:text-[1.7rem]">
                      “{activeReview.quote}”
                    </blockquote>

                    <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#F59E0B]/35 bg-[#F59E0B]/15 text-xs font-semibold text-[#F59E0B]">
                          {activeReview.initials}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-[#F8FAFC]">
                            {activeReview.reviewerName}
                          </p>
                          <p className="text-xs text-[#94A3B8]">
                            {activeReview.reviewerMeta} · Ordered {activeReview.dishMentioned}
                          </p>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>

            {/* Spotlight Navigation Controls */}
            <div className="flex shrink-0 items-center justify-between gap-4 border-t border-white/10 pt-4 lg:flex-col lg:items-end lg:border-t-0 lg:border-l lg:pt-0 lg:pl-8">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleStep(-1)}
                  aria-label="Previous Google review"
                  className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-xl border border-white/12 bg-white/[0.04] text-[#F8FAFC] transition-colors hover:border-[#F59E0B]/50 hover:text-[#F59E0B] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F59E0B]"
                >
                  <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => handleStep(1)}
                  aria-label="Next Google review"
                  className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-xl border border-white/12 bg-white/[0.04] text-[#F8FAFC] transition-colors hover:border-[#F59E0B]/50 hover:text-[#F59E0B] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F59E0B]"
                >
                  <ChevronRight className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>

              <div className="flex items-center gap-1.5" role="tablist" aria-label="Featured reviews">
                {GOOGLE_REVIEWS.map((rev, idx) => {
                  const isActive = idx === activeIndex;
                  return (
                    <button
                      key={rev.id}
                      type="button"
                      role="tab"
                      aria-selected={isActive}
                      aria-label={`Show review by ${rev.reviewerName}`}
                      onClick={() => {
                        setDirection(idx >= activeIndex ? 1 : -1);
                        setActiveIndex(idx);
                      }}
                      className={`h-1.5 cursor-pointer rounded-full transition-all duration-300 ${
                        isActive
                          ? 'w-7 bg-[#F59E0B]'
                          : 'w-2 bg-white/20 hover:bg-white/40'
                      }`}
                    />
                  );
                })}
              </div>
            </div>
          </div>

          {/* Animated Auto-Advance Progress Line */}
          {!prefersReducedMotion && (
            <div className="mt-6 h-[2px] w-full overflow-hidden rounded-full bg-white/10">
              <motion.div
                key={`${activeReview.id}-${isPaused}`}
                initial={{ scaleX: 0 }}
                animate={{ scaleX: isPaused ? 0 : 1 }}
                transition={{ duration: 5.5, ease: 'linear' }}
                className="h-full origin-left bg-gradient-to-r from-[#F59E0B] to-[#DC2626]"
              />
            </div>
          )}
        </TiltGlassCard>
      </div>

      {/* Kinetic Horizontal Review Marquee */}
      <div
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
        className="relative mt-6 overflow-hidden py-2 [mask-image:linear-gradient(to_right,transparent,black_6%,black_94%,transparent)]"
      >
        <motion.div
          className={`flex w-max gap-4 ${prefersReducedMotion ? 'flex-wrap justify-center w-full' : ''}`}
          animate={
            prefersReducedMotion
              ? undefined
              : {
                  x: ['0%', '-50%'],
                }
          }
          transition={
            prefersReducedMotion
              ? undefined
              : {
                  x: {
                    repeat: Infinity,
                    repeatType: 'loop',
                    duration: 36,
                    ease: 'linear',
                  },
                }
          }
        >
          {(prefersReducedMotion ? GOOGLE_REVIEWS : marqueeItems).map((rev, idx) => {
            const realIndex = idx % GOOGLE_REVIEWS.length;
            const isSelected = realIndex === activeIndex;
            return (
              <button
                key={`${rev.id}-${idx}`}
                type="button"
                onClick={() => {
                  setDirection(realIndex >= activeIndex ? 1 : -1);
                  setActiveIndex(realIndex);
                }}
                className={`glass-panel w-[290px] shrink-0 cursor-pointer rounded-2xl p-4 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-[#F59E0B]/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F59E0B] sm:w-[320px] ${
                  isSelected ? 'border-[#F59E0B]/50 bg-white/[0.06]' : ''
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <GoogleMark className="h-3.5 w-3.5 shrink-0" />
                    <StarRow count={rev.rating} />
                  </div>
                  <span className="text-[11px] text-[#94A3B8]">{rev.timeAgo}</span>
                </div>
                <p className="mt-2.5 line-clamp-2 text-xs leading-relaxed text-[#F8FAFC]/90">
                  “{rev.quote}”
                </p>
                <p className="mt-3 text-xs font-semibold text-[#F59E0B]">
                  {rev.reviewerName}{' '}
                  <span className="font-normal text-[#94A3B8]">· {rev.dishMentioned}</span>
                </p>
              </button>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
}
