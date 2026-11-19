import { describe, expect, it } from 'vitest';
import { HALFWAY, LINES, makeCamera, teamToPitch, toPercent } from '../src/lib/perspective.ts';

const cam = makeCamera({ from: 0, to: 300, tilt: 50, focal: 600 });

describe('perspective camera', () => {
  it('draws far points smaller and higher than near points', () => {
    const far = cam.project(100, 20);
    const near = cam.project(100, 280);
    expect(far.s).toBeLessThan(near.s);
    expect(far.y).toBeLessThan(near.y);
  });

  it('narrows the far end of the pitch', () => {
    const farW = cam.project(200, 0).x - cam.project(0, 0).x;
    const nearW = cam.project(200, 300).x - cam.project(0, 300).x;
    expect(farW).toBeLessThan(nearW);
  });

  it('raises points with height', () => {
    expect(cam.project(100, 150, 20).y).toBeLessThan(cam.project(100, 150).y);
  });

  it('keeps the whole pitch inside the view box', () => {
    for (const [x, y] of [[0, 0], [200, 0], [0, 300], [200, 300]]) {
      const { left, top } = toPercent(cam, cam.project(x, y));
      expect(left).toBeGreaterThanOrEqual(0);
      expect(left).toBeLessThanOrEqual(100);
      expect(top).toBeGreaterThanOrEqual(0);
      expect(top).toBeLessThanOrEqual(100);
    }
  });
});

describe('team coordinates', () => {
  it('puts the home team in the bottom half and mirrors the away team', () => {
    const home = teamToPitch({ x: 20, y: 90 }, 'home');
    const away = teamToPitch({ x: 20, y: 90 }, 'away');
    expect(home.py).toBeGreaterThan(HALFWAY);
    expect(away.py).toBeLessThan(HALFWAY);
    expect(home.px + away.px).toBeCloseTo(LINES.left + LINES.right);
    expect(home.py + away.py).toBeCloseTo(HALFWAY * 2);
  });
});

describe('full pitch inset', () => {
  it('pulls both teams back from the halfway line so forwards do not collide', () => {
    const fw = { x: 50, y: 15 };
    const gap = (inset: number) => teamToPitch(fw, 'home', inset).py - teamToPitch(fw, 'away', inset).py;
    expect(gap(14)).toBeGreaterThan(gap(0));
    // kalecinin yeri neredeyse değişmez
    expect(teamToPitch({ x: 50, y: 89 }, 'home', 14).py).toBeCloseTo(teamToPitch({ x: 50, y: 89 }, 'home', 0).py, -1);
  });
});
