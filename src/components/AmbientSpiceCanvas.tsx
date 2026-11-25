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
    const ctxRaw = canvas.getContext('2d', { alpha: true });
    if (!ctxRaw) return;
    const context: CanvasRenderingContext2D = ctxRaw;

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const isCoarsePointer = window.matchMedia('(pointer: coarse)').matches;

    let animationFrameId = 0;
    let isDisposed = false;
    let width =
      Number.isFinite(window.innerWidth) && window.innerWidth > 0 ? window.innerWidth : 0;
    let height =
      Number.isFinite(window.innerHeight) && window.innerHeight > 0 ? window.innerHeight : 0;
    let needsLayoutSeed = width <= 0 || height <= 0;
    let scrollOffset = Number.isFinite(window.scrollY) ? window.scrollY : 0;
    let smoothedScroll = scrollOffset;

    const pointer = {
      x: width * 0.5,
      y: height * 0.35,
      targetX: width * 0.5,
      targetY: height * 0.35,
    };

    const orbPresets = [
      {
        xRatio: 0.2,
        yRatio: 0.25,
        vx: 0.15,
        vy: 0.11,
        mobileRadius: 220,
        desktopRadius: 340,
        color: '245, 158, 11', // Saffron Gold
        alpha: 0.085,
      },
      {
        xRatio: 0.78,
        yRatio: 0.3,
        vx: -0.13,
        vy: 0.14,
        mobileRadius: 240,
        desktopRadius: 380,
        color: '220, 38, 38', // Crimson Chili
        alpha: 0.055,
      },
      {
        xRatio: 0.52,
        yRatio: 0.75,
        vx: 0.11,
        vy: -0.1,
        mobileRadius: 260,
        desktopRadius: 420,
        color: '180, 83, 9', // Warm Roasted Amber
        alpha: 0.075,
      },
      {
        xRatio: 0.85,
        yRatio: 0.82,
        vx: -0.09,
        vy: -0.12,
        mobileRadius: 190,
        desktopRadius: 280,
        color: '16, 185, 129', // Subtle Emerald Leaf hint
        alpha: 0.032,
      },
    ];

    const orbs: LightOrb[] = orbPresets.map((preset) => ({
      x: width * preset.xRatio,
      y: height * preset.yRatio,
      vx: preset.vx,
      vy: preset.vy,
      radius: width < 768 ? preset.mobileRadius : preset.desktopRadius,
      color: preset.color,
      alpha: preset.alpha,
    }));

    const seedLayoutPositions = (w: number, h: number) => {
      pointer.x = w * 0.5;
      pointer.y = h * 0.35;
      pointer.targetX = w * 0.5;
      pointer.targetY = h * 0.35;
      for (let i = 0; i < orbs.length; i++) {
        const preset = orbPresets[i];
        orbs[i].x = w * preset.xRatio;
        orbs[i].y = h * preset.yRatio;
        orbs[i].radius = w < 768 ? preset.mobileRadius : preset.desktopRadius;
      }
      needsLayoutSeed = false;
    };

    const resize = (force = false) => {
      const nextW =
        Number.isFinite(window.innerWidth) && window.innerWidth > 0 ? window.innerWidth : 0;
      const nextH =
        Number.isFinite(window.innerHeight) && window.innerHeight > 0 ? window.innerHeight : 0;
      // Ignore small mobile URL-bar height shifts to prevent scroll jitter
      if (
        !force &&
        width > 0 &&
        height > 0 &&
        nextW === width &&
        Math.abs(nextH - height) < 120
      ) {
        return;
      }
      const rawDpr = isCoarsePointer ? 1 : Math.min(window.devicePixelRatio || 1, 1.75);
      const dpr = Number.isFinite(rawDpr) && rawDpr > 0 ? rawDpr : 1;
      width = nextW;
      height = nextH;

      if (width > 0 && height > 0) {
        if (needsLayoutSeed) {
          seedLayoutPositions(width, height);
        } else {
          for (let i = 0; i < orbs.length; i++) {
            orbs[i].radius = width < 768 ? orbPresets[i].mobileRadius : orbPresets[i].desktopRadius;
          }
        }
      }

      canvas.width = Math.max(0, Math.floor(width * dpr));
      canvas.height = Math.max(0, Math.floor(height * dpr));
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context.setTransform(dpr, 0, 0, dpr, 0, 0);

      if (prefersReducedMotion && !force) {
        renderFrame();
      }
    };

    const handleResize = () => resize(false);

    const handlePointerMove = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return;
      if (Number.isFinite(e.clientX)) pointer.targetX = e.clientX;
      if (Number.isFinite(e.clientY)) pointer.targetY = e.clientY;
    };

    const handleScroll = () => {
      if (Number.isFinite(window.scrollY)) {
        scrollOffset = window.scrollY;
      }
    };

    let time = 0;

    function renderFrame() {
      if (isDisposed) return;

      if (width > 0 && height > 0 && Number.isFinite(width) && Number.isFinite(height)) {
        time += 0.004;

        if (!Number.isFinite(pointer.targetX)) pointer.targetX = width * 0.5;
        if (!Number.isFinite(pointer.targetY)) pointer.targetY = height * 0.35;
        if (!Number.isFinite(pointer.x)) pointer.x = pointer.targetX;
        if (!Number.isFinite(pointer.y)) pointer.y = pointer.targetY;
        if (!Number.isFinite(scrollOffset)) scrollOffset = 0;
        if (!Number.isFinite(smoothedScroll)) smoothedScroll = scrollOffset;

        pointer.x += (pointer.targetX - pointer.x) * 0.04;
        pointer.y += (pointer.targetY - pointer.y) * 0.04;
        smoothedScroll += (scrollOffset - smoothedScroll) * 0.06;

        context.clearRect(0, 0, width, height);

        const waveStep = width < 768 ? 64 : 48;
        const scrollPhase = smoothedScroll * 0.0012;
        const safeHeight = Math.max(1, height);
        const scrollWrapRange = Math.max(1, height * 0.35);

        // Subtle organic mesh waves driven by time + scroll
        for (let i = 0; i < 3; i++) {
          context.beginPath();
          const yBase = height * (0.28 + i * 0.24);
          context.moveTo(0, yBase);
          for (let x = 0; x <= width + waveStep; x += waveStep) {
            const wave =
              Math.sin(x * 0.0022 + time * (1 + i * 0.3) + scrollPhase + i * 1.4) * 28 +
              Math.cos(x * 0.0012 - time * 0.7 - scrollPhase * 0.6) * 16;
            const mouseInfluence = ((pointer.y - height * 0.5) / safeHeight) * 24;
            context.lineTo(x, yBase + wave + mouseInfluence);
          }
          context.strokeStyle =
            i === 1 ? 'rgba(245, 158, 11, 0.042)' : 'rgba(255, 255, 255, 0.022)';
          context.lineWidth = 1;
          context.stroke();
        }

        // Floating spice-gold & ember light orbs with gentle scroll parallax
        for (let idx = 0; idx < orbs.length; idx++) {
          const orb = orbs[idx];
          if (!Number.isFinite(orb.x)) orb.x = width * orbPresets[idx].xRatio;
          if (!Number.isFinite(orb.y)) orb.y = height * orbPresets[idx].yRatio;

          if (!prefersReducedMotion) {
            orb.x += orb.vx;
            orb.y += orb.vy;

            if (orb.x < -orb.radius * 0.4 || orb.x > width + orb.radius * 0.4) orb.vx *= -1;
            if (orb.y < -orb.radius * 0.4 || orb.y > height + orb.radius * 0.4) orb.vy *= -1;
          }

          const offsetX = (pointer.x - width * 0.5) * 0.032;
          const offsetY =
            (pointer.y - height * 0.5) * 0.032 -
            ((smoothedScroll * (0.04 + idx * 0.015)) % scrollWrapRange);
          const cx = orb.x + offsetX;
          const cy = orb.y + offsetY;

          if (
            !Number.isFinite(cx) ||
            !Number.isFinite(cy) ||
            !Number.isFinite(orb.radius) ||
            orb.radius <= 0
          ) {
            continue;
          }

          const gradient = context.createRadialGradient(cx, cy, 0, cx, cy, orb.radius);
          gradient.addColorStop(0, `rgba(${orb.color}, ${orb.alpha})`);
          gradient.addColorStop(0.55, `rgba(${orb.color}, ${orb.alpha * 0.35})`);
          gradient.addColorStop(1, `rgba(${orb.color}, 0)`);

          context.fillStyle = gradient;
          context.beginPath();
          context.arc(cx, cy, orb.radius, 0, Math.PI * 2);
          context.fill();
        }
      }

      if (!prefersReducedMotion && !isDisposed) {
        animationFrameId = window.requestAnimationFrame(renderFrame);
      }
    }

    resize(true);
    window.addEventListener('resize', handleResize, { passive: true });
    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    window.addEventListener('scroll', handleScroll, { passive: true });

    renderFrame();

    return () => {
      isDisposed = true;
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
