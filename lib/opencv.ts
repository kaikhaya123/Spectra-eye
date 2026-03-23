type OpenCvLike = {
  Mat: new () => {
    data: Uint8Array;
    delete: () => void;
  };
  Size: new (width: number, height: number) => unknown;
  BORDER_DEFAULT: number;
  GaussianBlur: (
    src: { delete: () => void },
    dst: { delete: () => void },
    ksize: unknown,
    sigmaX: number,
    sigmaY: number,
    borderType: number,
  ) => void;
  matFromImageData?: (imageData: ImageData) => {
    data: Uint8Array;
    delete: () => void;
  };
  onRuntimeInitialized?: () => void;
};

declare global {
  interface Window {
    cv?: OpenCvLike;
  }
}

const OPENCV_SRC = "https://docs.opencv.org/4.10.0/opencv.js";
let loadPromise: Promise<OpenCvLike> | null = null;

const waitForCvReady = () => {
  return new Promise<OpenCvLike>((resolve, reject) => {
    const timeoutMs = 20000;
    const started = Date.now();

    const checkReady = () => {
      const cv = window.cv;
      if (cv?.Mat && cv?.matFromImageData) {
        resolve(cv);
        return;
      }

      if (Date.now() - started > timeoutMs) {
        reject(new Error("OpenCV.js timed out while loading."));
        return;
      }

      window.setTimeout(checkReady, 120);
    };

    checkReady();
  });
};

export const loadOpenCv = async () => {
  if (typeof window === "undefined") {
    throw new Error("OpenCV can only be loaded in the browser.");
  }

  if (window.cv?.Mat && window.cv?.matFromImageData) {
    return window.cv;
  }

  if (loadPromise) {
    return loadPromise;
  }

  loadPromise = new Promise<OpenCvLike>((resolve, reject) => {
    const existingScript = document.querySelector<HTMLScriptElement>('script[data-opencv="true"]');

    const onReady = () => {
      waitForCvReady().then(resolve).catch(reject);
    };

    if (existingScript) {
      onReady();
      return;
    }

    const script = document.createElement("script");
    script.src = OPENCV_SRC;
    script.async = true;
    script.defer = true;
    script.dataset.opencv = "true";

    script.onload = () => {
      if (window.cv) {
        const currentRuntimeInit = window.cv.onRuntimeInitialized;
        window.cv.onRuntimeInitialized = () => {
          currentRuntimeInit?.();
          onReady();
        };
      } else {
        onReady();
      }
    };

    script.onerror = () => {
      loadPromise = null;
      reject(new Error("Failed to load OpenCV.js script."));
    };

    document.body.appendChild(script);
  }).catch((error) => {
    loadPromise = null;
    throw error;
  });

  return loadPromise;
};

export const denoiseImageDataWithOpenCv = (imageData: ImageData, cv: OpenCvLike) => {
  let src: { data: Uint8Array; delete: () => void } | null = null;
  let dst: { data: Uint8Array; delete: () => void } | null = null;

  try {
    if (!cv.matFromImageData) {
      return imageData;
    }

    src = cv.matFromImageData(imageData);
    dst = new cv.Mat();

    cv.GaussianBlur(src, dst, new cv.Size(3, 3), 0, 0, cv.BORDER_DEFAULT);

    return new ImageData(new Uint8ClampedArray(dst.data), imageData.width, imageData.height);
  } catch {
    return imageData;
  } finally {
    src?.delete();
    dst?.delete();
  }
};
