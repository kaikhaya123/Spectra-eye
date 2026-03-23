"use client";

import { motion } from "framer-motion";
import type { RefObject } from "react";

type EyeCanvasProps = {
  videoRef: RefObject<HTMLVideoElement | null>;
  isTracking: boolean;
};

export function EyeCanvas({ videoRef, isTracking }: EyeCanvasProps) {
  return (
    <div className="relative overflow-hidden rounded-3xl border border-white/20 bg-black/60 shadow-2xl backdrop-blur-sm">
      <video
        ref={videoRef}
        muted
        autoPlay
        playsInline
        className="h-[360px] w-full max-w-[640px] object-cover md:h-[420px]"
      />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_10%,rgba(255,255,255,0.22),transparent_45%),linear-gradient(to_top,rgba(0,0,0,0.5),transparent_35%)]" />
      <motion.div
        initial={{ opacity: 0.7, scale: 0.96 }}
        animate={{
          opacity: isTracking ? 0 : 0.8,
          scale: isTracking ? 1.04 : 0.96,
        }}
        transition={{ duration: 0.35 }}
        className="pointer-events-none absolute inset-0 flex items-center justify-center"
      >
        <div className="rounded-full border border-cyan-300/70 bg-cyan-300/10 px-4 py-2 text-sm font-medium tracking-[0.18em] text-cyan-100">
          {isTracking ? "LOCKED" : "SCANNING"}
        </div>
      </motion.div>
    </div>
  );
}
