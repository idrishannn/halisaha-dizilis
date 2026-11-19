import { useState } from 'react';
import { ArrowLeftRight, Armchair } from 'lucide-react';
import { usePointerDrag } from '../hooks/usePointerDrag.js';
import { initials } from './Pitch.jsx';

/** Yedek kulübesi: kadroya girmeyen oyuncular. Sahadaki bir oyuncunun üstüne sürükleyince oyuna girer. */
export default function Bench({ players, startIndex, kit, targetSlot, draggingSlot, onDragStart, onDragMove, onDragEnd, onTap }) {
  if (!players.length) return null;
  return (
    <div className="glass relative z-40 rounded-2xl p-3">
      <div className="mb-2 flex items-center justify-between px-1">
        <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-400">
          <Armchair size={13} /> Yedekler
        </span>
        <span className="text-[11px] text-zinc-500">Sahaya sürükle → oyuna girsin</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {players.map((p, i) => {
          const slot = startIndex + i;
          return (
            <BenchChip
              key={p.id}
              player={p}
              slot={slot}
              kit={kit}
              isTarget={targetSlot === slot}
              dragging={draggingSlot === slot}
              onDragStart={onDragStart}
              onDragMove={onDragMove}
              onDragEnd={onDragEnd}
              onTap={onTap}
            />
          );
        })}
      </div>
    </div>
  );
}

function BenchChip({ player, slot, kit, isTarget, dragging, onDragStart, onDragMove, onDragEnd, onTap }) {
  const [off, setOff] = useState({ x: 0, y: 0, tilt: 0 });

  const bind = usePointerDrag({
    onStart: () => onDragStart(slot),
    onMove: (e, { dx, dy, vx }) => {
      setOff({ x: dx, y: dy, tilt: Math.max(-12, Math.min(12, vx * 14)) });
      onDragMove(e.clientX, e.clientY);
    },
    onEnd: (_, { cancelled }) => {
      setOff({ x: 0, y: 0, tilt: 0 });
      onDragEnd(cancelled);
    },
    onTap: () => onTap(slot),
  });

  return (
    <div
      {...bind}
      data-bench-slot={slot}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onTap(slot))}
      className={`relative flex touch-none select-none items-center gap-2 rounded-full py-1.5 pl-1.5 pr-3.5 ring-1 ring-inset ${
        dragging ? 'z-50 cursor-grabbing bg-zinc-800 shadow-2xl ring-white/20' : 'cursor-grab bg-white/[0.05] ring-white/10 hover:bg-white/[0.08]'
      } ${isTarget ? 'ring-2 ring-[color:var(--accent)]' : ''}`}
      style={{
        transform: `translate(${off.x}px, ${off.y}px) scale(${dragging ? 1.08 : isTarget ? 1.05 : 1}) rotate(${off.tilt}deg)`,
        transition: dragging ? 'box-shadow .2s, background .2s' : 'transform .55s cubic-bezier(.34,1.56,.64,1), box-shadow .2s',
      }}
    >
      <span
        className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full text-[11px] font-extrabold ring-2 ring-white/80"
        style={{ background: `radial-gradient(circle at 30% 25%, ${kit.a}, ${kit.b} 75%)`, color: kit.ink }}
      >
        {player.image ? (
          <img src={player.image} alt="" draggable={false} className="pointer-events-none h-full w-full object-cover" />
        ) : (
          initials(player.name) || '?'
        )}
      </span>
      <span className="max-w-[9rem] truncate text-sm font-medium">{player.name || 'Yedek'}</span>
      {isTarget && <ArrowLeftRight size={14} style={{ color: 'var(--accent)' }} />}
    </div>
  );
}
