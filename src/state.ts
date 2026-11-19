import { MAX_PLAYERS, TEAM_SIZES, defaultFormation, formationKey, isTeamSize } from './formations.ts';
import { normalizeKitId } from './kits.ts';
import type { AppState, KeyValueStorage, Player, Slot, TeamSize } from './types.ts';

export const STORAGE_KEY = 'halisaha_v2';
const LEGACY_KEY = 'halisaha_players'; // ilk sürümün anahtarı
const DEFAULT_TEAM = 'Takımım';

export const defaultPlayers = (): Player[] =>
  Array.from({ length: MAX_PLAYERS }, (_, i) => ({
    id: i + 1,
    name: i === 0 ? 'Kaleci' : `Oyuncu ${i + 1}`,
    image: null,
  }));

export const defaultState = (): AppState => ({
  version: 3,
  teamName: DEFAULT_TEAM,
  size: 7,
  formation: defaultFormation(7),
  players: defaultPlayers(),
  overrides: {},
  match: { place: '', time: '' },
  showNames: true,
  kit: 'blue',
  captain: null,
});

/** Diziliş konumlarını, kullanıcının sürüklediği konumlarla birleştirir. */
export function positionsFor(state: AppState): Slot[] {
  const base = TEAM_SIZES[state.size][state.formation];
  const custom = state.overrides[formationKey(state.size, state.formation)] || {};
  return base.map((pos, i) => (custom[i] ? { ...pos, ...custom[i] } : pos));
}

export const clamp = (v: number, min = 4, max = 96) => Math.min(max, Math.max(min, v));

export function movePlayer(state: AppState, index: number, x: number, y: number): AppState {
  const key = formationKey(state.size, state.formation);
  return {
    ...state,
    overrides: {
      ...state.overrides,
      [key]: { ...(state.overrides[key] || {}), [index]: { x: clamp(x), y: clamp(y) } },
    },
  };
}

export function resetPositions(state: AppState): AppState {
  const { [formationKey(state.size, state.formation)]: _removed, ...rest } = state.overrides;
  return { ...state, overrides: rest };
}

export function setSize(state: AppState, size: number): AppState {
  if (!isTeamSize(size)) return state;
  return { ...state, size, formation: defaultFormation(size) };
}

export function setFormation(state: AppState, formation: string): AppState {
  if (!TEAM_SIZES[state.size][formation]) return state;
  return { ...state, formation };
}

/** İki kadro yuvasındaki oyuncuları yer değiştirir (konumlar yuvada kalır). */
export function swapPlayers(state: AppState, a: number, b: number): AppState {
  if (a === b || !state.players[a] || !state.players[b]) return state;
  const players = [...state.players];
  [players[a], players[b]] = [players[b], players[a]];
  return { ...state, players };
}

export function updatePlayer(state: AppState, id: number, patch: Partial<Omit<Player, 'id'>>): AppState {
  return {
    ...state,
    players: state.players.map((p) => (p.id === id ? { ...p, ...patch } : p)),
  };
}

type Saved = Partial<AppState> & { match?: Partial<AppState['match']> & { title?: string } };

/** Kayıtlı durumu okur; bozuk veya eski sürüm veriyi güvenle karşılar. */
export function loadState(storage: KeyValueStorage): AppState {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (raw) {
      const saved = JSON.parse(raw) as Saved;
      const base = defaultState();
      const size: TeamSize = isTeamSize(saved.size) ? saved.size : base.size;
      const formation =
        saved.formation && TEAM_SIZES[size][saved.formation] ? saved.formation : defaultFormation(size);
      // v2'de takım adı yoktu; maç başlığı değiştirildiyse takım adı olarak kullan
      const legacyTitle = saved.match?.title;
      const teamName =
        saved.teamName || (legacyTitle && legacyTitle !== 'Halı Saha Maçı' ? legacyTitle : base.teamName);
      const players =
        Array.isArray(saved.players) && saved.players.length >= MAX_PLAYERS
          ? saved.players
          : defaultPlayers().map((p, i) => ({ ...p, ...(saved.players?.[i] || {}) }));
      return {
        ...base,
        size,
        formation,
        teamName,
        players,
        overrides: saved.overrides && typeof saved.overrides === 'object' ? saved.overrides : {},
        match: { place: saved.match?.place ?? '', time: saved.match?.time ?? '' },
        showNames: saved.showNames ?? base.showNames,
        kit: normalizeKitId(saved.kit),
        captain: typeof saved.captain === 'number' ? saved.captain : null,
      };
    }
    const legacy = storage.getItem(LEGACY_KEY);
    if (legacy) {
      const old = JSON.parse(legacy) as Partial<Player>[];
      const state = defaultState();
      state.players = state.players.map((p, i) => ({ ...p, ...(old[i] || {}) }));
      return state;
    }
  } catch {
    // bozuk JSON ya da erişilemeyen depolama: temiz başla
  }
  return defaultState();
}

/** Kaydeder; kota dolarsa false döner (arayüz kullanıcıyı uyarır). */
export function saveState(storage: KeyValueStorage, state: AppState): boolean {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}
