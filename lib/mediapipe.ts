import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";

let faceLandmarkerPromise: Promise<FaceLandmarker> | null = null;
let isConsolePatchApplied = false;

const VISION_WASM_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.33/wasm";
const BENIGN_TFLITE_INFO = /Created TensorFlow Lite XNNPACK delegate for CPU\.?/i;

const patchConsoleForBenignTFLiteInfo = () => {
  if (isConsolePatchApplied || typeof window === "undefined") {
    return;
  }

  const originalConsoleError = console.error.bind(console);

  console.error = (...args: unknown[]) => {
    const first = args[0];
    const message =
      typeof first === "string"
        ? first
        : first instanceof Error
          ? first.message
          : "";

    if (BENIGN_TFLITE_INFO.test(message)) {
      return;
    }

    originalConsoleError(...args);
  };

  isConsolePatchApplied = true;
};

export const createFaceLandmarker = async () => {
  if (faceLandmarkerPromise) {
    return faceLandmarkerPromise;
  }

  faceLandmarkerPromise = (async () => {
    patchConsoleForBenignTFLiteInfo();

    const vision = await FilesetResolver.forVisionTasks(VISION_WASM_URL);

    return FaceLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath:
          "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task",
      },
      outputFaceBlendshapes: false,
      outputFacialTransformationMatrixes: false,
      runningMode: "VIDEO",
      numFaces: 1,
      minFaceDetectionConfidence: 0.3,
      minFacePresenceConfidence: 0.3,
      minTrackingConfidence: 0.3,
    });
  })().catch((error) => {
    // Clear failed initialization so the next user attempt can retry.
    faceLandmarkerPromise = null;
    throw error;
  });

  return faceLandmarkerPromise;
};
