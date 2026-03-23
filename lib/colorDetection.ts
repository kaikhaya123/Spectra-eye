export type RGB = { r: number; g: number; b: number };

const clampColor = (value: number) => Math.max(0, Math.min(255, Math.round(value)));

const toHexPart = (value: number) => clampColor(value).toString(16).padStart(2, "0");

export const rgbToHex = (rgb: RGB) => {
  return `#${toHexPart(rgb.r)}${toHexPart(rgb.g)}${toHexPart(rgb.b)}`.toUpperCase();
};

export const averagePixelBlock = (
  data: Uint8ClampedArray,
  width: number,
  height: number,
  cx: number,
  cy: number,
  radius: number,
): RGB | null => {
  const xStart = Math.max(0, Math.floor(cx - radius));
  const yStart = Math.max(0, Math.floor(cy - radius));
  const xEnd = Math.min(width - 1, Math.ceil(cx + radius));
  const yEnd = Math.min(height - 1, Math.ceil(cy + radius));

  let rTotal = 0;
  let gTotal = 0;
  let bTotal = 0;
  let count = 0;

  for (let y = yStart; y <= yEnd; y += 1) {
    for (let x = xStart; x <= xEnd; x += 1) {
      const idx = (y * width + x) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];

      // Reject very dark pixels that are likely pupil/eyelash noise.
      if (r + g + b < 45) {
        continue;
      }

      rTotal += r;
      gTotal += g;
      bTotal += b;
      count += 1;
    }
  }

  if (count === 0) {
    return null;
  }

  return {
    r: clampColor(rTotal / count),
    g: clampColor(gTotal / count),
    b: clampColor(bTotal / count),
  };
};

type IrisExtractionOptions = {
  innerRadius: number;
  outerRadius: number;
  minBrightness: number;
  maxBrightness: number;
  minSaturation: number;
};

const DEFAULT_IRIS_OPTIONS: IrisExtractionOptions = {
  innerRadius: 1,
  outerRadius: 8,
  minBrightness: 26,
  maxBrightness: 230,
  minSaturation: 0.06,
};

const rgbToHsv = (r: number, g: number, b: number) => {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;

  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const delta = max - min;

  let hue = 0;
  if (delta !== 0) {
    if (max === rn) {
      hue = ((gn - bn) / delta) % 6;
    } else if (max === gn) {
      hue = (bn - rn) / delta + 2;
    } else {
      hue = (rn - gn) / delta + 4;
    }
    hue *= 60;
    if (hue < 0) {
      hue += 360;
    }
  }

  const saturation = max === 0 ? 0 : delta / max;
  return {
    hue,
    saturation,
    value: max,
  };
};

export const detectIrisColorFromPatch = (
  data: Uint8ClampedArray,
  width: number,
  height: number,
  cx: number,
  cy: number,
  options?: Partial<IrisExtractionOptions>,
): RGB | null => {
  const merged = {
    ...DEFAULT_IRIS_OPTIONS,
    ...options,
  };

  const innerSq = merged.innerRadius * merged.innerRadius;
  const outerSq = merged.outerRadius * merged.outerRadius;

  const sampled: Array<{ r: number; g: number; b: number; sat: number; val: number }> = [];

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const dx = x - cx;
      const dy = y - cy;
      const distanceSq = dx * dx + dy * dy;

      // Use a ring to avoid the darkest center (pupil) and eyelid border.
      if (distanceSq < innerSq || distanceSq > outerSq) {
        continue;
      }

      const idx = (y * width + x) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      const { saturation, value } = rgbToHsv(r, g, b);

      const brightness = value * 255;
      if (brightness < merged.minBrightness || brightness > merged.maxBrightness) {
        continue;
      }

      if (saturation < merged.minSaturation) {
        continue;
      }

      sampled.push({ r, g, b, sat: saturation, val: value });
    }
  }

  if (sampled.length < 10) {
    return null;
  }

  // Drop extreme luminance tails for low-light resilience.
  sampled.sort((a, b) => a.val - b.val);
  const start = Math.floor(sampled.length * 0.12);
  const end = Math.ceil(sampled.length * 0.9);
  const stable = sampled.slice(start, end);

  if (stable.length === 0) {
    return null;
  }

  let rTotal = 0;
  let gTotal = 0;
  let bTotal = 0;
  let weightTotal = 0;

  for (const pixel of stable) {
    const weight = 0.65 + pixel.sat * 1.35;
    rTotal += pixel.r * weight;
    gTotal += pixel.g * weight;
    bTotal += pixel.b * weight;
    weightTotal += weight;
  }

  return {
    r: clampColor(rTotal / weightTotal),
    g: clampColor(gTotal / weightTotal),
    b: clampColor(bTotal / weightTotal),
  };
};
