"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";

import { averagePixelBlock, detectIrisColorFromPatch, rgbToHex } from "@/lib/colorDetection";
import { createFaceLandmarker } from "@/lib/mediapipe";
import { denoiseImageDataWithOpenCv, loadOpenCv } from "@/lib/opencv";

type RGB = { r: number; g: number; b: number };

type EyeTrackingState = {
  gazeX: number;
  gazeY: number;
  eyeColorHex: string;
  eyeColorRgb: RGB;
  isTracking: boolean;
  isModelReady: boolean;
  trackingError: string | null;
  trackingHint: string | null;
  sceneBrightness: number;
  processingFps: number;
};

type CalibrationOffset = {
  x: number;
  y: number;
};

type EyeTrackingOptions = {
  useOpenCvEnhancement?: boolean;
  calibrationOffset?: CalibrationOffset;
  isMobileDevice?: boolean;
  mobileBrightnessAssist?: boolean;
};

type NormalizedLandmark = {
  x: number;
  y: number;
};

type FaceLandmarkerResult = {
  faceLandmarks: NormalizedLandmark[][];
};

const LEFT_EYE_INDICES = [33, 133, 159, 145, 153, 154, 155, 246];
const RIGHT_EYE_INDICES = [362, 263, 386, 374, 380, 381, 382, 398];

const INITIAL_RGB: RGB = { r: 180, g: 180, b: 180 };
const INITIAL_STATE: EyeTrackingState = {
  gazeX: 0,
  gazeY: 0,
  eyeColorHex: "#B4B4B4",
  eyeColorRgb: INITIAL_RGB,
  isTracking: false,
  isModelReady: false,
  trackingError: null,
  trackingHint: null,
  sceneBrightness: 0,
  processingFps: 0,
};

const BRIGHT_SCENE_THRESHOLD = 105;
const MOBILE_SAMPLE_SIZE = 34;
const DESKTOP_SAMPLE_SIZE = 48;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const averageLandmarks = (landmarks: NormalizedLandmark[], indices: number[]) => {
  const total = indices.reduce(
    (acc, idx) => {
      const point = landmarks[idx];
      return {
        x: acc.x + point.x,
        y: acc.y + point.y,
      };
    },
    { x: 0, y: 0 },
  );

  return {
    x: total.x / indices.length,
    y: total.y / indices.length,
  };
};

const getEyeInfo = (result: FaceLandmarkerResult) => {
  const face = result.faceLandmarks[0];
  if (!face) {
    return null;
  }

  const leftCenter = averageLandmarks(face, LEFT_EYE_INDICES);
  const rightCenter = averageLandmarks(face, RIGHT_EYE_INDICES);

  const x = (leftCenter.x + rightCenter.x) / 2;
  const y = (leftCenter.y + rightCenter.y) / 2;

  return {
    combinedCenter: { x, y },
    leftCenter,
    rightCenter,
  };
};

