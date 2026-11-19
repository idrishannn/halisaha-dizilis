import { useId, useMemo } from 'react';
import type { ReactNode } from 'react';
import { GK_KIT } from '../kits.ts';
import {
  LINES, PITCH_W, arc, makeCamera, pathOf, quad, teamToPitch, toPercent,
} from '../lib/perspective.ts';
import type { Camera } from '../lib/perspective.ts';
import type { Kit, Player, Slot } from '../types.ts';
import { initials } from './PlayerDisc.tsx';

export interface PitchTeam {
  side: 'home' | 'away';
  kit: Kit;
  players: Player[];
  slots: Slot[];
  captainId: number | null;
}

interface Props {
  /** half: sadece kendi yarı sahamız (yakın plan), full: iki takım karşılıklı */
  view: 'half' | 'full';
  teams: PitchTeam[];
  showNames: boolean;
  /** Sahanın üstüne bindirilecek, dışa aktarılmayan katman (export-hide) */
  overlay?: ReactNode;
}

const CAMERAS = {
  half: { from: 128, to: 300, tilt: 46, focal: 560, tallest: 26, depth: 1.75 },
  full: { from: -4, to: 300, tilt: 46, focal: 900, tallest: 26, depth: 1.5 },
} as const;

const TOKEN_CQW = { half: 8.6, full: 6.4 } as const;

