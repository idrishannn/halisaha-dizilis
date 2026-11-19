import { useEffect, useRef } from 'react';
import { Check, X } from 'lucide-react';

/** Kayan göstergeli segment kontrol (iOS tarzı). */
export function Segmented({ options, value, onChange, size = 'md' }) {
  const idx = Math.max(0, options.findIndex((o) => o.value === value));
  const pad = size === 'lg' ? 'py-2.5 text-sm' : 'py-2 text-[13px]';
  return (
    <div role="radiogroup" className="relative grid rounded-xl bg-black/40 p-1 ring-1 ring-inset ring-white/[0.06]" style={{ gridTemplateColumns: `repeat(${options.length}, 1fr)` }}>
      <span
        aria-hidden="true"
        className="absolute inset-y-1 left-1 rounded-lg bg-white/[0.12] shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_4px_14px_-4px_rgba(0,0,0,0.6)] transition-transform duration-500 ease-spring"
        style={{ width: `calc((100% - 0.5rem) / ${options.length})`, transform: `translateX(${idx * 100}%)` }}
      />
      {options.map((o) => (
        <button
          key={o.value}
          role="radio"
          aria-checked={o.value === value}
          onClick={() => onChange(o.value)}
          className={`relative z-10 flex items-center justify-center gap-1.5 rounded-lg font-semibold transition-colors ${pad} ${
            o.value === value ? 'text-white' : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          {o.icon}
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Switch({ checked, onChange, label }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-3 rounded-xl px-1 py-1 text-sm text-zinc-300"
    >
      {label}
      <span
        className={`relative h-6 w-10 shrink-0 rounded-full transition-colors duration-300 ${checked ? '' : 'bg-white/15'}`}
        style={checked ? { background: 'var(--accent)' } : undefined}
      >
        <span
          className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow-md transition-transform duration-300 ease-spring ${
            checked ? 'translate-x-4' : ''
          }`}
        />
      </span>
    </button>
  );
}

export function TextField({ label, value, onChange, placeholder, icon, maxLength = 40, autoFocus, onEnter }) {
  return (
    <label className="group block">
      {label && <span className="mb-1.5 block text-xs font-medium text-zinc-400">{label}</span>}
      <span className="flex items-center gap-2 rounded-xl bg-black/30 px-3 ring-1 ring-inset ring-white/[0.08] transition focus-within:bg-black/50 focus-within:ring-[color:var(--accent)]">
        {icon && <span className="text-zinc-500 group-focus-within:text-zinc-300">{icon}</span>}
        <input
          value={value}
          placeholder={placeholder}
          autoFocus={autoFocus}
          maxLength={maxLength}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && onEnter?.()}
          className="min-w-0 flex-1 bg-transparent py-2.5 text-sm text-white outline-none placeholder:text-zinc-600"
        />
      </span>
    </label>
  );
}

export function Card({ title, action, children, className = '' }) {
  return (
    <section className={`glass space-y-4 rounded-2xl p-4 ${className}`}>
      {(title || action) && (
        <div className="flex items-center justify-between">
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-400">{title}</h3>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function IconButton({ label, onClick, disabled, children, active }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className={`flex h-10 items-center justify-center gap-1.5 rounded-xl px-3 text-sm font-medium transition active:scale-95 disabled:pointer-events-none disabled:opacity-35 ${
        active ? 'bg-white/15 text-white' : 'text-zinc-300 hover:bg-white/10 hover:text-white'
      }`}
    >
      {children}
    </button>
  );
}

export function KitSwatches({ kits, value, onChange }) {
  return (
    <div className="flex flex-wrap gap-2.5" role="radiogroup" aria-label="Forma rengi">
      {Object.entries(kits).map(([id, k]) => (
        <button
          key={id}
          role="radio"
          aria-checked={value === id}
          aria-label={k.name}
          title={k.name}
          onClick={() => onChange(id)}
          className={`relative h-9 w-9 rounded-full transition duration-300 ease-spring hover:scale-110 active:scale-95 ${
            value === id ? 'scale-110' : ''
          }`}
          style={{
            background: `radial-gradient(circle at 30% 25%, ${k.a}, ${k.b} 75%)`,
            boxShadow: value === id ? `0 0 0 2px #0c0f10, 0 0 0 4px ${k.a}, 0 6px 20px -4px ${k.a}` : 'inset 0 0 0 1px rgba(255,255,255,0.15)',
          }}
        >
          {value === id && <Check size={16} strokeWidth={3} className="absolute inset-0 m-auto" style={{ color: k.ink }} />}
        </button>
      ))}
    </div>
  );
}

export function Toast({ toast, onClose }) {
  if (!toast) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-24 z-[60] flex justify-center px-4 lg:bottom-8">
      <div
        key={toast.id}
        role="status"
        className="animate-toast pointer-events-auto flex max-w-md items-center gap-3 rounded-2xl bg-zinc-900/90 py-2.5 pl-4 pr-2 text-sm text-zinc-100 shadow-2xl ring-1 ring-white/10 backdrop-blur-xl"
      >
        {toast.icon}
        <span className="flex-1">{toast.text}</span>
        {toast.action && (
          <button
            onClick={() => { toast.action.run(); onClose(); }}
            className="rounded-lg px-2.5 py-1.5 text-sm font-semibold transition hover:bg-white/10"
            style={{ color: 'var(--accent)' }}
          >
            {toast.action.label}
          </button>
        )}
        <button onClick={onClose} aria-label="Kapat" className="rounded-lg p-1.5 text-zinc-500 hover:bg-white/10 hover:text-white">
          <X size={14} />
        </button>
      </div>
    </div>
  );
}

/** Mobilde alttan açılan, masaüstünde ortada duran panel. */
export function Sheet({ open, onClose, children, label }) {
  const panel = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label={label}>
      <div className="animate-[fade-up_.25s_ease-out] absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div
        ref={panel}
        className="animate-toast relative w-full max-w-md rounded-t-[28px] bg-ink-850 p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl ring-1 ring-white/10 sm:rounded-[28px]"
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-white/15 sm:hidden" />
        {children}
      </div>
    </div>
  );
}
