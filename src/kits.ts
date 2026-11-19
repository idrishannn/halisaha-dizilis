import type { Kit } from './types.ts';

// Forma renkleri. İki takım yan yana durduğunda renk körlüğünde de ayırt edilebilsin diye
// renkler parlaklık olarak da birbirinden ayrışır.
export const KITS: Record<string, Kit> = {
  blue: { name: 'Mavi', color: '#2457F5', ink: '#FFFFFF' },
  orange: { name: 'Turuncu', color: '#EA6A1F', ink: '#FFFFFF' },
  green: { name: 'Yeşil', color: '#138A43', ink: '#FFFFFF' },
  purple: { name: 'Mor', color: '#7C3AED', ink: '#FFFFFF' },
  pink: { name: 'Pembe', color: '#DB2777', ink: '#FFFFFF' },
  black: { name: 'Siyah', color: '#0F1712', ink: '#FFFFFF' },
};

/** Kaleci her zaman ayrı renkte giyer. */
export const GK_KIT: Kit = { name: 'Kaleci', color: '#FACC15', ink: '#1C1917' };

// Önceki sürümün forma kimlikleri
const LEGACY: Record<string, string> = {
  emerald: 'green', crimson: 'pink', cobalt: 'blue', sunset: 'orange', violet: 'purple', ghost: 'black', onyx: 'black',
};

export const DEFAULT_KIT = 'blue';

export const normalizeKitId = (id: string | undefined): string => {
  if (id && KITS[id]) return id;
  if (id && LEGACY[id]) return LEGACY[id];
  return DEFAULT_KIT;
};

export const kitFor = (id: string): Kit => KITS[normalizeKitId(id)];
