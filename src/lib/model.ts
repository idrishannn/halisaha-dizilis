import type { Timestamp } from 'firebase/firestore';
import { positionsFor } from '../state.ts';
import type { AppState, Player, Slot } from '../types.ts';

/** Firestore'daki takım belgesi (teams/{id}). Fotoğraflar cihazda kalır, buraya yazılmaz. */
export interface TeamDoc {
  adminUid: string;
  name: string;
  kit: string;
  size: AppState['size'];
  formation: string;
  players: { id: number; name: string }[];
  overrides: AppState['overrides'];
  captain: number | null;
  showNames: boolean;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface MatchSide {
  teamId: string;
  name: string;
  kit: string;
}

export interface MatchScore {
  home: number;
  away: number;
  /** Skoru giren takımın adı */
  by: string;
  byUid: string;
  at: Timestamp | null;
}

/** Firestore'daki maç belgesi (matches/{id}). Linke sahip olan herkes okuyabilir. */
export interface MatchDoc {
  createdBy: string;
  createdAt: Timestamp | null;
  /** Maçta söz sahibi olan kullanıcılar (iki takımın yöneticisi) */
  members: string[];
  home: MatchSide;
  away: MatchSide | null;
  place: string;
  time: string;
  score: MatchScore | null;
}

export type WithId<T> = T & { id: string };

/** Yerel durumdan, Firestore'a yazılacak takım alanlarını üretir. */
export function teamFields(state: AppState): Omit<TeamDoc, 'adminUid' | 'createdAt' | 'updatedAt'> {
  return {
    name: state.teamName.trim().slice(0, 24) || 'Takımım',
    kit: state.kit,
    size: state.size,
    formation: state.formation,
    players: state.players.map((p) => ({ id: p.id, name: p.name.slice(0, 18) })),
    overrides: state.overrides,
    captain: state.captain,
    showNames: state.showNames,
  };
}

/** Başka bir takımın belgesini, sahada çizilebilecek hâle getirir. */
export function teamLineup(team: TeamDoc): { players: Player[]; slots: Slot[]; captainId: number | null } {
  const asState = {
    size: team.size,
    formation: team.formation,
    overrides: team.overrides || {},
  } as AppState;
  let slots: Slot[];
  try {
    slots = positionsFor(asState);
  } catch {
    slots = [];
  }
  return {
    players: team.players.slice(0, team.size).map((p) => ({ ...p, image: null })),
    slots,
    captainId: team.captain,
  };
}

export type Result = 'G' | 'B' | 'M';

/** Bir maçın, verilen takım açısından sonucu. Skor yoksa null. */
export function resultFor(match: MatchDoc, teamId: string): Result | null {
  if (!match.score || !match.away) return null;
  const mine = match.home.teamId === teamId ? match.score.home : match.score.away;
  const theirs = match.home.teamId === teamId ? match.score.away : match.score.home;
  return mine > theirs ? 'G' : mine < theirs ? 'M' : 'B';
}

export function opponentOf(match: MatchDoc, teamId: string): MatchSide | null {
  return match.home.teamId === teamId ? match.away : match.home;
}

/** Takımın skorunu kendi açısından "5–3" biçiminde verir. */
export function scoreLine(match: MatchDoc, teamId: string): string {
  if (!match.score) return '–';
  const home = match.home.teamId === teamId;
  return home ? `${match.score.home}–${match.score.away}` : `${match.score.away}–${match.score.home}`;
}

/** İki takım arasındaki seri (verilen takım açısından). */
export function headToHead(matches: MatchDoc[], teamId: string, opponentId: string) {
  const played = matches.filter(
    (m) => m.score && m.away && [m.home.teamId, m.away.teamId].includes(teamId) && [m.home.teamId, m.away.teamId].includes(opponentId),
  );
  const tally = { G: 0, B: 0, M: 0 };
  for (const m of played) {
    const r = resultFor(m, teamId);
    if (r) tally[r]++;
  }
  return { played: played.length, ...tally };
}
