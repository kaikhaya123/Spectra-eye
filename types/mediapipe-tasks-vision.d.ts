declare module "@mediapipe/tasks-vision" {
  export type NormalizedLandmark = {
    x: number;
    y: number;
    z?: number;
  };

  export type FaceLandmarkerResult = {
    faceLandmarks: NormalizedLandmark[][];
  };

  export class FilesetResolver {
    static forVisionTasks(basePath: string): Promise<unknown>;
  }

  export class FaceLandmarker {
    static createFromOptions(vision: unknown, options: unknown): Promise<FaceLandmarker>;
    detectForVideo(video: HTMLVideoElement, timestampMs: number): FaceLandmarkerResult;
  }
}
