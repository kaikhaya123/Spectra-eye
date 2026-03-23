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
      const videoConstraints: MediaTrackConstraints = isMobileDevice
        ? {
            width: { ideal: 960 },
            height: { ideal: 540 },
            frameRate: { ideal: 24, max: 30 },
            facingMode: "user",
          }
        : {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            frameRate: { ideal: 30, max: 30 },
            facingMode: "user",
          };

      const stream = await navigator.mediaDevices.getUserMedia({
        video: videoConstraints,
        audio: false,
      });

      videoRef.current.srcObject = stream;
      await videoRef.current.play();
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
