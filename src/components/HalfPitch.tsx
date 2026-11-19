import { forwardRef, useEffect, useRef, useState } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';
import { ArrowLeftRight, Camera } from 'lucide-react';
import { usePointerDrag } from '../hooks/usePointerDrag.ts';
import type { Kit, Player, Point, Role } from '../types.ts';
import { initials } from './PlayerDisc.tsx';

/**
 * Kadro düzenleme sahası: takımın kendi yarı sahası, tam üstten.
 * Üst kenar orta saha çizgisi, alt kenar kendi kalemiz.
 */
const HalfPitch = forwardRef<HTMLDivElement, { children: ReactNode; overlay?: ReactNode }>(function HalfPitch(
  { children, overlay },
  ref,
) {
  return (
    <div
      ref={ref}
      className="relative aspect-[6/7] w-full touch-none select-none overflow-hidden rounded-[22px] shadow-[inset_0_0_0_1px_rgba(0,0,0,0.08)]"
      style={{ containerType: 'inline-size', background: 'repeating-linear-gradient(180deg, #23874D 0 12.5%, #1E7B45 12.5% 25%)' }}
    >
      <HalfLines />
      {overlay}
      {children}
    </div>
  );
});

export default HalfPitch;

/** Yarı saha çizgileri. viewBox 184x214, sahanın 6:7 oranıyla örtüşür. */
function HalfLines() {
  const line = { fill: 'none', stroke: 'rgba(255,255,255,0.82)', strokeWidth: 1.4 };
  return (
    <svg viewBox="0 0 184 214" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true">
      <g {...line}>
        <rect x="7" y="0" width="170" height="207" rx="2" />
        <path d="M62 0 A30 30 0 0 0 122 0" />
        <rect x="44" y="157" width="96" height="50" />
        <rect x="70" y="190" width="44" height="17" />
        <path d="M78 157 A24 24 0 0 1 106 157" />
      </g>
      <circle cx="92" cy="174" r="1.6" fill="rgba(255,255,255,0.85)" />
      <rect x="76" y="207" width="32" height="7" fill="rgba(255,255,255,0.18)" stroke="rgba(255,255,255,0.8)" strokeWidth="1" />
    </svg>
  );
}

export interface PitchDrag {
  kind: 'pitch' | 'bench';
  slot: number;
  over: number | null;
  x?: number;
  y?: number;
  origin?: Point;
  base?: Point;
  snap?: boolean;
}

/** Sürüklerken başlangıç noktasında hayalet ve mıknatıs halkası. */
export function DragGuides({ drag }: { drag: PitchDrag | null }) {
  if (!drag || drag.kind !== 'pitch' || !drag.origin || !drag.base) return null;
  const { origin, base, snap } = drag;
  return (
    <div className="export-hide pointer-events-none absolute inset-0 z-10">
      <div
        className="absolute aspect-square w-[15cqw] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-dashed border-white/60"
        style={{ left: `${origin.x}%`, top: `${origin.y}%` }}
      />
      {snap && (
        <div
          className="animate-pulse-ring absolute aspect-square w-[19cqw] -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-lime"
          style={{ left: `${base.x}%`, top: `${base.y}%` }}
        />
      )}
    </div>
  );
}

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

interface TokenProps {
  player: Player;
  slot: number;
  order: number;
  position: Point;
  role: Role;
  kit: Kit;
  captain: boolean;
  showName: boolean;
  dragging: boolean;
  dragPos: Point | null;
  isTarget: boolean;
  onDragStart: (slot: number) => void;
  onDragMove: (cx: number, cy: number) => void;
  onDragEnd: (cancelled: boolean) => void;
  onTap: (slot: number) => void;
  onNudge: (slot: number, x: number, y: number) => void;
}

/**
 * Sahadaki oyuncu. Kaldırınca büyür, gölgesi yerden ayrılır, sürükleme yönüne eğilir;
 * bırakınca yaylı bir hareketle yerine oturur. Başka oyuncunun üstüne bırakılırsa yer değiştirirler.
 */
