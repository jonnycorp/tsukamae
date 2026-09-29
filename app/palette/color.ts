// channels 0–1, alpha 0–1
export interface Rgb {
  r: number;
  g: number;
  b: number;
  a: number;
}

// OKLCH: perceptual lightness 0–1, chroma, hue in degrees
export interface Lch {
  l: number;
  c: number;
  h: number;
  alpha?: number;
}

type Triple = [number, number, number];

const toLinear = (v: number) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
const toGamma = (v: number) => (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055);

function linearToOklab ([r, g, b]: Triple): Triple {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s,
  ];
}

function oklabToLinear ([L, a, b]: Triple): Triple {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.2914855480 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s,
  ];
}

function lchToLinear ({ l, c, h }: Lch): Triple {
  const rad = (h * Math.PI) / 180;
  return oklabToLinear([l, c * Math.cos(rad), c * Math.sin(rad)]);
}

const inGamut = (channels: Triple) => channels.every((v) => v >= -1e-4 && v <= 1 + 1e-4);

// out-of-gamut colours give up chroma, never lightness or hue
export function toRgb (color: Lch): Rgb {
  let linear = lchToLinear(color);
  if (!inGamut(linear)) {
    let lo = 0;
    let hi = color.c;
    for (let i = 0; i < 24; i++) {
      const mid = (lo + hi) / 2;
      if (inGamut(lchToLinear({ ...color, c: mid }))) {
        lo = mid;
      } else {
        hi = mid;
      }
    }
    linear = lchToLinear({ ...color, c: lo });
  }
  const [r, g, b] = linear.map((v) => toGamma(Math.min(1, Math.max(0, v))));
  return { r, g, b, a: color.alpha ?? 1 };
}

export function toLch ({ r, g, b, a }: Rgb): Lch {
  const [l, A, B] = linearToOklab([toLinear(r), toLinear(g), toLinear(b)]);
  return { l, c: Math.hypot(A, B), h: ((Math.atan2(B, A) * 180) / Math.PI + 360) % 360, alpha: a };
}

export function cssColor ({ r, g, b, a }: Rgb): string {
  const channel = (v: number) => Math.round(v * 255);
  if (a >= 1) {
    return `#${[r, g, b].map((v) => channel(v).toString(16).padStart(2, '0')).join('')}`;
  }
  return `rgba(${channel(r)}, ${channel(g)}, ${channel(b)}, ${Math.round(a * 1000) / 1000})`;
}

export function parseCssColor (value: string): Rgb {
  const hex = /^#([0-9a-f]{6})$/i.exec(value);
  if (hex) {
    const n = parseInt(hex[1], 16);
    return { r: ((n >> 16) & 255) / 255, g: ((n >> 8) & 255) / 255, b: (n & 255) / 255, a: 1 };
  }
  const rgba = /^rgba\((\d+), (\d+), (\d+), ([\d.]+)\)$/.exec(value);
  if (!rgba) {
    throw new Error(`unparseable colour ${value}`);
  }
  return { r: +rgba[1] / 255, g: +rgba[2] / 255, b: +rgba[3] / 255, a: +rgba[4] };
}

export function over (fg: Rgb, bg: Rgb): Rgb {
  const mix = (f: number, b: number) => f * fg.a + b * (1 - fg.a);
  return { r: mix(fg.r, bg.r), g: mix(fg.g, bg.g), b: mix(fg.b, bg.b), a: 1 };
}

function luminance ({ r, g, b }: Rgb): number {
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

// WCAG 2 ratio; a translucent foreground is composited over the backdrop first
export function contrast (fg: Rgb, bg: Rgb): number {
  const a = luminance(over(fg, bg));
  const b = luminance(bg);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

// euclidean distance in OKLab; about 0.02 is barely noticeable
export function deltaE (x: Rgb, y: Rgb): number {
  const p = linearToOklab([toLinear(x.r), toLinear(x.g), toLinear(x.b)]);
  const q = linearToOklab([toLinear(y.r), toLinear(y.g), toLinear(y.b)]);
  return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
}

export function hueDistance (a: number, b: number): number {
  return Math.abs(((((a - b) % 360) + 540) % 360) - 180);
}
