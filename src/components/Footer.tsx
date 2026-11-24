import { motion } from 'motion/react';
import { ShieldCheck } from 'lucide-react';
import { BrandEmblem } from './InteractivePrimitives';
import type { NavSectionId } from './Navbar';

interface FooterProps {
  onNavigate: (section: NavSectionId) => void;
  onOpenAdmin: () => void;
}

export function Footer({ onNavigate, onOpenAdmin }: FooterProps) {
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
              R934+R7V, Durganagar, Pothinamallayya Palem, Madhuravada, AP 530041 ·{' '}
              <a
                href="https://www.google.com/maps/search/?api=1&query=17.8046,83.3557"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#F59E0B] hover:underline"
              >
                Get Directions
              </a>
            </p>
          </div>
        </div>

        <nav aria-label="Footer navigation" className="flex flex-wrap items-center gap-6 text-xs font-medium text-[#94A3B8]">
          {(['home', 'menu', 'story', 'reviews', 'contact'] as NavSectionId[]).map((section) => (
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
          <a
            href="/admin"
            onClick={(e) => {
              e.preventDefault();
              onOpenAdmin();
            }}
            className="inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-white/[0.04] px-3 py-1.5 text-[#CBD5E1] transition-colors hover:border-[#F59E0B]/40 hover:text-[#F59E0B]"
          >
            <ShieldCheck className="h-3.5 w-3.5 text-[#F59E0B]" aria-hidden="true" />
            <span>Admin Portal</span>
          </a>
        </nav>

        <p className="text-xs text-[#94A3B8]/75">
          © {new Date().getFullYear()} Andhra Ruchulu Hospitality. All rights reserved.
        </p>
      </div>
    </motion.footer>
  );
}
