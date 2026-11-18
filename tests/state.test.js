import { describe, expect, it } from 'vitest';
import { TEAM_SIZES } from '../src/formations.js';
import {
  STORAGE_KEY, defaultState, loadState, movePlayer, positionsFor,
  resetPositions, saveState, setFormation, setSize, updatePlayer,
} from '../src/state.js';

const memoryStorage = (init = {}) => {
  const data = { ...init };
  return {
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => { data[k] = String(v); },
    data,
  };
};

describe('formations', () => {
  it('every formation has exactly as many slots as the team size, goalkeeper first', () => {
    for (const [size, formations] of Object.entries(TEAM_SIZES)) {
      for (const [name, slots] of Object.entries(formations)) {
        expect(slots, `${size} ${name}`).toHaveLength(Number(size));
        expect(slots[0].role).toBe('KL');
      }
    }
  });
});

describe('state', () => {
  it('dragging a player only overrides the current formation', () => {
    let s = defaultState();
    s = movePlayer(s, 3, 10, 20);
    expect(positionsFor(s)[3]).toMatchObject({ x: 10, y: 20 });
    const other = setFormation(s, '2-3-2');
    expect(positionsFor(other)[3]).toEqual(TEAM_SIZES[8]['2-3-2'][3]);
    // geri dönünce elle verilen konum hâlâ orada
    expect(positionsFor(setFormation(other, '3-3-1'))[3]).toMatchObject({ x: 10, y: 20 });
  });

  it('keeps players inside the pitch', () => {
    const s = movePlayer(defaultState(), 1, -50, 400);
    expect(positionsFor(s)[1]).toMatchObject({ x: 4, y: 96 });
  });

  it('resetPositions restores the formation defaults', () => {
    const s = resetPositions(movePlayer(defaultState(), 2, 11, 11));
    expect(positionsFor(s)).toEqual(TEAM_SIZES[8]['3-3-1']);
  });

  it('changing team size picks a valid formation and slot count', () => {
    const s = setSize(defaultState(), 6);
    expect(positionsFor(s)).toHaveLength(6);
    expect(setSize(s, 11)).toBe(s);
  });

  it('updates a single player', () => {
    const s = updatePlayer(defaultState(), 2, { name: 'Emre' });
    expect(s.players[1].name).toBe('Emre');
    expect(s.players[0].name).toBe('Kaleci');
  });
});

describe('persistence', () => {
  it('round-trips through storage', () => {
    const st = memoryStorage();
    const s = updatePlayer(setSize(defaultState(), 7), 1, { name: 'Volkan' });
    expect(saveState(st, s)).toBe(true);
    const loaded = loadState(st);
    expect(loaded.size).toBe(7);
    expect(loaded.players[0].name).toBe('Volkan');
  });

  it('migrates the first version (halisaha_players)', () => {
    const st = memoryStorage({
      halisaha_players: JSON.stringify([{ id: 1, name: 'Kaleci', image: 'data:x' }]),
    });
    expect(loadState(st).players[0].image).toBe('data:x');
  });

  it('survives corrupt or invalid data', () => {
    expect(loadState(memoryStorage({ [STORAGE_KEY]: '{bozuk' }))).toEqual(defaultState());
    const bad = memoryStorage({ [STORAGE_KEY]: JSON.stringify({ size: 11, formation: 'x' }) });
    const s = loadState(bad);
    expect(positionsFor(s)).toHaveLength(8);
  });

  it('reports a full storage instead of throwing', () => {
    const full = { getItem: () => null, setItem: () => { throw new Error('QuotaExceededError'); } };
    expect(saveState(full, defaultState())).toBe(false);
  });
});
