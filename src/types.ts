export type Role = 'KL' | 'DEF' | 'OS' | 'FV';

/** Sahadaki bir nokta, yüzde cinsinden. x soldan, y orta saha çizgisinden (0) kendi kalemize (100). */
export interface Point {
  x: number;
  y: number;
}

export interface Slot extends Point {
  role: Role;
}

export interface Player {
  id: number;
  name: string;
  /** Kare kırpılmış küçük fotoğraf (data URL) ya da yok. */
  image: string | null;
}

export interface Kit {
  name: string;
  /** Forma rengi */
  color: string;
  /** Forma üstündeki yazı rengi */
  ink: string;
}

export type TeamSize = 6 | 7 | 8;

export interface MatchInfo {
  place: string;
  time: string;
}

export interface AppState {
  version: 3;
  teamName: string;
  size: TeamSize;
  formation: string;
  players: Player[];
  /** "8:3-3-1" -> { yuva: konum } elle sürüklenen konumlar */
  overrides: Record<string, Record<number, Point>>;
  match: MatchInfo;
  showNames: boolean;
  kit: string;
  /** Kaptanın oyuncu id'si */
  captain: number | null;
}

/** localStorage benzeri, test için taklit edilebilir depolama. */
export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}