export function PlayerToken({
  player, slot, order, position, role, kit, captain, showName,
  dragging, dragPos, isTarget, onDragStart, onDragMove, onDragEnd, onTap, onNudge,
}: TokenProps) {
  const [tilt, setTilt] = useState(0);
  const discRef = useRef<HTMLSpanElement>(null);
  const wasDragging = useRef(false);

  const bind = usePointerDrag({
    onStart: () => onDragStart(slot),
    onMove: (e, { vx }) => {
      setTilt(clamp(vx * 16, -14, 14));
      onDragMove(e.clientX, e.clientY);
    },
    onEnd: (_, { cancelled }) => {
      setTilt(0);
      onDragEnd(cancelled);
    },
    onTap: () => onTap(slot),
  });

  // Bırakıldığında küçük bir "yere basma" sekmesi
  useEffect(() => {
    if (wasDragging.current && !dragging) {
      discRef.current?.animate(
        [
          { transform: 'scale(1.12)' },
          { transform: 'scale(0.9, 0.88)', offset: 0.4 },
          { transform: 'scale(1.04)', offset: 0.72 },
          { transform: 'scale(1)' },
        ],
        { duration: 480, easing: 'cubic-bezier(.22,1,.36,1)' },
      );
    }
    wasDragging.current = dragging;
  }, [dragging]);

  const pos = dragging && dragPos ? { x: clamp(dragPos.x, 2, 98), y: clamp(dragPos.y, 2, 98) } : position;

  const onKeyDown = (e: KeyboardEvent) => {
    const step = e.shiftKey ? 5 : 2;
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step],
    };
    if (moves[e.key]) {
      e.preventDefault();
      onNudge(slot, position.x + moves[e.key][0], position.y + moves[e.key][1]);
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onTap(slot);
    }
  };

  return (
    <div
      {...bind}
      role="button"
      tabIndex={0}
      onKeyDown={onKeyDown}
      aria-label={`${player.name || role}, ${role}. Sürükle veya ok tuşlarıyla taşı, Enter ile düzenle.`}
      data-slot={slot}
      className={`group absolute flex w-[26cqw] -translate-x-1/2 -translate-y-[6.5cqw] flex-col items-center outline-none ${
        dragging ? 'z-30 cursor-grabbing' : 'z-20 cursor-grab'
      }`}
      style={{
        left: `${pos.x}%`,
        top: `${pos.y}%`,
        transition: dragging
          ? 'none'
          : `left .55s cubic-bezier(.34,1.45,.64,1) ${order * 22}ms, top .55s cubic-bezier(.34,1.45,.64,1) ${order * 22}ms`,
      }}
    >
      <div
        className="relative transition-transform duration-300 ease-spring"
        style={{ transform: dragging ? `translateY(-12%) scale(1.14) rotate(${tilt}deg)` : isTarget ? 'scale(1.1)' : 'none' }}
      >
        <span
          ref={discRef}
          className="relative flex h-[13cqw] w-[13cqw] items-center justify-center overflow-hidden rounded-full font-display text-[5cqw] font-bold transition-shadow duration-300"
          style={{
            background: kit.color,
            color: kit.ink,
            boxShadow: `0 0 0 0.75cqw #fff, 0 ${dragging ? '3cqw 5cqw' : '1cqw 2cqw'} rgba(0,0,0,${dragging ? 0.45 : 0.32})`,
          }}
        >
          {player.image ? (
            <img src={player.image} alt="" draggable={false} className="pointer-events-none h-full w-full object-cover" />
          ) : (
            initials(player.name) || role
          )}
        </span>

        {/* hover / klavye odağı halkası */}
        <span className="export-hide pointer-events-none absolute -inset-[1.4cqw] rounded-full ring-[0.6cqw] ring-transparent transition group-hover:ring-white/40 group-focus-visible:ring-lime" />

        {captain && (
          <span className="absolute -left-[0.8cqw] -top-[0.8cqw] flex h-[5cqw] w-[5cqw] items-center justify-center rounded-full bg-lime font-display text-[2.8cqw] font-black text-ink shadow-md">
            C
          </span>
        )}
        {!player.image && (
          <span className="export-hide absolute -bottom-[0.4cqw] -right-[0.4cqw] flex h-[5cqw] w-[5cqw] items-center justify-center rounded-full bg-white text-ink shadow-md">
            <Camera className="h-[55%] w-[55%]" strokeWidth={2.4} />
          </span>
        )}
        {isTarget && (
          <>
            <span className="animate-pulse-ring absolute -inset-[2cqw] rounded-full border-[0.7cqw] border-lime" />
            <span className="absolute left-1/2 top-1/2 flex h-[7cqw] w-[7cqw] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-lime text-ink shadow-lg">
              <ArrowLeftRight className="h-[60%] w-[60%]" strokeWidth={2.6} />
            </span>
          </>
        )}
      </div>

      {showName && (
        <span
          className={`mt-[1.6cqw] max-w-full truncate rounded-full bg-[#08100B]/80 px-[2cqw] py-[0.8cqw] text-[3.3cqw] font-semibold leading-none text-white transition-transform duration-300 ease-spring ${
            dragging ? 'translate-y-[1cqw] scale-95 opacity-80' : ''
          }`}
        >
          {player.name || role}
        </span>
      )}
    </div>
  );
}
