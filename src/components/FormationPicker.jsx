/** Diziliş kartları: her biri mini bir saha önizlemesi gösterir. */
export default function FormationPicker({ formations, value, onChange }) {
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
            className={`group relative overflow-hidden rounded-xl p-2 text-center transition duration-300 ease-spring active:scale-95 ${
              active ? 'bg-white/[0.1] ring-2 ring-inset ring-[color:var(--accent)]' : 'bg-black/30 ring-1 ring-inset ring-white/[0.07] hover:bg-white/[0.06]'
            }`}
          >
            <svg viewBox="0 0 40 52" className="mx-auto mb-1.5 w-full max-w-[64px]" aria-hidden="true">
              <rect x="1" y="1" width="38" height="50" rx="4" fill={active ? '#1a7a3a' : 'rgba(255,255,255,0.04)'} stroke="rgba(255,255,255,0.18)" />
              <line x1="1" y1="26" x2="39" y2="26" stroke="rgba(255,255,255,0.18)" />
              <circle cx="20" cy="26" r="5" fill="none" stroke="rgba(255,255,255,0.18)" />
              {slots.map((s, i) => (
                <circle
                  key={i}
                  cx={1 + (s.x / 100) * 38}
                  cy={1 + (s.y / 100) * 50}
                  r="2.6"
                  fill={i === 0 ? '#fde047' : active ? 'var(--accent)' : 'rgba(255,255,255,0.7)'}
                  className="transition-all duration-500"
                />
              ))}
            </svg>
            <span className={`font-mono text-[13px] font-semibold ${active ? 'text-white' : 'text-zinc-400 group-hover:text-zinc-200'}`}>{name}</span>
          </button>
        );
      })}
    </div>
  );
}
