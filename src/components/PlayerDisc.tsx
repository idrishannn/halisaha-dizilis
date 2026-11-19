import type { Kit, Player } from '../types.ts';

export function initials(name = ''): string {
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

/** Listelerde ve sayfalarda kullanılan yuvarlak oyuncu rozeti. */
export function Avatar({ player, kit, className = 'h-10 w-10 text-sm' }: { player: Player; kit: Kit; className?: string }) {
  return (
    <span
      className={`flex shrink-0 items-center justify-center overflow-hidden rounded-full font-display font-bold ${className}`}
      style={{ background: kit.color, color: kit.ink }}
    >
      {player.image ? <img src={player.image} alt="" className="h-full w-full object-cover" /> : initials(player.name) || '?'}
    </span>
  );
}
