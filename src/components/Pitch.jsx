import { forwardRef, useRef } from 'react';
import { Camera, CalendarClock, MapPin } from 'lucide-react';

/** Dikey saha + üstte maç bilgisi. Dışa aktarılan görüntü tam olarak bu düğümdür. */
const Pitch = forwardRef(function Pitch({ match, children }, ref) {
  return (
    <div ref={ref} className="w-full overflow-hidden rounded-2xl bg-green-900 shadow-2xl ring-1 ring-black/20">
      <div className="flex items-center justify-between gap-3 bg-neutral-950 px-4 py-3 text-white">
        <h2 className="truncate text-lg font-extrabold tracking-tight">{match.title || 'Halı Saha Maçı'}</h2>
        <div className="flex shrink-0 flex-col items-end text-[11px] leading-tight text-white/70">
          {match.place && (
            <span className="flex items-center gap-1"><MapPin size={11} />{match.place}</span>
          )}
          {match.time && (
            <span className="flex items-center gap-1"><CalendarClock size={11} />{match.time}</span>
          )}
        </div>
      </div>

      <div
        className="relative aspect-[2/3] w-full"
        style={{
          backgroundColor: '#15803d',
          backgroundImage:
            'repeating-linear-gradient(0deg, rgba(0,0,0,0.09) 0, rgba(0,0,0,0.09) 10%, transparent 10%, transparent 20%)',
        }}
      >
        {/* Saha çizgileri */}
        <div className="pointer-events-none absolute inset-[4%] rounded-md border-[3px] border-white/70">
          <div className="absolute left-0 top-1/2 h-[3px] w-full -translate-y-1/2 bg-white/70" />
          <div className="absolute left-1/2 top-1/2 aspect-square w-[26%] -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-white/70" />
          <div className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/80" />
          <div className="absolute left-1/2 top-0 h-[14%] w-[50%] -translate-x-1/2 rounded-b-md border-x-[3px] border-b-[3px] border-white/70" />
          <div className="absolute bottom-0 left-1/2 h-[14%] w-[50%] -translate-x-1/2 rounded-t-md border-x-[3px] border-t-[3px] border-white/70" />
          <div className="absolute left-1/2 top-0 h-[5%] w-[22%] -translate-x-1/2 border-x-[3px] border-b-[3px] border-white/70" />
          <div className="absolute bottom-0 left-1/2 h-[5%] w-[22%] -translate-x-1/2 border-x-[3px] border-t-[3px] border-white/70" />
        </div>
        {children}
      </div>
    </div>
  );
});

export default Pitch;

/** Sahadaki oyuncu: sürükleyerek taşınır, boş yuvarlağa dokununca fotoğraf seçilir. */
export function PlayerToken({ player, position, showName, onMove, onPickImage }) {
  const drag = useRef(null);

  const onPointerDown = (e) => {
    const field = e.currentTarget.parentElement.getBoundingClientRect();
    drag.current = { field, startX: e.clientX, startY: e.clientY, moved: false };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e) => {
    const d = drag.current;
    if (!d) return;
    if (!d.moved && Math.hypot(e.clientX - d.startX, e.clientY - d.startY) < 5) return;
    d.moved = true;
    onMove(
      ((e.clientX - d.field.left) / d.field.width) * 100,
      ((e.clientY - d.field.top) / d.field.height) * 100,
    );
  };

  const onPointerUp = () => {
    const d = drag.current;
    drag.current = null;
    if (d && !d.moved) onPickImage();
  };

  return (
    <div
      className="absolute flex w-[22%] -translate-x-1/2 -translate-y-1/2 cursor-grab touch-none select-none flex-col items-center active:cursor-grabbing"
      style={{ left: `${position.x}%`, top: `${position.y}%` }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={() => (drag.current = null)}
      title="Sürükle: konum değiştir · Dokun: fotoğraf seç"
    >
      <div className="relative aspect-square w-[62%]">
        <div
          className={`h-full w-full overflow-hidden rounded-full shadow-lg ring-[3px] ${
            position.role === 'KL' ? 'ring-amber-300' : 'ring-white'
          } ${player.image ? 'bg-neutral-800' : 'bg-green-900'}`}
        >
          {player.image ? (
            <img src={player.image} alt={player.name} draggable={false} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-[clamp(12px,3.4vw,22px)] font-extrabold text-white">
              {initials(player.name) || position.role}
            </div>
          )}
        </div>
        {!player.image && (
          // Dışa aktarılan görüntüye girmez (export-hide)
          <span className="export-hide absolute -bottom-0.5 -right-0.5 flex h-[38%] w-[38%] items-center justify-center rounded-full bg-white text-green-800 shadow">
            <Camera className="h-3/5 w-3/5" />
          </span>
        )}
      </div>
      {showName && (
        <span className="mt-1 max-w-full truncate rounded-full bg-black/60 px-2 py-0.5 text-[clamp(9px,2.2vw,13px)] font-semibold text-white">
          {player.name || position.role}
        </span>
      )}
    </div>
  );
}

function initials(name = '') {
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toLocaleUpperCase('tr'))
    .join('');
}