/** Sabit perspektifli halı saha: kafes, kaleler, biçilmiş çim ve ayakta duran oyuncular. */
export default function PerspectivePitch({ view, teams, showNames, overlay }: Props) {
  const cam = useMemo(() => makeCamera(CAMERAS[view]), [view]);
  const { viewBox: vb } = cam;

  const tokens = teams
    .flatMap((team) =>
      team.slots.map((slot, i) => {
        const player = team.players[i];
        const { px, py } = teamToPitch(slot, team.side);
        return { team, slot, player, px, py, isGK: slot.role === 'KL' };
      }),
    )
    .filter((t) => t.player)
    // uzaktakiler önce çizilsin ki yakındakiler önlerinde dursun
    .sort((a, b) => a.py - b.py);

  return (
    <div
      className="relative w-full select-none overflow-hidden"
      style={{
        aspectRatio: `${vb.w} / ${vb.h}`,
        background:
          'radial-gradient(55% 45% at 6% 0%, rgba(255,247,214,0.20), rgba(255,247,214,0) 70%),' +
          'radial-gradient(55% 45% at 94% 0%, rgba(255,247,214,0.20), rgba(255,247,214,0) 70%),' +
          'linear-gradient(180deg, #0B140F 0%, #0E2318 100%)',
      }}
    >
      <Scene cam={cam} view={view} />

      <div className="absolute inset-0" style={{ containerType: 'inline-size' }}>
        {tokens.map(({ team, slot, player, px, py, isGK }) => {
          const ground = cam.project(px, py);
          const { left, top } = toPercent(cam, ground);
          const size = TOKEN_CQW[view] * ground.s;
          return (
            <div
              key={`${team.side}-${player.id}`}
              className="absolute"
              style={{ left: `${left}%`, top: `${top}%`, transition: 'left .5s cubic-bezier(.34,1.3,.64,1), top .5s cubic-bezier(.34,1.3,.64,1)' }}
            >
              {/* yer gölgesi */}
              <span
                className="absolute rounded-[50%]"
                style={{
                  width: `${size * 1.15}cqw`, height: `${size * 0.42}cqw`,
                  left: `${-size * 0.575}cqw`, top: `${-size * 0.21}cqw`,
                  background: 'radial-gradient(closest-side, rgba(0,0,0,0.55), rgba(0,0,0,0))',
                }}
              />
              <div className="absolute bottom-0 left-0 flex -translate-x-1/2 flex-col items-center" style={{ gap: `${size * 0.08}cqw` }}>
                <Disc player={player} kit={isGK ? GK_KIT : team.kit} size={size} captain={team.captainId === player.id} />
                {showNames && (
                  <span
                    className="max-w-[30cqw] truncate rounded-full bg-[#08100B]/80 font-semibold leading-none text-white"
                    style={{ fontSize: `${size * 0.32}cqw`, padding: `${size * 0.1}cqw ${size * 0.24}cqw` }}
                  >
                    {player.name || slot.role}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {overlay}
    </div>
  );
}

function Disc({ player, kit, size, captain }: { player: Player; kit: Kit; size: number; captain: boolean }) {
  return (
    <span
      className="relative flex shrink-0 items-center justify-center rounded-full font-display font-bold"
      style={{
        width: `${size}cqw`, height: `${size}cqw`, fontSize: `${size * 0.4}cqw`,
        background: kit.color, color: kit.ink,
        boxShadow: `0 0 0 ${size * 0.07}cqw #fff, 0 ${size * 0.15}cqw ${size * 0.3}cqw rgba(0,0,0,0.4)`,
      }}
    >
      {player.image ? (
        <img src={player.image} alt="" draggable={false} className="h-full w-full rounded-full object-cover" />
      ) : (
        initials(player.name) || '?'
      )}
      {captain && (
        <span
          className="absolute flex items-center justify-center rounded-full bg-lime font-display font-black text-ink"
          style={{ width: `${size * 0.42}cqw`, height: `${size * 0.42}cqw`, fontSize: `${size * 0.25}cqw`, left: `${-size * 0.08}cqw`, top: `${-size * 0.08}cqw` }}
        >
          C
        </span>
      )}
    </span>
  );
}

/** Zemin, çizgiler, kaleler ve kafes — tamamı izdüşümü yapılmış düz SVG. */
function Scene({ cam, view }: { cam: Camera; view: 'half' | 'full' }) {
  const uid = useId().replace(/:/g, '');
  const { viewBox: vb, from } = cam;
  const P = cam.project;
  const ids = { clip: `clip${uid}`, fade: `fade${uid}`, mask: `mask${uid}`, net: `net${uid}` };

  const stripes: string[] = [];
  for (let y = 0, i = 0; y < 300; y += 37.5, i++) {
    if (i % 2 === 0 && y + 37.5 > from) stripes.push(quad(cam, 0, Math.max(y, from), PITCH_W, y + 37.5));
  }

  const D = Math.asin(14 / 22);
  const L = LINES;
  const fenceH = 26;
  const sideFence = (x: number) => {
    const y0 = Math.max(from, -6);
    const posts = [];
    for (let y = 306; y >= y0; y -= 30) posts.push(y);
    return { panel: pathOf([P(x, y0), P(x, 306), P(x, 306, fenceH), P(x, y0, fenceH)], true), posts };
  };
  const fences = [sideFence(-6), sideFence(PITCH_W + 6)];

  const goal = (yLine: number, dir: 1 | -1) => {
    const h = 15;
    const yb = yLine + dir * 8;
    const x0 = 82;
    const x1 = 118;
    return {
      net: [
        pathOf([P(x0, yb), P(x1, yb), P(x1, yb, h), P(x0, yb, h)], true),
        pathOf([P(x0, yLine, h), P(x1, yLine, h), P(x1, yb, h), P(x0, yb, h)], true),
        pathOf([P(x0, yLine), P(x0, yb), P(x0, yb, h), P(x0, yLine, h)], true),
        pathOf([P(x1, yLine), P(x1, yb), P(x1, yb, h), P(x1, yLine, h)], true),
      ],
      frame: pathOf([P(x0, yLine), P(x0, yLine, h), P(x1, yLine, h), P(x1, yLine)]),
    };
  };
  const goals = [view === 'full' ? goal(L.top, -1) : null, goal(L.bottom, 1)].filter(Boolean) as ReturnType<typeof goal>[];

  const line = { fill: 'none', stroke: 'rgba(255,255,255,0.86)', strokeWidth: 1.5, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const };
  const dot = (x: number, y: number) => {
    const p = P(x, y);
    return <ellipse cx={p.x} cy={p.y} rx={1.8 * p.s} ry={1.8 * p.s * 0.7} fill="rgba(255,255,255,0.9)" />;
  };

  return (
    <svg viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`} className="absolute inset-0 h-full w-full" aria-hidden="true">
      <defs>
        <clipPath id={ids.clip}>
          <path d={quad(cam, -14, from, PITCH_W + 14, 316)} />
        </clipPath>
        <linearGradient id={ids.fade} x1="0" y1="0" x2="0" y2="1" gradientUnits="objectBoundingBox">
          <stop offset="0" stopColor="#fff" stopOpacity={view === 'half' ? 0 : 1} />
          <stop offset={view === 'half' ? 0.22 : 0} stopColor="#fff" stopOpacity="1" />
          <stop offset="1" stopColor="#fff" stopOpacity="1" />
        </linearGradient>
        <mask id={ids.mask}>
          <rect x={vb.x} y={vb.y} width={vb.w} height={vb.h} fill={`url(#${ids.fade})`} />
        </mask>
        <pattern id={ids.net} width="3" height="3" patternUnits="userSpaceOnUse">
          <path d="M0 0L3 3M3 0L0 3" stroke="rgba(255,255,255,0.5)" strokeWidth="0.35" />
        </pattern>
      </defs>

      <g mask={`url(#${ids.mask})`}>
        {/* saha kenarı ve çim */}
        <path d={quad(cam, -14, from, PITCH_W + 14, 316)} fill="#14492B" />
        <path d={quad(cam, 0, from, PITCH_W, 300)} fill="#1E7B45" />
        {stripes.map((d, i) => <path key={i} d={d} fill="#23874D" />)}

        <g clipPath={`url(#${ids.clip})`}>
          {/* çizgiler */}
          <g {...line}>
            <path d={quad(cam, L.left, L.top, L.right, L.bottom)} />
            <path d={pathOf([P(L.left, 150), P(L.right, 150)])} />
            <path d={arc(cam, 100, 150, 26)} />
            <path d={quad(cam, 48, 246, 152, L.bottom)} />
            <path d={quad(cam, 76, 275, 124, L.bottom)} />
            <path d={arc(cam, 100, 260, 22, Math.PI + D, 2 * Math.PI - D, 24)} />
            <path d={quad(cam, 48, L.top, 152, 54)} />
            <path d={quad(cam, 76, L.top, 124, 25)} />
            <path d={arc(cam, 100, 40, 22, D, Math.PI - D, 24)} />
            <path d={arc(cam, L.left, L.top, 5, 0, Math.PI / 2, 8)} />
            <path d={arc(cam, L.right, L.top, 5, Math.PI / 2, Math.PI, 8)} />
            <path d={arc(cam, L.left, L.bottom, 5, -Math.PI / 2, 0, 8)} />
            <path d={arc(cam, L.right, L.bottom, 5, Math.PI, Math.PI * 1.5, 8)} />
          </g>
          {dot(100, 150)}
          {dot(100, 260)}
          {dot(100, 40)}
        </g>

        {/* kafes: yan çitler (yakın taraf görüşü kapatmasın diye çizilmez) */}
        {fences.map((f, i) => (
          <g key={i}>
            <path d={f.panel} fill={`url(#${ids.net})`} opacity="0.35" />
            <path d={f.panel} fill="rgba(255,255,255,0.03)" />
            {f.posts.map((y) => {
              const x = i === 0 ? -6 : PITCH_W + 6;
              return <path key={y} d={pathOf([P(x, y), P(x, y, fenceH)])} stroke="#4B5563" strokeWidth={1.2} />;
            })}
            <path d={pathOf([P(i === 0 ? -6 : PITCH_W + 6, Math.max(from, -6), fenceH), P(i === 0 ? -6 : PITCH_W + 6, 306, fenceH)])} stroke="#6B7280" strokeWidth={1.2} fill="none" />
          </g>
        ))}

        {/* kaleler */}
        {goals.map((g, i) => (
          <g key={i}>
            {g.net.map((d, j) => <path key={j} d={d} fill={`url(#${ids.net})`} stroke="rgba(255,255,255,0.35)" strokeWidth="0.4" />)}
            <path d={g.frame} fill="none" stroke="#fff" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
          </g>
        ))}
      </g>
    </svg>
  );
}
