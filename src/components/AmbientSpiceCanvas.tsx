import { useEffect, useRef } from 'react';

interface LightOrb {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  alpha: number;
}

export function AmbientSpiceCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const isCoarsePointer = window.matchMedia('(pointer: coarse)').matches;

    let animationFrameId = 0;
    let width = window.innerWidth;
    let height = window.innerHeight;
    let scrollOffset = window.scrollY;
    let smoothedScroll = scrollOffset;

    const pointer = {
      x: width * 0.5,
      y: height * 0.35,
      targetX: width * 0.5,
      targetY: height * 0.35,
    };

    const orbs: LightOrb[] = [
      {
        x: width * 0.2,
        y: height * 0.25,
        vx: 0.15,
        vy: 0.11,
        radius: width < 768 ? 220 : 340,
        color: '245, 158, 11', // Saffron Gold
        alpha: 0.085,
      },
      {
        x: width * 0.78,
        y: height * 0.3,
        vx: -0.13,
        vy: 0.14,
        radius: width < 768 ? 240 : 380,
        color: '220, 38, 38', // Crimson Chili
        alpha: 0.055,
      },
      {
        x: width * 0.52,
        y: height * 0.75,
        vx: 0.11,
        vy: -0.1,
        radius: width < 768 ? 260 : 420,
        color: '180, 83, 9', // Warm Roasted Amber
        alpha: 0.075,
      },
      {
        x: width * 0.85,
        y: height * 0.82,
        vx: -0.09,
        vy: -0.12,
        radius: width < 768 ? 190 : 280,
        color: '16, 185, 129', // Subtle Emerald Leaf hint
        alpha: 0.032,
      },
    ];

    const resize = (force = false) => {
      const nextW = window.innerWidth;
      const nextH = window.innerHeight;
      // Ignore small mobile URL-bar height shifts to prevent scroll jitter
      if (!force && nextW === width && Math.abs(nextH - height) < 120) {
        return;
      }
      const dpr = isCoarsePointer ? 1 : Math.min(window.devicePixelRatio || 1, 1.75);
      width = nextW;
      height = nextH;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const handleResize = () => resize(false);

    const handlePointerMove = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return;
      pointer.targetX = e.clientX;
      pointer.targetY = e.clientY;
    };

    const handleScroll = () => {
      scrollOffset = window.scrollY;
    };

    resize(true);
    window.addEventListener('resize', handleResize, { passive: true });
    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    window.addEventListener('scroll', handleScroll, { passive: true });

    let time = 0;

    const renderFrame = () => {
      time += 0.004;

      pointer.x += (pointer.targetX - pointer.x) * 0.04;
      pointer.y += (pointer.targetY - pointer.y) * 0.04;
      smoothedScroll += (scrollOffset - smoothedScroll) * 0.06;

      ctx.clearRect(0, 0, width, height);

      const waveStep = width < 768 ? 64 : 48;
      const scrollPhase = smoothedScroll * 0.0012;

      // Subtle organic mesh waves driven by time + scroll
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        const yBase = height * (0.28 + i * 0.24);
        ctx.moveTo(0, yBase);
        for (let x = 0; x <= width + waveStep; x += waveStep) {
          const wave =
            Math.sin(x * 0.0022 + time * (1 + i * 0.3) + scrollPhase + i * 1.4) * 28 +
            Math.cos(x * 0.0012 - time * 0.7 - scrollPhase * 0.6) * 16;
          const mouseInfluence = ((pointer.y - height * 0.5) / height) * 24;
          ctx.lineTo(x, yBase + wave + mouseInfluence);
        }
        ctx.strokeStyle =
          i === 1 ? 'rgba(245, 158, 11, 0.042)' : 'rgba(255, 255, 255, 0.022)';
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // Floating spice-gold & ember light orbs with gentle scroll parallax
      for (let idx = 0; idx < orbs.length; idx++) {
        const orb = orbs[idx];
        if (!prefersReducedMotion) {
          orb.x += orb.vx;
          orb.y += orb.vy;

          if (orb.x < -orb.radius * 0.4 || orb.x > width + orb.radius * 0.4) orb.vx *= -1;
          if (orb.y < -orb.radius * 0.4 || orb.y > height + orb.radius * 0.4) orb.vy *= -1;
        }

        const offsetX = (pointer.x - width * 0.5) * 0.032;
        const offsetY =
          (pointer.y - height * 0.5) * 0.032 -
          ((smoothedScroll * (0.04 + idx * 0.015)) % (height * 0.35));
        const cx = orb.x + offsetX;
        const cy = orb.y + offsetY;

        const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, orb.radius);
        gradient.addColorStop(0, `rgba(${orb.color}, ${orb.alpha})`);
        gradient.addColorStop(0.55, `rgba(${orb.color}, ${orb.alpha * 0.35})`);
        gradient.addColorStop(1, `rgba(${orb.color}, 0)`);

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(cx, cy, orb.radius, 0, Math.PI * 2);
        ctx.fill();
      }

      if (!prefersReducedMotion) {
        animationFrameId = window.requestAnimationFrame(renderFrame);
      }
    };

    renderFrame();

    return () => {
      window.cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 h-full w-full"
    />
  );
}
