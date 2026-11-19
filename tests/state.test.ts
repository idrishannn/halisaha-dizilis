import { describe, expect, it } from 'vitest';
import { TEAM_SIZES } from '../src/formations.ts';
import {
  STORAGE_KEY, defaultState, loadState, movePlayer, positionsFor,
  resetPositions, saveState, setFormation, setSize, swapPlayers, updatePlayer,
} from '../src/state.ts';
import type { KeyValueStorage } from '../src/types.ts';

const memoryStorage = (init: Record<string, string> = {}): KeyValueStorage & { data: Record<string, string> } => {
  const data = { ...init };
  return {
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => { data[k] = String(v); },
    data,
  };
};

const eight = () => setSize(defaultState(), 8);

describe('formations', () => {
  it('every formation has exactly as many slots as the team size, goalkeeper first', () => {
    for (const [size, formations] of Object.entries(TEAM_SIZES)) {
      for (const [name, slots] of Object.entries(formations)) {
        expect(slots, `${size} ${name}`).toHaveLength(Number(size));
        expect(slots[0].role).toBe('KL');
      }
    }
  });

  it('keeps every slot inside the half pitch', () => {
    for (const formations of Object.values(TEAM_SIZES)) {
      for (const slots of Object.values(formations)) {
        for (const s of slots) {
          expect(s.x).toBeGreaterThanOrEqual(4);
          expect(s.x).toBeLessThanOrEqual(96);
          expect(s.y).toBeGreaterThanOrEqual(4);
          expect(s.y).toBeLessThanOrEqual(96);
        }
      }
    }
  });
});

describe('state', () => {
  it('dragging a player only overrides the current formation', () => {
    let s = eight();
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
    const s = resetPositions(movePlayer(eight(), 2, 11, 11));
    expect(positionsFor(s)).toEqual(TEAM_SIZES[8]['3-3-1']);
  });

  it('changing team size picks a valid formation and slot count', () => {
    const s = setSize(defaultState(), 6);
    expect(positionsFor(s)).toHaveLength(6);
    expect(setSize(s, 11)).toBe(s);
  });

  it('swaps two players while slots keep their positions', () => {
    const base = movePlayer(eight(), 2, 30, 30);
    const s = swapPlayers(base, 2, 6);
    expect(s.players[2].id).toBe(7);
    expect(s.players[6].id).toBe(3);
    expect(positionsFor(s)[2]).toMatchObject({ x: 30, y: 30 });
    expect(swapPlayers(s, 1, 1)).toBe(s);
    expect(swapPlayers(s, 1, 99)).toBe(s);
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
    const s = updatePlayer(setSize(defaultState(), 6), 1, { name: 'Volkan' });
    expect(saveState(st, { ...s, teamName: 'Kartallar' })).toBe(true);
    const loaded = loadState(st);
    expect(loaded.size).toBe(6);
    expect(loaded.teamName).toBe('Kartallar');
    expect(loaded.players[0].name).toBe('Volkan');
  });

  it('migrates v2 data: match title becomes the team name, old kit ids map to new ones', () => {
    const st = memoryStorage({
      [STORAGE_KEY]: JSON.stringify({
        version: 2, size: 8, formation: '2-3-2', kit: 'cobalt', view: '3d',
        match: { title: 'Perşembe FC', place: 'Yıldız', time: '21:00' },
      }),
    });
    const s = loadState(st);
    expect(s.teamName).toBe('Perşembe FC');
    expect(s.kit).toBe('blue');
    expect(s.formation).toBe('2-3-2');
    expect(s.match).toEqual({ place: 'Yıldız', time: '21:00' });
    expect('view' in s).toBe(false);
  });

  it('keeps the default team name when v2 used the default title', () => {
    const st = memoryStorage({ [STORAGE_KEY]: JSON.stringify({ match: { title: 'Halı Saha Maçı' } }) });
    expect(loadState(st).teamName).toBe('Takımım');
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
    expect(positionsFor(s)).toHaveLength(defaultState().size);
  });

  it('reports a full storage instead of throwing', () => {
    const full = { getItem: () => null, setItem: () => { throw new Error('QuotaExceededError'); } };
    expect(saveState(full, defaultState())).toBe(false);
  });
});
