import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { Check, X } from 'lucide-react';
import type { Kit } from '../types.ts';

export interface ToastData {
  id: number;
  text: string;
  icon?: ReactNode;
  action?: { label: string; run: () => void };
}

/** Kayan göstergeli segment kontrol. */
export function Segmented<T extends string | number>({
  options, value, onChange, label,
}: { options: { value: T; label: ReactNode }[]; value: T; onChange: (v: T) => void; label: string }) {
  const idx = Math.max(0, options.findIndex((o) => o.value === value));
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="relative grid rounded-2xl border border-line bg-surface p-1"
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      <span
        aria-hidden="true"
        className="absolute inset-y-1 left-1 rounded-xl bg-ink transition-transform duration-500 ease-spring"
        style={{ width: `calc((100% - 0.5rem) / ${options.length})`, transform: `translateX(${idx * 100}%)` }}
      />
      {options.map((o) => (
        <button
          key={o.value}
          role="radio"
          aria-checked={o.value === value}
          onClick={() => onChange(o.value)}
          className={`relative z-10 flex h-10 items-center justify-center rounded-xl text-sm font-semibold transition-colors ${
            o.value === value ? 'text-white' : 'text-muted hover:text-ink'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex min-h-[44px] w-full items-center justify-between gap-3 text-[15px] font-medium text-ink"
    >
      {label}
      <span className={`relative h-7 w-12 shrink-0 rounded-full transition-colors duration-300 ${checked ? 'bg-ink' : 'bg-[#D8DCD5]'}`}>
        <span
          className={`absolute left-0.5 top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform duration-300 ease-spring ${
            checked ? 'translate-x-5' : ''
          }`}
        />
      </span>
    </button>
  );
}

interface TextFieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  icon?: ReactNode;
  maxLength?: number;
  onEnter?: () => void;
}

export function TextField({ label, value, onChange, placeholder, icon, maxLength = 40, onEnter }: TextFieldProps) {
  return (
    <label className="block space-y-1.5">
      <span className="block text-[13px] font-semibold text-muted">{label}</span>
      <span className="flex h-[52px] items-center gap-2 rounded-2xl border border-[#D8DCD5] bg-surface px-4 transition focus-within:border-ink">
        {icon && <span className="text-muted">{icon}</span>}
        <input
          value={value}
          placeholder={placeholder}
          maxLength={maxLength}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && onEnter?.()}
          className="min-w-0 flex-1 bg-transparent text-base font-semibold text-ink outline-none placeholder:font-normal placeholder:text-[#9AA29C]"
        />
      </span>
    </label>
  );
}

export function IconButton({
  label, onClick, disabled, children, className = '',
}: { label: string; onClick: () => void; disabled?: boolean; children: ReactNode; className?: string }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className={`flex h-11 w-11 items-center justify-center rounded-[14px] border border-line bg-surface text-ink transition hover:border-[#C9CEC6] active:scale-95 disabled:pointer-events-none disabled:opacity-40 ${className}`}
    >
      {children}
    </button>
  );
}

export function KitSwatches({ kits, value, onChange }: { kits: Record<string, Kit>; value: string; onChange: (id: string) => void }) {
  return (
    <div className="flex flex-wrap gap-3" role="radiogroup" aria-label="Forma rengi">
      {Object.entries(kits).map(([id, k]) => (
        <button
          key={id}
          role="radio"
          aria-checked={value === id}
          aria-label={k.name}
          title={k.name}
          onClick={() => onChange(id)}
          className="relative h-11 w-11 rounded-[14px] transition active:scale-95"
          style={{
            background: k.color,
            boxShadow: value === id ? `0 0 0 3px #fff, 0 0 0 5px ${k.color}` : 'inset 0 0 0 1px rgba(0,0,0,0.08)',
          }}
        >
          {value === id && <Check size={18} strokeWidth={3} className="absolute inset-0 m-auto" style={{ color: k.ink }} />}
        </button>
      ))}
    </div>
  );
}

export function Toast({ toast, onClose }: { toast: ToastData | null; onClose: () => void }) {
  if (!toast) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-28 z-[80] flex justify-center px-4 lg:bottom-8">
      <div
        key={toast.id}
        role="status"
        className="animate-toast pointer-events-auto flex max-w-md items-center gap-3 rounded-2xl bg-ink py-2.5 pl-4 pr-2 text-sm font-medium text-white shadow-2xl"
      >
        {toast.icon}
        <span className="flex-1">{toast.text}</span>
        {toast.action && (
          <button
            onClick={() => {
              toast.action?.run();
              onClose();
            }}
            className="rounded-lg px-2.5 py-1.5 text-sm font-bold text-lime transition hover:bg-white/10"
          >
            {toast.action.label}
          </button>
        )}
        <button onClick={onClose} aria-label="Kapat" className="rounded-lg p-1.5 text-white/60 hover:bg-white/10 hover:text-white">
          <X size={14} />
        </button>
      </div>
    </div>
  );
}

/** Mobilde alttan açılan, masaüstünde ortada duran panel. */
export function Sheet({
  open, onClose, children, label, wide = false,
}: { open: boolean; onClose: () => void; children: ReactNode; label: string; wide?: boolean }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e: globalThis.KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label={label}>
      <div className="animate-fade absolute inset-0 bg-ink/50" onClick={onClose} />
      <div
        className={`animate-sheet relative max-h-[92dvh] w-full overflow-y-auto rounded-t-[30px] bg-surface px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-3 shadow-2xl sm:rounded-[30px] sm:pt-5 ${
          wide ? 'max-w-[440px]' : 'max-w-md'
        }`}
      >
        <div className="mx-auto mb-4 h-[5px] w-10 rounded-full bg-[#D8DCD5] sm:hidden" />
        {children}
      </div>
    </div>
  );
}

export function PrimaryButton({
  children, onClick, disabled, className = '',
}: { children: ReactNode; onClick: () => void; disabled?: boolean; className?: string }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex h-14 items-center justify-center gap-2.5 rounded-[18px] bg-ink px-5 text-base font-bold text-white transition active:scale-[0.98] disabled:opacity-60 ${className}`}
    >
      {children}
    </button>
  );
}

export function SecondaryButton({
  children, onClick, disabled, className = '', label,
}: { children: ReactNode; onClick: () => void; disabled?: boolean; className?: string; label?: string }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={`flex h-14 items-center justify-center gap-2 rounded-[18px] border border-line bg-surface px-5 text-base font-semibold text-ink transition hover:border-[#C9CEC6] active:scale-[0.98] disabled:opacity-60 ${className}`}
    >
      {children}
    </button>
  );
}
