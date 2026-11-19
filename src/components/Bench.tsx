import { useState } from 'react';
import { ArrowLeftRight } from 'lucide-react';
import { usePointerDrag } from '../hooks/usePointerDrag.ts';
import type { Kit, Player } from '../types.ts';
import { Avatar } from './PlayerDisc.tsx';

interface DragHandlers {
  onDragStart: (slot: number) => void;
  onDragMove: (cx: number, cy: number) => void;
  onDragEnd: (cancelled: boolean) => void;
  onTap: (slot: number) => void;
}

interface Props extends DragHandlers {
  players: Player[];
  startIndex: number;
  kit: Kit;
  targetSlot: number | null | undefined;
  draggingSlot: number | null;
}

/** Yedekler: kadroya girmeyen oyuncular. Sahadaki bir oyuncunun üstüne sürükleyince oyuna girer. */
export default function Bench({ players, startIndex, kit, targetSlot, draggingSlot, ...handlers }: Props) {
  if (!players.length) return null;
  return (
    <section aria-label="Yedekler" className="space-y-2">
      <h2 className="text-[13px] font-semibold text-muted">Yedekler · sahaya sürükle, oyuna girsin</h2>
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
              {...handlers}
            />
          );
        })}
      </div>
    </section>
  );
}

interface ChipProps extends DragHandlers {
  player: Player;
  slot: number;
  kit: Kit;
  isTarget: boolean;
  dragging: boolean;
}

function BenchChip({ player, slot, kit, isTarget, dragging, onDragStart, onDragMove, onDragEnd, onTap }: ChipProps) {
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
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onTap(slot);
        }
      }}
      className={`relative flex h-[52px] min-w-[140px] flex-1 touch-none select-none items-center gap-2.5 rounded-2xl border bg-surface px-2.5 ${
        dragging ? 'z-50 cursor-grabbing border-line shadow-2xl' : 'cursor-grab border-dashed border-[#C9CEC6]'
      } ${isTarget ? 'border-solid border-ink ring-2 ring-lime' : ''}`}
      style={{
        transform: `translate(${off.x}px, ${off.y}px) scale(${dragging ? 1.06 : isTarget ? 1.04 : 1}) rotate(${off.tilt}deg)`,
        transition: dragging ? 'box-shadow .2s' : 'transform .55s cubic-bezier(.34,1.56,.64,1), box-shadow .2s',
      }}
    >
      <Avatar player={player} kit={kit} className="h-8 w-8 text-[13px]" />
      <span className="min-w-0 flex-1 truncate text-sm font-semibold">{player.name || 'Yedek'}</span>
      {isTarget && <ArrowLeftRight size={15} className="text-ink" />}
    </div>
  );
}
