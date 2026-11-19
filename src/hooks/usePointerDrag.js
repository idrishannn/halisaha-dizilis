import { useRef } from 'react';

const THRESHOLD = 5; // px: bunun altı "dokunma" sayılır

/**
 * Fare ve dokunmatik için tek sürükleme mantığı.
 * Küçük hareket = dokunma (onTap), eşik aşılırsa onStart → onMove* → onEnd.
 * onMove yatay hızı (px/ms) da verir; token bunu eğilme efekti için kullanır.
 */
export function usePointerDrag({ onStart, onMove, onEnd, onTap, disabled }) {
  const s = useRef(null);

  const onPointerDown = (e) => {
    if (disabled || (e.pointerType === 'mouse' && e.button !== 0)) return;
    s.current = { x0: e.clientX, y0: e.clientY, lx: e.clientX, lt: e.timeStamp, vx: 0, active: false };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e) => {
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

  const finish = (e, cancelled) => {
    const d = s.current;
    s.current = null;
    if (!d) return;
    if (d.active) onEnd?.(e, { cancelled });
    else if (!cancelled) onTap?.(e);
  };

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp: (e) => finish(e, false),
    onPointerCancel: (e) => finish(e, true),
  };
}

export const haptic = (pattern) => {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    // bazı tarayıcılar iframe içinde izin vermiyor
  }
};
