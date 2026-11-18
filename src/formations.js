// Koordinatlar dikey sahada yüzde cinsinden: x soldan, y yukarıdan.
// Kendi kalemiz altta (y ≈ 90), rakip kale üstte.
const GK = { x: 50, y: 90, role: 'KL' };
const p = (x, y, role) => ({ x, y, role });

export const TEAM_SIZES = {
  6: {
    '2-2-1': [GK, p(30, 72, 'DEF'), p(70, 72, 'DEF'), p(30, 48, 'OS'), p(70, 48, 'OS'), p(50, 24, 'FV')],
    '1-2-2': [GK, p(50, 73, 'DEF'), p(28, 51, 'OS'), p(72, 51, 'OS'), p(34, 25, 'FV'), p(66, 25, 'FV')],
    '2-1-2': [GK, p(30, 72, 'DEF'), p(70, 72, 'DEF'), p(50, 50, 'OS'), p(32, 25, 'FV'), p(68, 25, 'FV')],
  },
  7: {
    '3-2-1': [GK, p(20, 72, 'DEF'), p(50, 74, 'DEF'), p(80, 72, 'DEF'), p(33, 48, 'OS'), p(67, 48, 'OS'), p(50, 22, 'FV')],
    '2-3-1': [GK, p(30, 74, 'DEF'), p(70, 74, 'DEF'), p(18, 50, 'OS'), p(50, 52, 'OS'), p(82, 50, 'OS'), p(50, 22, 'FV')],
    '3-1-2': [GK, p(20, 72, 'DEF'), p(50, 74, 'DEF'), p(80, 72, 'DEF'), p(50, 50, 'OS'), p(32, 25, 'FV'), p(68, 25, 'FV')],
  },
  8: {
    '3-3-1': [GK, p(20, 72, 'DEF'), p(50, 74, 'DEF'), p(80, 72, 'DEF'), p(22, 48, 'OS'), p(50, 50, 'OS'), p(78, 48, 'OS'), p(50, 22, 'FV')],
    '2-3-2': [GK, p(30, 74, 'DEF'), p(70, 74, 'DEF'), p(18, 50, 'OS'), p(50, 52, 'OS'), p(82, 50, 'OS'), p(34, 25, 'FV'), p(66, 25, 'FV')],
    '3-2-2': [GK, p(20, 72, 'DEF'), p(50, 74, 'DEF'), p(80, 72, 'DEF'), p(33, 49, 'OS'), p(67, 49, 'OS'), p(34, 24, 'FV'), p(66, 24, 'FV')],
  },
};

export const MAX_PLAYERS = 8;

export const defaultFormation = (size) => Object.keys(TEAM_SIZES[size])[0];

export const formationKey = (size, formation) => `${size}:${formation}`;
