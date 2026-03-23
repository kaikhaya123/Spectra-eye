# SPECTRAEYE

SPECTRAEYE is a browser-based eye tracker built with Next.js.
It detects face and eye landmarks in real time, animates a UI eye that follows gaze movement, and extracts approximate iris color from webcam pixels.

## Stack

- Next.js (App Router)
- React
- Tailwind CSS
- MediaPipe Tasks Vision (Face Landmarker)
- TensorFlow.js
- Canvas API
- Framer Motion

## Core Features

- Webcam activation with `getUserMedia()`
- Face + eye landmark detection
- Smoothed eye position tracking
- Animated UI eye that follows gaze
- Live eye color sampling from canvas pixels
- Live color display in HEX and RGB

## Project Structure

```text
app/
components/
	EyeTracker.tsx
	EyeCanvas.tsx
	UIEye.tsx
hooks/
	useCamera.ts
	useEyeTracking.ts
lib/
	mediapipe.ts
	colorDetection.ts
public/
```

## Run Locally

```bash
npm install
npm run dev
```

Open http://localhost:3000 in your browser.

## Deployment

Deploy to Vercel:

1. Push to GitHub.
2. Import the repo at https://vercel.com/new.
3. Deploy with default Next.js settings.

## Notes

- The first load may take a moment while MediaPipe model assets initialize.
- Eye color extraction is an approximation and depends on lighting and camera quality.
