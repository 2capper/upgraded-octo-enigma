export function generateSmartPalette(brandColor: string) {
  return {
    brand: brandColor,
    brandLight: `color-mix(in srgb, ${brandColor} 25%, hsl(217, 33%, 17%))`,
    brandMuted: `color-mix(in srgb, ${brandColor} 15%, hsl(217, 33%, 17%))`,
    brandForeground: `color-mix(in srgb, ${brandColor}, white 80%)`,
  };
}

export function getContrastColor(hexColor: string): 'light' | 'dark' {
  const hex = hexColor.replace('#', '');
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? 'dark' : 'light';
}

export function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return { h: 0, s: 0, l: 0 };
  
  let r = parseInt(result[1], 16) / 255;
  let g = parseInt(result[2], 16) / 255;
  let b = parseInt(result[3], 16) / 255;
  
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  
  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100)
  };
}

export function createDarkModeVariant(color: string, isDark: boolean): string {
  if (!isDark) return color;
  
  if (color.startsWith('#')) {
    const { h, s, l } = hexToHsl(color);
    const newL = Math.min(l + 20, 75);
    const newS = Math.max(s - 10, 30);
    return `hsl(${h}, ${newS}%, ${newL}%)`;
  }
  
  return `color-mix(in srgb, ${color}, white 20%)`;
}

export function applyOrgBrandColors(primaryColor: string, isDark: boolean): Record<string, string> {
  const palette = generateSmartPalette(primaryColor);
  
  return {
    '--org-brand': isDark ? palette.brandForeground : palette.brand,
    '--org-brand-bg': isDark ? palette.brandMuted : palette.brand,
    '--org-brand-muted': palette.brandMuted,
  };
}
