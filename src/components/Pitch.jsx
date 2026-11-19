import { forwardRef, useEffect, useRef, useState } from 'react';
import { ArrowLeftRight, CalendarClock, Camera, MapPin } from 'lucide-react';
import { usePointerDrag } from '../hooks/usePointerDrag.js';

/**
 * Dikey saha kartı: üstte yayın tarzı skor tabelası, ortada çim, altta imza.
 * Dışa aktarılan görüntü tam olarak bu düğümdür; `export-hide` sınıflı öğeler görüntüye girmez.
 */
const Pitch = forwardRef(function Pitch({ match, meta, kit, fieldRef, overlay, children }, ref) {
  return (
    <div
      ref={ref}
      className="relative isolate w-full overflow-hidden rounded-[28px] bg-ink-900 shadow-[0_40px_80px_-30px_rgba(0,0,0,0.9)] ring-1 ring-white/10"
    >
      <Scoreboard match={match} meta={meta} kit={kit} />

      <div ref={fieldRef} className="turf relative aspect-[2/3] w-full touch-none select-none">
        <FieldLines />
        {overlay}
        {children}
      </div>

      <div className="flex items-center justify-between bg-ink-900 px-5 py-2.5 text-[11px] font-medium text-white/40">
        <span className="font-mono uppercase tracking-[0.2em]">{meta.size}v{meta.size} · {meta.formation}</span>
        <span className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: 'var(--accent)' }} />
          halısaha diziliş
        </span>
      </div>
    </div>
  );
});

export default Pitch;

