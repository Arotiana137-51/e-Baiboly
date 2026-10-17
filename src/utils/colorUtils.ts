export const hexToRgba = (hex: string, alpha: number): string => {
  const normalized = hex.replace('#', '');
  const parsed =
    normalized.length === 3
      ? normalized
          .split('')
          .map(ch => ch + ch)
          .join('')
      : normalized;

  const int = parseInt(parsed, 16);
  const r = (int >> 16) & 255;
  const g = (int >> 8) & 255;
  const b = int & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const parseHex = (hex: string): {r: number; g: number; b: number} | null => {
  const normalized = hex.replace('#', '').trim();
  if (normalized.length !== 3 && normalized.length !== 6) return null;
  const expanded =
    normalized.length === 3
      ? normalized.split('').map(ch => ch + ch).join('')
      : normalized;
  const int = parseInt(expanded, 16);
  if (Number.isNaN(int)) return null;
  return {r: (int >> 16) & 255, g: (int >> 8) & 255, b: int & 255};
};

const toHex = (r: number, g: number, b: number): string => {
  const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
  const h = (n: number) => clamp(n).toString(16).padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}`;
};

// Lighten a hex color by mixing it toward white. amount is 0..1 (0 = same, 1 = white).
export const lightenHex = (hex: string, amount: number): string => {
  const parsed = parseHex(hex);
  if (!parsed) return hex;
  const t = Math.max(0, Math.min(1, amount));
  const r = parsed.r + (255 - parsed.r) * t;
  const g = parsed.g + (255 - parsed.g) * t;
  const b = parsed.b + (255 - parsed.b) * t;
  return toHex(r, g, b);
};

// Darken a hex color by mixing it toward black. amount is 0..1 (0 = same, 1 = black).
export const darkenHex = (hex: string, amount: number): string => {
  const parsed = parseHex(hex);
  if (!parsed) return hex;
  const t = Math.max(0, Math.min(1, amount));
  const r = parsed.r * (1 - t);
  const g = parsed.g * (1 - t);
  const b = parsed.b * (1 - t);
  return toHex(r, g, b);
};

// Reduce saturation by mixing each channel toward the color's own grayscale value.
// amount is 0..1 (0 = same, 1 = fully gray).
export const desaturateHex = (hex: string, amount: number): string => {
  const parsed = parseHex(hex);
  if (!parsed) return hex;
  const t = Math.max(0, Math.min(1, amount));
  const gray = 0.2126 * parsed.r + 0.7152 * parsed.g + 0.0722 * parsed.b;
  const r = parsed.r + (gray - parsed.r) * t;
  const g = parsed.g + (gray - parsed.g) * t;
  const b = parsed.b + (gray - parsed.b) * t;
  return toHex(r, g, b);
};

// Render-time transform for highlight colors in dark mode: darker and slightly
// less saturated so the highlight stops washing out off-white reader text.
// Accepts hex; passes through anything else (e.g. rgba()) unchanged so existing
// theme-supplied translucent highlights are not double-processed.
export const dimHighlightForDarkMode = (color: string): string => {
  if (typeof color !== 'string') return color;
  const trimmed = color.trim();
  if (!trimmed.startsWith('#')) return trimmed;
  const desaturated = desaturateHex(trimmed, 0.25);
  return darkenHex(desaturated, 0.45);
};

// Render-time transform for highlight colors in light mode: lighten the color
// by 15% (mix toward white) so dark verse text stays clearly visible without
// losing the highlight cue.
// Passes non-hex strings through unchanged.
export const dimHighlightForLightMode = (color: string): string => {
  if (typeof color !== 'string') return color;
  const trimmed = color.trim();
  if (!trimmed.startsWith('#')) return trimmed;
  return lightenHex(trimmed, 0.23);
};

// WCAG-style relative luminance for "is this color dark?" decisions.
export const getRelativeLuminance = (hex: string): number => {
  const parsed = parseHex(hex);
  if (!parsed) return 1;
  const channel = (c: number) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(parsed.r) + 0.7152 * channel(parsed.g) + 0.0722 * channel(parsed.b);
};

// WCAG contrast between two hex colors, from 1 (none) to 21.
export const contrastRatio = (a: string, b: string): number => {
  const x = getRelativeLuminance(a);
  const y = getRelativeLuminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};

// Mix a toward b; t is 0..1 (0 = a, 1 = b).
export const mixHex = (a: string, b: string, t: number): string => {
  const p = parseHex(a);
  const q = parseHex(b);
  if (!p || !q) return a;
  return toHex(p.r + (q.r - p.r) * t, p.g + (q.g - p.g) * t, p.b + (q.b - p.b) * t);
};

const READABLE = 4.5;
const WARM_INK = '#2E2924';

// A theme color as a button fill, with text that reads on it: white when the
// color allows it, the warm ink on light colors (gold, sky…), and a mid tone
// that neither reaches (terracotta) darkened just enough for white. Every
// color of the personalization palette, and any added later, comes out
// readable.
export const accentFill = (accent: string, ink = WARM_INK): {fill: string; text: string} => {
  if (contrastRatio(accent, '#FFFFFF') >= READABLE) return {fill: accent, text: '#FFFFFF'};
  if (contrastRatio(accent, ink) >= READABLE) return {fill: accent, text: ink};
  let fill = accent;
  for (let t = 0.05; contrastRatio(fill, '#FFFFFF') < READABLE && t <= 1; t += 0.05) {
    fill = darkenHex(accent, t);
  }
  return {fill, text: '#FFFFFF'};
};

// A theme color used as text or an outline on `ground`: darkened (on a light
// ground) or lightened (on a dark one) just until it reads.
export const readableAccent = (accent: string, ground: string): string => {
  const lightGround = getRelativeLuminance(ground) > 0.4;
  let color = accent;
  for (let t = 0.05; contrastRatio(color, ground) < READABLE && t <= 1; t += 0.05) {
    color = lightGround ? darkenHex(accent, t) : lightenHex(accent, t);
  }
  return color;
};

// Hue in degrees (0–360), saturation and lightness (0–1) of a hex color.
export const toHsl = (hex: string): {h: number; s: number; l: number} => {
  const p = parseHex(hex) ?? {r: 0, g: 0, b: 0};
  const [r, g, b] = [p.r / 255, p.g / 255, p.b / 255];
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return {h: 0, s: 0, l};
  const s = d / (1 - Math.abs(2 * l - 1));
  const h = max === r ? ((g - b) / d + 6) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return {h: h * 60, s, l};
};

// Rainbow order for a palette: red, orange, yellow, green, blue, violet,
// pink, each 30° band light to dark, then the greys light to dark.
export const byHue = (a: string, b: string): number => {
  const x = toHsl(a);
  const y = toHsl(b);
  const grey = (c: {s: number}) => c.s < 0.12;
  if (grey(x) !== grey(y)) return grey(x) ? 1 : -1;
  const band = (c: {h: number}) => Math.floor(((c.h + 15) % 360) / 30);
  return (grey(x) ? 0 : band(x) - band(y)) || y.l - x.l;
};