export const useEyeTracking = (
  videoRef: RefObject<HTMLVideoElement | null>,
  isCameraReady: boolean,
  options?: EyeTrackingOptions,
) => {
  const [state, setState] = useState<EyeTrackingState>(INITIAL_STATE);
  const rafRef = useRef<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const smoothRef = useRef({ x: 0, y: 0 });
  const openCvRef = useRef<Awaited<ReturnType<typeof loadOpenCv>> | null>(null);
  const openCvErrorRef = useRef<string | null>(null);
  const lastProcessTimeRef = useRef(0);
  const adaptiveIntervalMsRef = useRef(34);

  const useOpenCvEnhancement = options?.useOpenCvEnhancement ?? false;
  const calibrationOffset = options?.calibrationOffset ?? { x: 0, y: 0 };
  const isMobileDevice = options?.isMobileDevice ?? false;
  const mobileBrightnessAssist = options?.mobileBrightnessAssist ?? false;

  const extractEyeColor = useCallback((video: HTMLVideoElement, eyeCenter: { x: number; y: number }) => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return null;
    }

    const width = video.videoWidth;
    const height = video.videoHeight;
    if (!width || !height) {
      return null;
    }

    const sampleSize = isMobileDevice ? MOBILE_SAMPLE_SIZE : DESKTOP_SAMPLE_SIZE;

    canvas.width = sampleSize;
    canvas.height = sampleSize;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) {
      return null;
    }

    const px = eyeCenter.x * width;
    const py = eyeCenter.y * height;
    const cropRadius = Math.max(8, Math.round(Math.min(width, height) * (isMobileDevice ? 0.035 : 0.028)));
    const sx = clamp(Math.floor(px - cropRadius), 0, Math.max(0, width - 1));
    const sy = clamp(Math.floor(py - cropRadius), 0, Math.max(0, height - 1));
    const sw = Math.max(2, Math.min(cropRadius * 2 + 1, width - sx));
    const sh = Math.max(2, Math.min(cropRadius * 2 + 1, height - sy));

    ctx.drawImage(video, sx, sy, sw, sh, 0, 0, sampleSize, sampleSize);

    const image = ctx.getImageData(0, 0, sampleSize, sampleSize);

    const enhancedImage =
      useOpenCvEnhancement && openCvRef.current ? denoiseImageDataWithOpenCv(image, openCvRef.current) : image;

    const irisColor = detectIrisColorFromPatch(
      enhancedImage.data,
      enhancedImage.width,
      enhancedImage.height,
      enhancedImage.width / 2,
      enhancedImage.height / 2,
      {
        innerRadius: Math.max(3, Math.floor(sampleSize * 0.16)),
        outerRadius: Math.max(7, Math.floor(sampleSize * 0.45)),
      },
    );

    let brightnessTotal = 0;
    let brightnessCount = 0;
    const stride = Math.max(1, Math.floor(enhancedImage.width / 8));

    for (let sampleY = 0; sampleY < enhancedImage.height; sampleY += stride) {
      for (let sampleX = 0; sampleX < enhancedImage.width; sampleX += stride) {
        const idx = (sampleY * enhancedImage.width + sampleX) * 4;
        const r = enhancedImage.data[idx];
        const g = enhancedImage.data[idx + 1];
        const b = enhancedImage.data[idx + 2];
        const luminance = r * 0.299 + g * 0.587 + b * 0.114;
        brightnessTotal += luminance;
        brightnessCount += 1;
      }
    }

    const sceneBrightness = brightnessCount > 0 ? brightnessTotal / brightnessCount : 0;

    if (irisColor) {
      return {
        rgb: irisColor,
        sceneBrightness,
      };
    }

    const fallbackRgb = averagePixelBlock(
      enhancedImage.data,
      enhancedImage.width,
      enhancedImage.height,
      enhancedImage.width / 2,
      enhancedImage.height / 2,
      Math.max(2, Math.floor(sampleSize * 0.45)),
    );

    return {
      rgb: fallbackRgb,
      sceneBrightness,
    };
  }, [isMobileDevice, useOpenCvEnhancement]);

  useEffect(() => {
    canvasRef.current = document.createElement("canvas");
  }, []);

  // Pre-warm: start downloading the model immediately on mount, in parallel with
  // camera setup. createFaceLandmarker() is singleton so this just kicks off the
  // fetch early. Once it resolves we mark the model as ready so the UI can
  // distinguish "model loading" from "face not yet detected".
  useEffect(() => {
    createFaceLandmarker()
      .then(() => setState((prev) => ({ ...prev, isModelReady: true })))
      .catch(() => {
        // Errors will surface in the main tracking effect's catch block.
      });
  }, []);

  useEffect(() => {
    if (!isCameraReady || !videoRef.current) {
      return;
    }

    adaptiveIntervalMsRef.current = isMobileDevice ? 42 : 34;

    let cancelled = false;

    const run = async () => {
      try {
        const landmarker = await createFaceLandmarker();
        // Model loaded (or was already cached) — mark it ready in case the
        // pre-warm effect hasn't fired yet (e.g. very fast local device).
        setState((prev) => ({ ...prev, isModelReady: true }));
        const video = videoRef.current;
        if (!video || cancelled) {
          return;
        }

        const tick = () => {
          if (!videoRef.current || cancelled) {
            return;
          }

          const frameStartedAt = performance.now();
          const elapsedFromLast = frameStartedAt - lastProcessTimeRef.current;
          if (elapsedFromLast < adaptiveIntervalMsRef.current) {
            rafRef.current = requestAnimationFrame(tick);
            return;
          }

          lastProcessTimeRef.current = frameStartedAt;

          const currentVideo = videoRef.current;
          if (currentVideo.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
            rafRef.current = requestAnimationFrame(tick);
            return;
          }

          const result = landmarker.detectForVideo(currentVideo, performance.now());
          const eyeInfo = getEyeInfo(result);

          if (!eyeInfo) {
            setState((prev) => ({ ...prev, isTracking: false }));
            rafRef.current = requestAnimationFrame(tick);
            return;
          }

          const targetX = clamp((eyeInfo.combinedCenter.x - 0.5) * 2.4 + calibrationOffset.x, -1, 1);
          const targetY = clamp((eyeInfo.combinedCenter.y - 0.5) * 2.4 + calibrationOffset.y, -1, 1);

          // Lightweight low-pass filter to avoid jitter in pupil movement.
          smoothRef.current.x = smoothRef.current.x * 0.82 + targetX * 0.18;
          smoothRef.current.y = smoothRef.current.y * 0.82 + targetY * 0.18;

          const sampled = extractEyeColor(currentVideo, eyeInfo.leftCenter);
          const rgb = sampled?.rgb ?? null;
          const sceneBrightness = sampled?.sceneBrightness ?? 0;
          const isBrightScene = sceneBrightness >= BRIGHT_SCENE_THRESHOLD;

          const currentProcessingMs = performance.now() - frameStartedAt;
          const processingFps = currentProcessingMs > 0 ? 1000 / currentProcessingMs : 0;

          if (currentProcessingMs > (isMobileDevice ? 42 : 30)) {
            adaptiveIntervalMsRef.current = Math.min(isMobileDevice ? 92 : 48, adaptiveIntervalMsRef.current + 4);
          } else if (currentProcessingMs < (isMobileDevice ? 25 : 18)) {
            adaptiveIntervalMsRef.current = Math.max(isMobileDevice ? 30 : 18, adaptiveIntervalMsRef.current - 2);
          }

          const brightnessHint =
            mobileBrightnessAssist && isMobileDevice && !isBrightScene
              ? "Tracking quality may be reduced. Increase screen brightness and move toward stronger front lighting for better eye lock."
              : null;

          setState((prev) => ({
            gazeX: smoothRef.current.x,
            gazeY: smoothRef.current.y,
            eyeColorRgb: rgb ?? prev.eyeColorRgb,
            eyeColorHex: rgb ? rgbToHex(rgb) : prev.eyeColorHex,
            isTracking: true,
            isModelReady: true,
            trackingError: null,
            trackingHint: brightnessHint,
            sceneBrightness,
            processingFps,
          }));

          rafRef.current = requestAnimationFrame(tick);
        };

        tick();
      } catch (error) {
        const baseMessage =
          error instanceof Error
            ? `Unable to start eye tracking: ${error.message}`
            : "Unable to start eye tracking: initialization failed.";
        const message = openCvErrorRef.current ? `${baseMessage} (${openCvErrorRef.current})` : baseMessage;
        setState((prev) => ({ ...prev, isTracking: false, trackingError: message }));
      }
    };

    run();

    return () => {
      cancelled = true;
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [
    calibrationOffset.x,
    calibrationOffset.y,
    extractEyeColor,
    isCameraReady,
    isMobileDevice,
    mobileBrightnessAssist,
    useOpenCvEnhancement,
    videoRef,
  ]);

  useEffect(() => {
    if (!useOpenCvEnhancement) {
      return;
    }

    let active = true;

    loadOpenCv()
      .then((cv) => {
        if (!active) {
          return;
        }
        openCvRef.current = cv;
      })
      .catch((error) => {
        if (!active) {
          return;
        }
        openCvRef.current = null;
        openCvErrorRef.current =
          error instanceof Error ? `OpenCV enhancement unavailable: ${error.message}` : "OpenCV enhancement unavailable.";
      });

    return () => {
      active = false;
    };
  }, [useOpenCvEnhancement]);

  return useMemo(
    () => ({
      ...state,
      isTracking: state.isTracking && isCameraReady,
    }),
    [isCameraReady, state],
  );
};
