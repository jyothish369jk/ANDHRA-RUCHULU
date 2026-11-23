import { motion } from 'motion/react';
import { BrandEmblem } from './InteractivePrimitives';
import type { NavSectionId } from './Navbar';

interface FooterProps {
  onNavigate: (section: NavSectionId) => void;
}

export function Footer({ onNavigate }: FooterProps) {
  return (
    <motion.footer
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="relative z-10 border-t border-white/10 bg-[#0B0C10]/80 backdrop-blur-xl"
    >
      <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-8 px-4 py-12 sm:px-6 md:flex-row md:items-center lg:px-8">
        <div className="flex items-center gap-3">
          <BrandEmblem className="h-7 w-7" />
          <div>
            <p className="font-serif text-lg font-semibold tracking-[0.14em] text-[#F8FAFC] uppercase">
              Andhra Ruchulu
            </p>
            <p className="text-xs text-[#94A3B8]">
              Hyderabad · Visakhapatnam · Contemporary Heritage Hospitality
            </p>
          </div>
        </div>

        <nav aria-label="Footer navigation" className="flex flex-wrap items-center gap-6 text-xs font-medium text-[#94A3B8]">
          {(['home', 'menu', 'story', 'contact'] as NavSectionId[]).map((section) => (
            <a
              key={section}
              href={`#${section}`}
              onClick={(e) => {
                e.preventDefault();
                onNavigate(section);
              }}
              className="capitalize transition-colors hover:text-[#F8FAFC]"
            >
              {section}
            </a>
          ))}
        </nav>

        <p className="text-xs text-[#94A3B8]/75">
          © {new Date().getFullYear()} Andhra Ruchulu Hospitality. All rights reserved.
        </p>
      </div>
    </motion.footer>
  );
}
