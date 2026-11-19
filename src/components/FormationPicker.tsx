import type { Slot } from '../types.ts';

/** Diziliş seçici: her düğmede küçük bir yerleşim önizlemesi. */
export default function FormationPicker({
  formations, value, onChange,
}: { formations: Record<string, Slot[]>; value: string; onChange: (f: string) => void }) {
  return (
    <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Diziliş">
      {Object.entries(formations).map(([name, slots]) => {
        const active = name === value;
        return (
          <button
            key={name}
            role="radio"
            aria-checked={active}
            onClick={() => onChange(name)}
            className={`flex h-12 items-center justify-center gap-2 rounded-2xl border font-display text-[15px] font-bold transition active:scale-[0.97] ${
              active ? 'border-ink bg-ink text-white' : 'border-line bg-surface text-ink hover:border-[#C9CEC6]'
            }`}
          >
            <svg viewBox="0 0 20 22" className="h-5 w-[18px]" aria-hidden="true">
              {slots.map((s, i) => (
                <circle key={i} cx={1.5 + (s.x / 100) * 17} cy={1.5 + (s.y / 100) * 19} r="1.7" fill={active ? (i === 0 ? '#FACC15' : '#C6F432') : '#5B655E'} />
              ))}
            </svg>
            {name}
          </button>
        );
      })}
    </div>
  );
}
