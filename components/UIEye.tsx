"use client";

import { motion } from "framer-motion";
import { useEffect, useMemo, useRef, useState, type PointerEvent } from "react";

type UIEyeProps = {
  gazeX: number;
  gazeY: number;
  irisHex: string;
  isTracking: boolean;
  rgb: { r: number; g: number; b: number };
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const hexToRgba = (hex: string, alpha: number) => {
  const sanitized = hex.replace("#", "");
  if (sanitized.length !== 6) {
    return `rgba(82, 206, 255, ${alpha})`;
  }

  const r = parseInt(sanitized.slice(0, 2), 16);
  const g = parseInt(sanitized.slice(2, 4), 16);
  const b = parseInt(sanitized.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

export function UIEye({ gazeX, gazeY, irisHex, isTracking, rgb }: UIEyeProps) {
  const eyeRef = useRef<HTMLDivElement | null>(null);

  const maxTravel = 34;
  const [displayGaze, setDisplayGaze] = useState({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);
  const [cursorInfluence, setCursorInfluence] = useState({ x: 0, y: 0, proximity: 0 });
  const [blinkPhase, setBlinkPhase] = useState<"idle" | "closing" | "opening">("idle");

  useEffect(() => {
    let rafId = 0;

    const smooth = () => {
      setDisplayGaze((prev) => ({
        x: prev.x + (gazeX - prev.x) * 0.16,
        y: prev.y + (gazeY - prev.y) * 0.16,
      }));

      rafId = window.requestAnimationFrame(smooth);
    };

    rafId = window.requestAnimationFrame(smooth);
    return () => window.cancelAnimationFrame(rafId);
  }, [gazeX, gazeY]);

  const gazeSpeed = useMemo(() => Math.hypot(gazeX - displayGaze.x, gazeY - displayGaze.y), [displayGaze.x, displayGaze.y, gazeX, gazeY]);
  const focusLock = isTracking && gazeSpeed < 0.03;

  useEffect(() => {
    let timeoutId = 0;
    let isActive = true;

    const scheduleBlink = () => {
      const wait = 3000 + Math.random() * 3000;
      timeoutId = window.setTimeout(() => {
        if (!isActive) {
          return;
        }

        setBlinkPhase("closing");
        window.setTimeout(() => {
          if (!isActive) {
            return;
          }
          setBlinkPhase("opening");
          window.setTimeout(() => {
            if (!isActive) {
              return;
            }
            setBlinkPhase("idle");
            scheduleBlink();
          }, 120);
        }, 130);
      }, wait);
    };

    scheduleBlink();

    return () => {
      isActive = false;
      window.clearTimeout(timeoutId);
    };
  }, []);

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!eyeRef.current) {
      return;
    }

    const rect = eyeRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const dx = event.clientX - centerX;
    const dy = event.clientY - centerY;
    const distance = Math.hypot(dx, dy);
    const maxDistance = rect.width * 0.8;
    const proximity = clamp(1 - distance / maxDistance, 0, 1);

    setCursorInfluence({
      x: clamp(dx / (rect.width / 2), -1, 1),
      y: clamp(dy / (rect.height / 2), -1, 1),
      proximity,
    });
  };

  const onPointerLeave = () => {
    setIsHovered(false);
    setCursorInfluence({ x: 0, y: 0, proximity: 0 });
  };

  const finalX = clamp(displayGaze.x * 0.85 + cursorInfluence.x * 0.15 * cursorInfluence.proximity, -1, 1);
  const finalY = clamp(displayGaze.y * 0.85 + cursorInfluence.y * 0.15 * cursorInfluence.proximity, -1, 1);

  const squintAmount = clamp(gazeSpeed * 6.5, 0, 1);
  const blinkCover = blinkPhase === "idle" ? 0 : blinkPhase === "closing" ? 0.45 : 0.2;
  const lidCover = clamp(blinkCover + squintAmount * 0.18, 0, 0.6);

  const pupilScale = clamp(1 + (isHovered ? 0.1 : 0) + cursorInfluence.proximity * 0.06 - squintAmount * 0.08, 0.9, 1.22);

  const glowColor = hexToRgba(irisHex, 0.42);
  const irisLabel = `HEX ${irisHex} | RGB ${rgb.r}, ${rgb.g}, ${rgb.b}`;

  return (
    <div className="relative flex h-72 w-72 items-center justify-center md:h-80 md:w-80">
      <motion.div
        animate={{
          boxShadow: isTracking
            ? `0 0 0 2px rgba(255,255,255,0.12), 0 0 40px ${hexToRgba(irisHex, 0.25)}, 0 0 95px ${hexToRgba(irisHex, 0.22)}`
            : "0 0 0 1px rgba(255,255,255,0.08), 0 0 40px rgba(0,0,0,0.45)",
        }}
        transition={{ duration: 0.45 }}
        className="absolute inset-4 rounded-full"
      />

      <motion.div
        animate={{ rotate: isTracking ? 360 : 0, opacity: isTracking ? 0.95 : 0.45 }}
        transition={{ rotate: { duration: 10, ease: "linear", repeat: Infinity }, opacity: { duration: 0.4 } }}
        className="pointer-events-none absolute inset-0 rounded-full border border-cyan-200/30"
        style={{
          background:
            "conic-gradient(from 45deg, rgba(72,234,255,0.24), rgba(72,234,255,0.02) 40%, rgba(255,255,255,0.16) 52%, rgba(72,234,255,0.03) 78%, rgba(72,234,255,0.24))",
          maskImage: "radial-gradient(circle, transparent 66%, black 67%)",
        }}
      />

      <motion.div
        animate={{ scale: isTracking ? [1, 1.02, 1] : 1 }}
        transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
        className="pointer-events-none absolute inset-5 rounded-full border border-cyan-100/20"
      />

      <div
        ref={eyeRef}
        onPointerMove={onPointerMove}
        onPointerEnter={() => setIsHovered(true)}
        onPointerLeave={onPointerLeave}
        className="relative z-10 flex h-60 w-60 items-center justify-center overflow-hidden rounded-full border border-white/35 bg-white/10 md:h-64 md:w-64"
      >
        <div className="absolute inset-1 rounded-full bg-[radial-gradient(circle_at_32%_30%,rgba(255,255,255,0.98),rgba(242,247,255,0.92)_35%,rgba(215,227,245,0.75)_62%,rgba(98,120,150,0.38)_100%)]" />

        <motion.div
          animate={{ x: finalX * maxTravel, y: finalY * maxTravel }}
          transition={{ type: "spring", stiffness: 170, damping: 20, mass: 0.95 }}
          className="relative z-20 flex h-[8.5rem] w-[8.5rem] items-center justify-center rounded-full md:h-36 md:w-36"
          style={{
            background: `radial-gradient(circle at 36% 32%, #f6fdff 0%, ${irisHex} 34%, color-mix(in oklab, ${irisHex} 62%, #030716 38%) 72%, #01050f 100%)`,
            boxShadow: `0 0 30px ${glowColor}`,
          }}
        >
          <div className="absolute inset-[18%] rounded-full border border-white/20" />

          <motion.div
            animate={{ scale: pupilScale }}
            transition={{ duration: 0.2 }}
            className="relative z-30 h-11 w-11 rounded-full bg-black shadow-[0_0_24px_rgba(0,0,0,0.82)]"
          >
            <div className="absolute inset-[28%] rounded-full bg-black/85" />
          </motion.div>

          <div className="pointer-events-none absolute left-7 top-6 h-5 w-5 rounded-full bg-white/80 blur-[0.4px]" />
          <div className="pointer-events-none absolute left-12 top-11 h-2.5 w-2.5 rounded-full bg-white/65" />
        </motion.div>

        <motion.div
          animate={{ height: `${lidCover * 100}%` }}
          transition={{ duration: blinkPhase === "idle" ? 0.18 : 0.1 }}
          className="pointer-events-none absolute inset-x-0 top-0 z-30 origin-top bg-[linear-gradient(to_bottom,rgba(3,7,18,0.96),rgba(10,20,38,0.76))]"
        />

        <motion.div
          animate={{ height: `${(lidCover * 0.7) * 100}%` }}
          transition={{ duration: blinkPhase === "idle" ? 0.18 : 0.1 }}
          className="pointer-events-none absolute inset-x-0 bottom-0 z-30 origin-bottom bg-[linear-gradient(to_top,rgba(3,7,18,0.92),rgba(10,20,38,0.64))]"
        />

        <motion.div
          animate={{ opacity: focusLock ? 1 : 0.35, scale: focusLock ? 1.02 : 0.98 }}
          transition={{ duration: 0.25 }}
          className="pointer-events-none absolute inset-2 rounded-full border border-cyan-200/35"
          style={{ boxShadow: focusLock ? `0 0 22px ${hexToRgba(irisHex, 0.35)}` : "none" }}
        />
      </div>

      <motion.div
        animate={{ x: finalX * 14, y: finalY * 14 }}
        transition={{ duration: 0.22 }}
        className="pointer-events-none absolute -bottom-3 left-1/2 z-40 -translate-x-1/2 rounded-full border border-white/25 bg-slate-950/70 px-4 py-1.5 text-[10px] uppercase tracking-[0.2em] text-cyan-100/90 backdrop-blur"
      >
        {irisLabel}
      </motion.div>
    </div>
  );
}
