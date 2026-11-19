// Forma renkleri. a: ana renk, b: koyu ton (gradyan), ink: forma üstündeki yazı rengi.
export const KITS = {
  emerald: { name: 'Zümrüt', a: '#34d399', b: '#047857', ink: '#ecfdf5' },
  crimson: { name: 'Kırmızı', a: '#fb7185', b: '#be123c', ink: '#fff1f2' },
  cobalt: { name: 'Mavi', a: '#60a5fa', b: '#1d4ed8', ink: '#eff6ff' },
  sunset: { name: 'Turuncu', a: '#fdba74', b: '#ea580c', ink: '#fff7ed' },
  violet: { name: 'Mor', a: '#c4b5fd', b: '#6d28d9', ink: '#f5f3ff' },
  ghost: { name: 'Beyaz', a: '#ffffff', b: '#a1a1aa', ink: '#18181b' },
  onyx: { name: 'Siyah', a: '#52525b', b: '#09090b', ink: '#fafafa' },
};

// Kaleci her zaman ayrı renkte giyer.
export const GK_KIT = { a: '#fde047', b: '#ca8a04', ink: '#1c1917' };

export const kitFor = (id) => KITS[id] || KITS.emerald;
