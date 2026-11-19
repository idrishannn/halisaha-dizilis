import { useRef } from 'react';
import type { PointerEvent } from 'react';

const THRESHOLD = 5; // px: bunun altı "dokunma" sayılır

interface DragInfo {
  dx: number;
  dy: number;
  /** Yatay hız (px/ms), yumuşatılmış */
  vx: number;
}

interface Options {
  onStart?: (e: PointerEvent) => void;
  onMove?: (e: PointerEvent, info: DragInfo) => void;
  onEnd?: (e: PointerEvent, info: { cancelled: boolean }) => void;
  onTap?: (e: PointerEvent) => void;
  disabled?: boolean;
}

interface Session {
  x0: number;
  y0: number;
  lx: number;
  lt: number;
  vx: number;
  active: boolean;
}

/**
 * Fare ve dokunmatik için tek sürükleme mantığı.
 * Küçük hareket = dokunma (onTap), eşik aşılırsa onStart → onMove* → onEnd.
 */
export function usePointerDrag({ onStart, onMove, onEnd, onTap, disabled }: Options) {
  const s = useRef<Session | null>(null);

  const onPointerDown = (e: PointerEvent) => {
    if (disabled || (e.pointerType === 'mouse' && e.button !== 0)) return;
    s.current = { x0: e.clientX, y0: e.clientY, lx: e.clientX, lt: e.timeStamp, vx: 0, active: false };
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: PointerEvent) => {
    const d = s.current;
    if (!d) return;
    const dx = e.clientX - d.x0;
    const dy = e.clientY - d.y0;
    if (!d.active) {
      if (Math.hypot(dx, dy) < THRESHOLD) return;
      d.active = true;
      onStart?.(e);
    }
    const dt = Math.max(1, e.timeStamp - d.lt);
    // Hızı yumuşat: ani sıçramalar eğilmeyi titretmesin
    d.vx = d.vx * 0.7 + ((e.clientX - d.lx) / dt) * 0.3;
    d.lx = e.clientX;
    d.lt = e.timeStamp;
    onMove?.(e, { dx, dy, vx: d.vx });
  };

  const finish = (e: PointerEvent, cancelled: boolean) => {
    const d = s.current;
    s.current = null;
    if (!d) return;
    if (d.active) onEnd?.(e, { cancelled });
    else if (!cancelled) onTap?.(e);
  };

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp: (e: PointerEvent) => finish(e, false),
    onPointerCancel: (e: PointerEvent) => finish(e, true),
  };
}

export const haptic = (pattern: number | number[]) => {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    // bazı tarayıcılar iframe içinde izin vermiyor
  }
};