function Scoreboard({ match, meta, kit }) {
  return (
    <div className="relative overflow-hidden bg-gradient-to-b from-ink-800 to-ink-900 px-5 pb-4 pt-4">
      {/* forma rengiyle ince vurgu */}
      <div className="absolute inset-x-0 top-0 h-[3px]" style={{ background: `linear-gradient(90deg, ${kit.a}, ${kit.b})` }} />
      <div
        className="pointer-events-none absolute -right-10 -top-16 h-40 w-40 rounded-full opacity-25 blur-3xl"
        style={{ background: kit.a }}
      />
      <div className="relative flex items-end justify-between gap-4">
        <div className="min-w-0">
          <div className="mb-1 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-white/45">
            <span className="rounded bg-white/10 px-1.5 py-0.5 text-white/70">Kadro</span>
            {meta.size}&apos;li maç
          </div>
          <h2 className="truncate pb-1 text-[26px] font-black leading-[1.1] tracking-[-0.035em] text-white">
            {match.title || 'Halı Saha Maçı'}
          </h2>
          {(match.place || match.time) && (
            <div className="mt-2.5 flex flex-wrap gap-1.5 text-[11px] font-medium text-white/75">
              {match.place && (
                <span className="flex items-center gap-1 rounded-full bg-white/[0.07] px-2 py-1 ring-1 ring-inset ring-white/10">
                  <MapPin size={11} className="opacity-70" />
                  {match.place}
                </span>
              )}
              {match.time && (
                <span className="flex items-center gap-1 rounded-full bg-white/[0.07] px-2 py-1 ring-1 ring-inset ring-white/10">
                  <CalendarClock size={11} className="opacity-70" />
                  {match.time}
                </span>
              )}
            </div>
          )}
        </div>
        <div className="shrink-0 text-right">
          <div className="text-[9px] font-semibold uppercase tracking-[0.22em] text-white/40">Diziliş</div>
          <div className="font-mono text-2xl font-bold leading-none tracking-tight" style={{ color: 'var(--accent)' }}>
            {meta.formation}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Saha çizgileri. viewBox 200x300 sahanın 2:3 oranıyla birebir örtüşür. */
function FieldLines() {
  const line = { fill: 'none', stroke: 'rgba(255,255,255,0.78)', strokeWidth: 1.3 };
  return (
    <svg viewBox="0 0 200 300" className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true">
      <defs>
        <pattern id="stripes" width="200" height="37.5" patternUnits="userSpaceOnUse">
          <rect width="200" height="18.75" fill="rgba(0,0,0,0.11)" />
        </pattern>
        <radialGradient id="lightTop" cx="50%" cy="0%" r="75%">
          <stop offset="0" stopColor="#fff" stopOpacity="0.13" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="lightBottom" cx="50%" cy="100%" r="75%">
          <stop offset="0" stopColor="#fff" stopOpacity="0.09" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="vignette" cx="50%" cy="50%" r="72%">
          <stop offset="0.55" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.4" />
        </radialGradient>
        <filter id="grain" x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="1.6" numOctaves="2" stitchTiles="stitch" />
          <feColorMatrix values="0 0 0 0 0  0 0 0 0 0.12  0 0 0 0 0  0 0 0 0.5 0" />
        </filter>
        <pattern id="net" width="3" height="3" patternUnits="userSpaceOnUse">
          <path d="M0 0L3 3M3 0L0 3" stroke="rgba(255,255,255,0.35)" strokeWidth="0.4" />
        </pattern>
        <filter id="glow" x="-5%" y="-5%" width="110%" height="110%">
          <feGaussianBlur stdDeviation="0.8" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      {/* suni çim: zemin, biçim şeritleri, doku, projektör ışığı, kenar gölgesi */}
      <rect width="200" height="300" fill="#1a7a3a" />
      <rect width="200" height="300" fill="url(#stripes)" />
      <rect width="200" height="300" filter="url(#grain)" opacity="0.6" />
      <rect width="200" height="150" fill="url(#lightTop)" />
      <rect y="150" width="200" height="150" fill="url(#lightBottom)" />
      <rect width="200" height="300" fill="url(#vignette)" />
      {/* kaleler */}
      <rect x="82" y="3" width="36" height="7" fill="url(#net)" stroke="rgba(255,255,255,0.7)" strokeWidth="1" />
      <rect x="82" y="290" width="36" height="7" fill="url(#net)" stroke="rgba(255,255,255,0.7)" strokeWidth="1" />
      <g filter="url(#glow)" {...line}>
        <rect x="8" y="10" width="184" height="280" rx="3" />
        <line x1="8" y1="150" x2="192" y2="150" />
        <circle cx="100" cy="150" r="26" />
        <circle cx="100" cy="150" r="1.8" fill="rgba(255,255,255,0.85)" stroke="none" />
        {/* üst ceza sahası */}
        <rect x="48" y="10" width="104" height="44" />
        <rect x="76" y="10" width="48" height="15" />
        <circle cx="100" cy="40" r="1.5" fill="rgba(255,255,255,0.85)" stroke="none" />
        <path d="M84 54 A22 22 0 0 0 116 54" />
        {/* alt ceza sahası */}
        <rect x="48" y="246" width="104" height="44" />
        <rect x="76" y="275" width="48" height="15" />
        <circle cx="100" cy="260" r="1.5" fill="rgba(255,255,255,0.85)" stroke="none" />
        <path d="M84 246 A22 22 0 0 1 116 246" />
        {/* korner yayları */}
        <path d="M8 15 A5 5 0 0 0 13 10" />
        <path d="M187 10 A5 5 0 0 0 192 15" />
        <path d="M8 285 A5 5 0 0 1 13 290" />
        <path d="M187 290 A5 5 0 0 1 192 285" />
      </g>
    </svg>
  );
}

/** Sürüklerken: başlangıç noktasında hayalet, rota çizgisi, hizalama çizgileri ve mıknatıs halkası. */
export function DragGuides({ drag, kit }) {
  if (!drag || drag.kind !== 'pitch') return null;
  const { origin, x, y, snap, base } = drag;
  return (
    <div className="export-hide pointer-events-none absolute inset-0 z-10">
      <svg viewBox="0 0 100 150" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
        <line x1={x} y1="0" x2={x} y2="150" stroke="rgba(255,255,255,0.18)" strokeWidth="0.25" vectorEffect="non-scaling-stroke" />
        <line x1="0" y1={y * 1.5} x2="100" y2={y * 1.5} stroke="rgba(255,255,255,0.18)" strokeWidth="0.25" vectorEffect="non-scaling-stroke" />
        <line
          x1={origin.x} y1={origin.y * 1.5} x2={x} y2={y * 1.5}
          stroke="rgba(255,255,255,0.7)" strokeWidth="1.5" strokeDasharray="4 4" vectorEffect="non-scaling-stroke"
        />
      </svg>
      <div
        className="absolute aspect-square w-[13.5cqw] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-dashed border-white/50 bg-black/15"
        style={{ left: `${origin.x}%`, top: `${origin.y}%` }}
      />
      {snap && (
        <div
          className="animate-pulse-ring absolute aspect-square w-[17cqw] -translate-x-1/2 -translate-y-1/2 rounded-full border-2"
          style={{ left: `${base.x}%`, top: `${base.y}%`, borderColor: 'var(--accent)', boxShadow: `0 0 24px ${kit.a}` }}
        />
      )}
    </div>
  );
}

export function Ripples({ items }) {
  return items.map((r) => (
    <span
      key={r.id}
      className="export-hide animate-ripple pointer-events-none absolute z-0 aspect-square w-[20cqw] rounded-full border-2"
      style={{ left: `${r.x}%`, top: `${r.y}%`, borderColor: 'var(--accent)', background: 'rgb(198 244 50 / 0.12)' }}
    />
  ));
}

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

/**
 * Sahadaki oyuncu. Kaldırınca büyür, gölgesi yerden ayrılır, sürükleme yönüne eğilir;
 * bırakınca yaylı bir hareketle yerine oturur. Başka oyuncunun üstüne bırakılırsa yer değiştirirler.
 */
export function PlayerToken({
  player, slot, order, position, role, kit, captain, showName,
  dragging, dragPos, isTarget, anyDragging,
  onDragStart, onDragMove, onDragEnd, onTap, onNudge,
}) {
  const [tilt, setTilt] = useState(0);
  const avatarRef = useRef(null);
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
      avatarRef.current?.animate(
        [
          { transform: 'scale(1.14)' },
          { transform: 'scale(0.9, 0.88)', offset: 0.4 },
          { transform: 'scale(1.04)', offset: 0.72 },
          { transform: 'scale(1)' },
        ],
        { duration: 520, easing: 'cubic-bezier(.22,1,.36,1)' },
      );
    }
    wasDragging.current = dragging;
  }, [dragging]);

  const pos = dragging && dragPos ? { x: clamp(dragPos.x, 2, 98), y: clamp(dragPos.y, 2, 98) } : position;
  const isGK = role === 'KL';

  const onKeyDown = (e) => {
    const step = e.shiftKey ? 5 : 2;
    const moves = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
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
      className={`group absolute flex w-[22cqw] flex-col items-center outline-none ${
        dragging ? 'z-30 cursor-grabbing' : 'z-20 cursor-grab'
      } ${anyDragging && !dragging && !isTarget ? 'opacity-90' : ''}`}
      style={{
        left: `${pos.x}%`,
        top: `${pos.y}%`,
        transform: 'translate(-50%, -6.75cqw)',
        transition: dragging
          ? 'none'
          : `left .6s cubic-bezier(.34,1.45,.64,1) ${order * 22}ms, top .6s cubic-bezier(.34,1.45,.64,1) ${order * 22}ms, opacity .2s`,
      }}
    >
      <div className="relative aspect-square w-[13.5cqw]">
        {/* yer gölgesi: kaldırınca açılır ve dağılır */}
        <span
          className="absolute left-1/2 top-[78%] h-[34%] w-[86%] rounded-[50%] bg-black transition-all duration-300 ease-out"
          style={{
            transform: `translate(-50%, ${dragging ? '55%' : '0'}) scale(${dragging ? 1.25 : 1})`,
            opacity: dragging ? 0.22 : 0.45,
            filter: `blur(${dragging ? 7 : 3}px)`,
          }}
        />

        <div
          className="relative h-full w-full transition-transform duration-300 ease-spring"
          style={{
            transform: dragging
              ? `translateY(-14%) scale(1.14) rotate(${tilt}deg)`
              : isTarget
                ? 'scale(1.1)'
                : 'none',
          }}
        >
          <div
            ref={avatarRef}
            className="relative h-full w-full overflow-hidden rounded-full transition-shadow duration-300"
            style={{
              background: player.image ? '#18181b' : `radial-gradient(circle at 30% 25%, ${kit.a}, ${kit.b} 75%)`,
              boxShadow: `inset 0 0 0 0.7cqw ${isGK ? kit.a : 'rgba(255,255,255,0.95)'}, 0 ${dragging ? '3cqw 5cqw' : '0.8cqw 1.6cqw'} rgba(0,0,0,${dragging ? 0.5 : 0.35})`,
            }}
          >
            {player.image ? (
              <img src={player.image} alt="" draggable={false} className="pointer-events-none h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-[4.6cqw] font-extrabold tracking-tight" style={{ color: kit.ink }}>
                {initials(player.name) || role}
              </div>
            )}
            {/* üst parlama */}
            <span className="pointer-events-none absolute inset-0 rounded-full bg-gradient-to-b from-white/25 via-transparent to-transparent" />
            {player.image && (
              <span className="pointer-events-none absolute inset-0 rounded-full" style={{ boxShadow: `inset 0 0 0 0.7cqw ${isGK ? kit.a : 'white'}` }} />
            )}
          </div>

          {/* hover / klavye odağı halkası */}
          <span className="export-hide pointer-events-none absolute -inset-[1cqw] rounded-full ring-[0.5cqw] ring-transparent transition group-hover:ring-white/25 group-focus-visible:ring-[color:var(--accent)]" />

          {captain && (
            <span
              className="absolute -left-[0.6cqw] -top-[0.4cqw] flex h-[4.6cqw] w-[4.6cqw] items-center justify-center rounded-full text-[2.6cqw] font-black shadow-md ring-[0.4cqw] ring-black/30"
              style={{ background: 'var(--accent)', color: 'var(--accent-ink)' }}
            >
              C
            </span>
          )}
          {!player.image && (
            <span className="export-hide absolute -bottom-[0.3cqw] -right-[0.3cqw] flex h-[4.6cqw] w-[4.6cqw] items-center justify-center rounded-full bg-white text-zinc-800 shadow-md">
              <Camera className="h-[55%] w-[55%]" strokeWidth={2.4} />
            </span>
          )}

          {isTarget && (
            <>
              <span
                className="animate-pulse-ring absolute -inset-[1.6cqw] rounded-full border-[0.6cqw]"
                style={{ borderColor: 'var(--accent)', boxShadow: '0 0 4cqw rgb(198 244 50 / 0.6)' }}
              />
              <span
                className="absolute left-1/2 top-1/2 flex h-[6cqw] w-[6cqw] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full shadow-lg"
                style={{ background: 'var(--accent)', color: 'var(--accent-ink)' }}
              >
                <ArrowLeftRight className="h-[60%] w-[60%]" strokeWidth={2.6} />
              </span>
            </>
          )}
        </div>
      </div>

      {showName && (
        <span
          className={`mt-[1.1cqw] flex max-w-full items-center gap-[0.8cqw] rounded-full bg-black/60 py-[0.55cqw] pl-[0.7cqw] pr-[1.6cqw] text-[2.9cqw] font-semibold leading-none text-white ring-1 ring-white/10 transition-transform duration-300 ease-spring ${
            dragging ? 'translate-y-[1cqw] scale-95 opacity-80' : ''
          }`}
        >
          <span
            className="rounded-full px-[0.8cqw] py-[0.3cqw] font-mono text-[2.1cqw] font-bold"
            style={isGK ? { background: kit.a, color: kit.ink } : { background: 'rgba(255,255,255,0.14)', color: 'rgba(255,255,255,0.8)' }}
          >
            {role}
          </span>
          <span className="truncate">{player.name || role}</span>
        </span>
      )}
    </div>
  );
}

export function initials(name = '') {
  // "Oyuncu 7" gibi varsayılan isimlerde forma numarası göster
  const num = name.trim().match(/(?:^|\s)(\d{1,2})$/);
  if (num) return num[1];
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toLocaleUpperCase('tr'))
    .join('');
}
