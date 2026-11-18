import { TEAM_SIZES, MAX_PLAYERS, defaultFormation, formationKey } from './formations.js';

export const STORAGE_KEY = 'halisaha_v2';
const LEGACY_KEY = 'halisaha_players'; // ilk sürümün anahtarı

export const defaultPlayers = () =>
  Array.from({ length: MAX_PLAYERS }, (_, i) => ({
    id: i + 1,
    name: i === 0 ? 'Kaleci' : `Oyuncu ${i + 1}`,
    image: null,
  }));

export const defaultState = () => ({
  version: 2,
  size: 8,
  formation: defaultFormation(8),
  players: defaultPlayers(),
  overrides: {}, // { "8:3-3-1": { 3: {x, y} } } elle sürüklenen konumlar
  match: { title: 'Halı Saha Maçı', place: '', time: '' },
  showNames: true,
});

/** Diziliş konumlarını, kullanıcının sürüklediği konumlarla birleştirir. */
export function positionsFor(state) {
  const base = TEAM_SIZES[state.size][state.formation];
  const custom = state.overrides[formationKey(state.size, state.formation)] || {};
  return base.map((pos, i) => (custom[i] ? { ...pos, ...custom[i] } : pos));
}

export const clamp = (v, min = 4, max = 96) => Math.min(max, Math.max(min, v));

export function movePlayer(state, index, x, y) {
  const key = formationKey(state.size, state.formation);
  return {
    ...state,
    overrides: {
      ...state.overrides,
      [key]: { ...(state.overrides[key] || {}), [index]: { x: clamp(x), y: clamp(y) } },
    },
  };
}

export function resetPositions(state) {
  const { [formationKey(state.size, state.formation)]: _, ...rest } = state.overrides;
  return { ...state, overrides: rest };
}

export function setSize(state, size) {
  if (!TEAM_SIZES[size]) return state;
  return { ...state, size, formation: defaultFormation(size) };
}

export function setFormation(state, formation) {
  if (!TEAM_SIZES[state.size][formation]) return state;
  return { ...state, formation };
}

export function updatePlayer(state, id, patch) {
  return {
    ...state,
    players: state.players.map((p) => (p.id === id ? { ...p, ...patch } : p)),
  };
}

/** Kayıtlı durumu okur; bozuk veya eski sürüm veriyi güvenle karşılar. */
export function loadState(storage) {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (raw) {
      const saved = JSON.parse(raw);
      const base = defaultState();
      const merged = { ...base, ...saved, match: { ...base.match, ...saved.match } };
      if (!TEAM_SIZES[merged.size]) merged.size = base.size;
      if (!TEAM_SIZES[merged.size][merged.formation]) merged.formation = defaultFormation(merged.size);
      if (!Array.isArray(merged.players) || merged.players.length < MAX_PLAYERS) {
        merged.players = defaultPlayers().map((p, i) => ({ ...p, ...(saved.players?.[i] || {}) }));
      }
      return merged;
    }
    const legacy = storage.getItem(LEGACY_KEY);
    if (legacy) {
      const old = JSON.parse(legacy);
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
export function saveState(storage, state) {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}
