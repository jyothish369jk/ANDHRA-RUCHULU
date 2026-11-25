import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { Utensils } from 'lucide-react';

export function BrandEmblem({ className = 'h-7 w-7' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 36 36"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <circle cx="18" cy="18" r="16.5" stroke="url(#goldRing)" strokeWidth="1.2" />
      <path
        d="M11 20.5C11 24.0899 14.134 27 18 27C21.866 27 25 24.0899 25 20.5C25 18.2 23.8 16.3 22 15.2H14C12.2 16.3 11 18.2 11 20.5Z"
        stroke="#F59E0B"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path
        d="M13 15.2C14.3 13.6 16.1 12.8 18 12.8C19.9 12.8 21.7 13.6 23 15.2"
        stroke="#F8FAFC"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
      <path
        d="M18 7.5C18 9.2 19.6 10.2 18.6 11.8"
        stroke="#DC2626"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <defs>
        <linearGradient id="goldRing" x1="4" y1="4" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop stopColor="#F59E0B" stopOpacity="0.9" />
          <stop offset="1" stopColor="#F8FAFC" stopOpacity="0.25" />
        </linearGradient>
      </defs>
    </svg>
  );
}

interface MagneticButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  variant?: 'primary' | 'glass';
  className?: string;
}

export function MagneticButton({
  children,
  variant = 'primary',
  className = '',
  onClick,
  type = 'button',
  ...props
}: MagneticButtonProps) {
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  const handlePointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (e.pointerType === 'touch') return;
    const el = buttonRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const relX = e.clientX - (rect.left + rect.width / 2);
    const relY = e.clientY - (rect.top + rect.height / 2);
    setOffset({ x: relX * 0.16, y: relY * 0.22 });
  };

  const handlePointerLeave = () => {
    setOffset({ x: 0, y: 0 });
  };

  const baseStyles =
    variant === 'primary'
      ? 'bg-[#F59E0B] text-[#0B0C10] border border-[#F59E0B] shadow-[0_12px_32px_-8px_rgba(245,158,11,0.45)]'
      : 'glass-panel text-[#F8FAFC] hover:border-white/25';

  return (
    <motion.button
      ref={buttonRef}
      type={type}
      onClick={onClick}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      animate={{ x: offset.x, y: offset.y }}
      transition={{ type: 'spring', stiffness: 360, damping: 24, mass: 0.4 }}
      whileTap={{ scale: 0.97 }}
      className={`group relative inline-flex min-h-[44px] cursor-pointer items-center justify-center gap-2 overflow-hidden rounded-xl px-6 py-3 text-sm font-semibold whitespace-nowrap shrink-0 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F59E0B] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0B0C10] ${baseStyles} ${className}`}
      {...(props as Record<string, unknown>)}
    >
      {/* Liquid-fill hover sweep */}
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute inset-0 translate-y-full transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:translate-y-0 ${
          variant === 'primary' ? 'bg-[#FBBF24]' : 'bg-white/[0.08]'
        }`}
      />
      <span className="relative z-10 inline-flex items-center gap-2">{children}</span>
    </motion.button>
  );
}

interface TiltGlassCardProps {
  children: React.ReactNode;
  className?: string;
  maxTilt?: number;
}

export function TiltGlassCard({ children, className = '', maxTilt = 6 }: TiltGlassCardProps) {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [tilt, setTilt] = useState({ rotateX: 0, rotateY: 0, glareX: 50, glareY: 50, active: false });

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'touch') return;
    const el = cardRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width;
    const py = (e.clientY - rect.top) / rect.height;
    const rotateY = (px - 0.5) * (maxTilt * 2);
    const rotateX = (0.5 - py) * (maxTilt * 2);
    setTilt({
      rotateX,
      rotateY,
      glareX: px * 100,
      glareY: py * 100,
      active: true,
    });
  };

  const handlePointerLeave = () => {
    setTilt((prev) => ({ ...prev, rotateX: 0, rotateY: 0, active: false }));
  };

  return (
    <motion.div
      ref={cardRef}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      animate={{
        rotateX: tilt.rotateX,
        rotateY: tilt.rotateY,
      }}
      transition={{ type: 'spring', stiffness: 260, damping: 24 }}
      style={{ transformStyle: 'preserve-3d', perspective: 1000 }}
      className={`glass-panel relative overflow-hidden rounded-2xl transition-colors duration-200 hover:border-white/22 ${className}`}
    >
      {/* Mouse-tracking glass glare */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-20 transition-opacity duration-300"
        style={{
          opacity: tilt.active ? 1 : 0,
          background: `radial-gradient(360px circle at ${tilt.glareX}% ${tilt.glareY}%, rgba(245, 158, 11, 0.14), rgba(255, 255, 255, 0.05) 35%, transparent 70%)`,
        }}
      />
      {children}
    </motion.div>
  );
}

interface FoodImageProps {
  src: string;
  alt: string;
  titleFallback: string;
  className?: string;
}

export function FoodImage({ src, alt, titleFallback, className = '' }: FoodImageProps) {
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setHasError(false);
  }, [src]);

  if (hasError) {
    return (
      <div
        className={`flex h-full w-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-[#1C1612] via-[#14110F] to-[#0B0C10] p-6 text-center ${className}`}
      >
        <Utensils className="h-7 w-7 text-[#F59E0B]/70" aria-hidden="true" />
        <span className="font-serif text-lg text-[#F8FAFC]">{titleFallback}</span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setHasError(true)}
      className={`h-full w-full object-cover transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${className}`}
    />
  );
}
