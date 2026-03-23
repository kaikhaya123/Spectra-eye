"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const detectMobileDevice = () => {
  if (typeof navigator === "undefined") {
    return false;
  }

  const ua = navigator.userAgent || "";
  return /Android|iPhone|iPad|iPod|Mobile/i.test(ua);
};

export const useCamera = () => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isMobileDevice, setIsMobileDevice] = useState(false);

  useEffect(() => {
    setIsMobileDevice(detectMobileDevice());
  }, []);

  const stopCamera = useCallback(() => {
    const video = videoRef.current;
    const stream = video?.srcObject;

    if (stream instanceof MediaStream) {
      stream.getTracks().forEach((track) => track.stop());
    }

    if (video) {
      video.srcObject = null;
    }

    setIsReady(false);
  }, []);

  const startCamera = useCallback(async () => {
    if (!videoRef.current) {
      setError("Camera video element is not mounted yet.");
      return;
    }

    setIsStarting(true);
    setError(null);

    try {
      const candidates: Array<MediaTrackConstraints | boolean> = isMobileDevice
        ? [
            {
              width: { ideal: 960 },
              height: { ideal: 540 },
              frameRate: { ideal: 24, max: 30 },
              facingMode: { ideal: "user" },
            },
            {
              width: { ideal: 640 },
              height: { ideal: 480 },
              frameRate: { ideal: 20, max: 24 },
              facingMode: "user",
            },
            { facingMode: "user" },
            true,
          ]
        : [
            {
              width: { ideal: 1280 },
              height: { ideal: 720 },
              frameRate: { ideal: 30, max: 30 },
              facingMode: "user",
            },
            {
              width: { ideal: 960 },
              height: { ideal: 540 },
              frameRate: { ideal: 24, max: 30 },
              facingMode: "user",
            },
            true,
          ];

      let stream: MediaStream | null = null;
      let lastError: unknown = null;

      for (const videoConstraints of candidates) {
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: videoConstraints,
            audio: false,
          });
          break;
        } catch (candidateError) {
          lastError = candidateError;
        }
      }

      if (!stream) {
        throw lastError ?? new Error("Unable to access your webcam.");
      }

      const video = videoRef.current;
      video.srcObject = stream;
      video.muted = true;
      video.playsInline = true;
      video.setAttribute("playsinline", "true");
      video.setAttribute("webkit-playsinline", "true");

      await video.play();
      setIsReady(true);
    } catch (cameraError) {
      const message =
        cameraError instanceof Error
          ? cameraError.message
          : "Unable to access your webcam.";
      setError(message);
      stopCamera();
    } finally {
      setIsStarting(false);
    }
  }, [isMobileDevice, stopCamera]);

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  return {
    videoRef,
    isReady,
    isStarting,
    error,
    isMobileDevice,
    startCamera,
    stopCamera,
  };
};
