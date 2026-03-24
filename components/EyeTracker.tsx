"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";

import { EyeCanvas } from "@/components/EyeCanvas";
import { UIEye } from "@/components/UIEye";
import { useCamera } from "@/hooks/useCamera";
import { useEyeTracking } from "@/hooks/useEyeTracking";

const CALIBRATION_STORAGE_KEY = "spectraeye-calibration-v1";
const OPENCV_STORAGE_KEY = "spectraeye-opencv-enhancement-v1";
const MOBILE_BRIGHTNESS_ASSIST_STORAGE_KEY = "spectraeye-mobile-brightness-assist-v1";
const IMMERSIVE_MODE_STORAGE_KEY = "spectraeye-immersive-mode-v1";

type CalibrationOffset = {
  x: number;
  y: number;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const isCalibrationOffset = (value: unknown): value is CalibrationOffset => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const maybeValue = value as Record<string, unknown>;
  return typeof maybeValue.x === "number" && typeof maybeValue.y === "number";
};

export function EyeTracker() {
  const { videoRef, isReady, isStarting, error, isMobileDevice, startCamera } = useCamera();
  const [useOpenCvEnhancement, setUseOpenCvEnhancement] = useState(false);
  const [mobileBrightnessAssist, setMobileBrightnessAssist] = useState(true);
  const [immersiveMode, setImmersiveMode] = useState(false);
  const [calibrationOffset, setCalibrationOffset] = useState<CalibrationOffset>({ x: 0, y: 0 });
  const [showCalibration, setShowCalibration] = useState(false);
  const [hasHydratedSettings, setHasHydratedSettings] = useState(false);

  const {
    gazeX,
    gazeY,
    leftGazeX,
    leftGazeY,
    rightGazeX,
    rightGazeY,
    leftEyeOpen,
    rightEyeOpen,
    eyeColorHex,
    eyeColorRgb,
    isTracking,
    isModelReady,
    trackingError,
    trackingHint,
    sceneBrightness,
    processingFps,
  } = useEyeTracking(videoRef, isReady, {
    useOpenCvEnhancement,
    calibrationOffset,
    isMobileDevice,
    mobileBrightnessAssist,
  });

  useEffect(() => {
    try {
      const rawCalibration = window.localStorage.getItem(CALIBRATION_STORAGE_KEY);
      if (rawCalibration) {
        const parsed = JSON.parse(rawCalibration);
        if (isCalibrationOffset(parsed)) {
          setCalibrationOffset({
            x: clamp(parsed.x, -1, 1),
            y: clamp(parsed.y, -1, 1),
          });
          setShowCalibration(false);
        } else {
          setShowCalibration(true);
        }
      } else {
        setShowCalibration(true);
      }

      const rawOpenCv = window.localStorage.getItem(OPENCV_STORAGE_KEY);
      setUseOpenCvEnhancement(rawOpenCv === "true");

      const rawMobileBrightnessAssist = window.localStorage.getItem(MOBILE_BRIGHTNESS_ASSIST_STORAGE_KEY);
      if (rawMobileBrightnessAssist === null) {
        setMobileBrightnessAssist(true);
      } else {
        setMobileBrightnessAssist(rawMobileBrightnessAssist === "true");
      }

      const rawImmersiveMode = window.localStorage.getItem(IMMERSIVE_MODE_STORAGE_KEY);
      setImmersiveMode(rawImmersiveMode === "true");
    } finally {
      setHasHydratedSettings(true);
    }
  }, []);

  const saveCalibration = (nextOffset: CalibrationOffset) => {
    setCalibrationOffset(nextOffset);
    window.localStorage.setItem(CALIBRATION_STORAGE_KEY, JSON.stringify(nextOffset));
  };

  const calibrateFromCurrentGaze = () => {
    const nextOffset = {
      x: clamp(-gazeX, -1, 1),
      y: clamp(-gazeY, -1, 1),
    };
    saveCalibration(nextOffset);
    setShowCalibration(false);
  };

  const resetCalibration = () => {
    const nextOffset = { x: 0, y: 0 };
    saveCalibration(nextOffset);
    setShowCalibration(true);
  };

  const toggleOpenCvEnhancement = () => {
    const nextValue = !useOpenCvEnhancement;
    setUseOpenCvEnhancement(nextValue);
    window.localStorage.setItem(OPENCV_STORAGE_KEY, String(nextValue));
  };

  const toggleMobileBrightnessAssist = () => {
    const nextValue = !mobileBrightnessAssist;
    setMobileBrightnessAssist(nextValue);
    window.localStorage.setItem(MOBILE_BRIGHTNESS_ASSIST_STORAGE_KEY, String(nextValue));
  };

  const toggleImmersiveMode = () => {
    const nextValue = !immersiveMode;
    setImmersiveMode(nextValue);
    window.localStorage.setItem(IMMERSIVE_MODE_STORAGE_KEY, String(nextValue));
  };

  return (
    <main
      className={`relative mx-auto flex min-h-screen w-full flex-col gap-8 text-white transition-all duration-500 ${
        immersiveMode ? "max-w-none px-3 pb-8 pt-5 md:px-10 md:py-8" : "max-w-6xl px-3 pb-10 pt-7 md:px-8 md:py-10"
      }`}
      style={{ paddingTop: "max(env(safe-area-inset-top), 0.75rem)", paddingBottom: "max(env(safe-area-inset-bottom), 1rem)" }}
    >
      {immersiveMode && (
        <motion.div
          aria-hidden
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4 }}
          className="pointer-events-none fixed inset-0 -z-20"
          style={{
            background:
              "radial-gradient(circle at 50% 42%, rgba(120, 245, 255, 0.18) 0%, rgba(12, 25, 48, 0.9) 45%, rgba(4, 7, 15, 0.98) 100%)",
          }}
        />
      )}

      <motion.div
        aria-hidden
        animate={{ opacity: isTracking ? 0.22 : 0.08 }}
        transition={{ duration: 0.5 }}
        className="pointer-events-none absolute inset-0 -z-10 rounded-[3rem] blur-3xl"
        style={{
          background: `radial-gradient(circle at 50% 45%, ${eyeColorHex}66 0%, transparent 60%)`,
        }}
      />

      <motion.section
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="space-y-4"
      >
        <p className="text-xs uppercase tracking-[0.32em] text-cyan-200/80">SPECTRAEYE</p>
        <h1 className="max-w-3xl text-3xl font-semibold leading-tight md:text-5xl">
          Real-time eye tracking and iris color extraction in your browser.
        </h1>
        <p className="max-w-2xl text-sm text-slate-200/80 md:text-base">
          Powered by Next.js, MediaPipe Face Landmarker, TensorFlow.js, Canvas APIs, and Framer Motion.
        </p>
        {isMobileDevice && (
          <p className="max-w-2xl text-xs uppercase tracking-[0.17em] text-amber-100/85">
            Mobile mode active: raise screen brightness and keep your face brightly lit for best lock quality.
          </p>
        )}
      </motion.section>

      <motion.section
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="flex justify-center"
      >
        <div className="flex items-center justify-center gap-6">
          <UIEye gazeX={leftGazeX} gazeY={leftGazeY} irisHex={eyeColorHex} isTracking={isTracking} rgb={eyeColorRgb} isMobileDevice={isMobileDevice} eyeOpenness={leftEyeOpen} />
          <UIEye gazeX={rightGazeX} gazeY={rightGazeY} irisHex={eyeColorHex} isTracking={isTracking} rgb={eyeColorRgb} isMobileDevice={isMobileDevice} eyeOpenness={rightEyeOpen} />
        </div>
      </motion.section>

      <section className={`grid items-start gap-5 ${immersiveMode ? "min-h-[78vh] lg:grid-cols-[1.24fr_0.76fr]" : "lg:grid-cols-[1.1fr_0.9fr]"}`}>
        <EyeCanvas videoRef={videoRef} isTracking={isTracking} isModelReady={isModelReady} isMobileDevice={isMobileDevice} />

        <motion.div
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.15 }}
          className="flex flex-col gap-6 rounded-3xl p-6 shadow-xl backdrop-blur"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={startCamera}
              disabled={isStarting || isReady}
              className="rounded-full px-4 py-2 text-xs font-medium tracking-[0.14em] text-cyan-100 transition disabled:cursor-not-allowed disabled:opacity-60 md:px-5 md:text-sm md:tracking-wide"
            >
              {isReady ? "Camera Active" : isStarting ? "Starting..." : "Enable Webcam"}
            </button>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={toggleImmersiveMode}
                className={`rounded-full px-3 py-1 text-xs font-medium tracking-[0.14em] transition ${
                  immersiveMode
                    ? "text-teal-100"
                    : "text-slate-200"
                }`}
              >
                {immersiveMode ? "Immersive ON" : "Immersive OFF"}
              </button>
              <button
                type="button"
                onClick={toggleOpenCvEnhancement}
                className={`rounded-full px-3 py-1 text-xs font-medium tracking-[0.14em] transition ${
                  useOpenCvEnhancement
                    ? "text-cyan-100"
                    : "text-slate-200"
                }`}
              >
                {useOpenCvEnhancement ? "OpenCV ON" : "OpenCV OFF"}
              </button>
              {isMobileDevice && (
                <button
                  type="button"
                  onClick={toggleMobileBrightnessAssist}
                  className={`rounded-full px-3 py-1 text-xs font-medium tracking-[0.14em] transition ${
                    mobileBrightnessAssist
                      ? "text-amber-100"
                      : "text-slate-200"
                  }`}
                >
                  {mobileBrightnessAssist ? "Brightness Assist ON" : "Brightness Assist OFF"}
                </button>
              )}
              <div
                className={`rounded-full px-3 py-1 text-xs font-medium tracking-[0.18em] ${
                  isTracking ? "bg-emerald-300/20 text-emerald-100" : "bg-slate-300/10 text-slate-200"
                }`}
              >
                {isTracking ? "TRACKING" : "IDLE"}
              </div>
            </div>
          </div>

          <div className="min-w-48 space-y-3">
            <div className="h-16 w-16 rounded-2xl shadow-inner" style={{ backgroundColor: eyeColorHex }} />
            <p className="text-sm font-semibold tracking-wide">HEX: {eyeColorHex}</p>
            <p className="text-sm text-slate-200/85">
              RGB: ({eyeColorRgb.r}, {eyeColorRgb.g}, {eyeColorRgb.b})
            </p>
            <p className="text-xs uppercase tracking-[0.22em] text-cyan-100/80">
              X: {gazeX.toFixed(2)} | Y: {gazeY.toFixed(2)}
            </p>
            <p className="text-xs text-slate-300/80">
              Cal: ({calibrationOffset.x.toFixed(2)}, {calibrationOffset.y.toFixed(2)})
            </p>
            <p className="text-xs text-slate-300/80">
              Light: {sceneBrightness.toFixed(0)} / 255
            </p>
            <p className="text-xs text-slate-300/80">FPS: {processingFps.toFixed(0)}</p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setShowCalibration(true)}
              className="rounded-full px-3 py-1 text-xs tracking-[0.14em] text-cyan-100 transition"
            >
              Open Calibration
            </button>
            <button
              type="button"
              onClick={resetCalibration}
              className="rounded-full px-3 py-1 text-xs tracking-[0.14em] text-slate-100 transition"
            >
              Reset Calibration
            </button>
          </div>

          {(error || trackingError) && (
            <div className="rounded-xl px-3 py-2 text-sm text-rose-100">
              {error ?? trackingError}
            </div>
          )}

          {!error && !trackingError && trackingHint && (
            <div className="rounded-xl px-3 py-2 text-sm text-amber-100">
              {trackingHint}
            </div>
          )}
        </motion.div>
      </section>

      {immersiveMode && (
        <button
          type="button"
          onClick={toggleImmersiveMode}
          className="fixed right-4 top-4 z-30 rounded-full px-4 py-2 text-xs tracking-[0.18em] text-slate-100 backdrop-blur transition"
        >
          Exit Immersive
        </button>
      )}

      {hasHydratedSettings && showCalibration && (
        <motion.section
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm"
        >
          <div className="w-full max-w-lg space-y-4 rounded-2xl p-6 shadow-2xl">
            <h2 className="text-xl font-semibold">Calibration</h2>
            <p className="text-sm text-slate-200/85">
              Look straight at the center of your screen, then capture your current gaze so SPECTRAEYE can offset drift.
            </p>
            <ol className="list-decimal space-y-1 pl-5 text-sm text-slate-200/85">
              <li>Enable webcam and wait for TRACKING.</li>
              <li>Keep your head still and eyes centered.</li>
              <li>Click the calibration button below.</li>
            </ol>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={!isTracking}
                onClick={calibrateFromCurrentGaze}
                className="rounded-full px-4 py-2 text-sm text-cyan-100 transition disabled:cursor-not-allowed disabled:opacity-50"
              >
                Set Current Gaze As Center
              </button>
              <button
                type="button"
                onClick={() => setShowCalibration(false)}
                className="rounded-full px-4 py-2 text-sm text-slate-100 transition"
              >
                Continue Without Recalibrating
              </button>
            </div>
          </div>
        </motion.section>
      )}
    </main>
  );
}
