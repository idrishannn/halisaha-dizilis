import type { Role, Slot, TeamSize } from './types.ts';

// Koordinatlar takımın kendi yarı sahasında, yüzde cinsinden:
// x soldan, y orta saha çizgisinden (0) kendi kalemize (100).
const GK: Slot = { x: 50, y: 89, role: 'KL' };
const p = (x: number, y: number, role: Role): Slot => ({ x, y, role });

export const TEAM_SIZES: Record<TeamSize, Record<string, Slot[]>> = {
  6: {
    '2-2-1': [GK, p(30, 66, 'DEF'), p(70, 66, 'DEF'), p(30, 41, 'OS'), p(70, 41, 'OS'), p(50, 15, 'FV')],
    '1-2-2': [GK, p(50, 66, 'DEF'), p(28, 41, 'OS'), p(72, 41, 'OS'), p(34, 15, 'FV'), p(66, 15, 'FV')],
    '2-1-2': [GK, p(30, 66, 'DEF'), p(70, 66, 'DEF'), p(50, 41, 'OS'), p(32, 15, 'FV'), p(68, 15, 'FV')],
  },
  7: {
    '3-2-1': [GK, p(19, 64, 'DEF'), p(50, 66, 'DEF'), p(81, 64, 'DEF'), p(32, 40, 'OS'), p(68, 40, 'OS'), p(50, 15, 'FV')],
    '2-3-1': [GK, p(30, 66, 'DEF'), p(70, 66, 'DEF'), p(16, 40, 'OS'), p(50, 42, 'OS'), p(84, 40, 'OS'), p(50, 15, 'FV')],
    '3-1-2': [GK, p(19, 64, 'DEF'), p(50, 66, 'DEF'), p(81, 64, 'DEF'), p(50, 41, 'OS'), p(32, 15, 'FV'), p(68, 15, 'FV')],
  },
  8: {
    '3-3-1': [GK, p(19, 64, 'DEF'), p(50, 66, 'DEF'), p(81, 64, 'DEF'), p(16, 40, 'OS'), p(50, 42, 'OS'), p(84, 40, 'OS'), p(50, 15, 'FV')],
    '2-3-2': [GK, p(30, 66, 'DEF'), p(70, 66, 'DEF'), p(16, 40, 'OS'), p(50, 42, 'OS'), p(84, 40, 'OS'), p(32, 15, 'FV'), p(68, 15, 'FV')],
    '3-2-2': [GK, p(19, 64, 'DEF'), p(50, 66, 'DEF'), p(81, 64, 'DEF'), p(32, 40, 'OS'), p(68, 40, 'OS'), p(32, 15, 'FV'), p(68, 15, 'FV')],
  },
};

export const SIZES = [6, 7, 8] as const satisfies readonly TeamSize[];

export const MAX_PLAYERS = 8;

export const isTeamSize = (n: unknown): n is TeamSize => SIZES.includes(n as TeamSize);

export const defaultFormation = (size: TeamSize): string => Object.keys(TEAM_SIZES[size])[0];

export const formationKey = (size: TeamSize, formation: string) => `${size}:${formation}`;
