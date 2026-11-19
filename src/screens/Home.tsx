import { useEffect, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { CalendarClock, ChevronRight, Loader2, MapPin, Plus, RefreshCw } from 'lucide-react';
import { initials } from '../components/PlayerDisc.tsx';
import { PrimaryButton, Sheet, TextField } from '../components/ui.tsx';
import type { ToastData } from '../components/ui.tsx';
import { createMatch, watchMyMatches } from '../lib/data.ts';
import { opponentOf, resultFor, scoreLine } from '../lib/model.ts';
import type { MatchDoc, Result, WithId } from '../lib/model.ts';
import { navigate } from '../lib/router.ts';
import { kitFor } from '../kits.ts';
import type { AppState } from '../types.ts';

interface Props {
  session: { uid: string; teamId: string };
  state: AppState;
  setState: Dispatch<SetStateAction<AppState>>;
  notify: (text: string, extra?: Partial<ToastData>) => void;
}

const RESULT_COLOR: Record<Result, string> = { G: '#138A43', B: '#5B655E', M: '#B42318' };

export function formatDay(m: MatchDoc): string {
  const d = m.createdAt?.toDate?.();
  return d ? new Intl.DateTimeFormat('tr', { day: 'numeric', month: 'long' }).format(d) : '';
}

/** Ana sayfa: takım formu, sıradaki maç, son maçlar, "maç kur" düğmesi. */
export default function Home({ session, state, setState, notify }: Props) {
  const [matches, setMatches] = useState<WithId<MatchDoc>[] | null>(null);
  const [listError, setListError] = useState(false);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const kit = kitFor(state.kit);
  const { uid, teamId } = session;

  useEffect(
    () =>
      watchMyMatches(
        uid,
        (list) => {
          setMatches(list);
          setListError(false);
        },
        (err) => {
          console.error(err);
          setListError(true);
          setMatches([]);
        },
      ),
    [uid],
  );

  const mine = (matches ?? []).filter((m) => m.home.teamId === teamId || m.away?.teamId === teamId);
  const played = mine.filter((m) => m.score && m.away);
  const next = mine.find((m) => !m.score);
  const recent = mine.filter((m) => m !== next).slice(0, 6);
  const results = played.map((m) => resultFor(m, teamId)).filter(Boolean) as Result[];
  const tally = { G: 0, B: 0, M: 0 };
  results.forEach((r) => tally[r]++);

  const start = async (place: string, time: string) => {
    setBusy(true);
    try {
      const id = await createMatch(uid, { teamId, name: state.teamName.trim() || 'Takımım', kit: state.kit }, place, time);
      setState((s) => ({ ...s, match: { place, time } }));
      setCreating(false);
      navigate(`/m/${id}?yeni=1`);
    } catch (err) {
      console.error(err);
      notify('Maç kurulamadı. İnternet bağlantını kontrol edip tekrar dene.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-md px-5">
      <header className="flex items-center gap-3 pb-2 pt-5">
        <button onClick={() => navigate('/kadro')} className="flex min-w-0 items-center gap-3 text-left" aria-label="Kadroya git">
          <span
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] font-display text-[15px] font-bold"
            style={{ background: kit.color, color: kit.ink }}
          >
            {initials(state.teamName) || 'T'}
          </span>
          <span className="min-w-0">
            <span className="block text-xs font-medium text-muted">Takımın</span>
            <span className="block truncate text-lg font-bold tracking-[-0.01em]">{state.teamName || 'Takımım'}</span>
          </span>
        </button>
      </header>

      <div className="mt-3 space-y-5">
        {/* Form */}
        <section aria-label="Takım formu" className="space-y-3.5 rounded-[20px] border border-line bg-surface p-4">
          <div className="flex items-baseline justify-between">
            <h2 className="text-[13px] font-semibold text-muted">Son 5 maç</h2>
            <span className="text-[13px] text-muted">
              <b className="font-display text-ink">{played.length}</b> maç
            </span>
          </div>
          {results.length ? (
            <div className="flex items-center justify-between">
              <div className="flex gap-1.5">
                {results.slice(0, 5).map((r, i) => (
                  <ResultChip key={i} r={r} />
                ))}
              </div>
              <div className="flex gap-3.5 font-display text-[13px] text-muted">
                {(['G', 'B', 'M'] as const).map((k) => (
                  <span key={k}>
                    <b className="text-lg text-ink">{tally[k]}</b> {k}
                  </span>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted">Henüz oynanmış maç yok. İlk maçını kur, rakibine linki at.</p>
          )}
        </section>

        {/* Sıradaki maç */}
        {matches === null ? (
          <div className="flex justify-center py-8 text-muted"><Loader2 className="animate-spin" /></div>
        ) : (
          next && (
            <section aria-label="Sıradaki maç" className="space-y-2.5">
              <h2 className="text-[13px] font-semibold text-muted">Sıradaki maç</h2>
              <NextMatchCard match={next} teamId={teamId} />
            </section>
          )
        )}

        {listError && (
          <p className="rounded-2xl border border-line bg-surface p-4 text-sm text-muted">
            Maç listesi şu an yüklenemedi. Biraz sonra tekrar dene.
          </p>
        )}

        {/* Son maçlar */}
        {recent.length > 0 && (
          <section aria-label="Son maçlar" className="space-y-2.5">
            <h2 className="text-[13px] font-semibold text-muted">Son maçlar</h2>
            <ul className="divide-y divide-[#EEF0EC] rounded-[20px] border border-line bg-surface">
              {recent.map((m) => {
                const r = resultFor(m, teamId);
                const opp = opponentOf(m, teamId);
                return (
                  <li key={m.id} className="flex items-center gap-3 px-3.5 py-3">
                    <a
                      href={`/m/${m.id}`}
                      onClick={(e) => {
                        e.preventDefault();
                        navigate(`/m/${m.id}`);
                      }}
                      className="flex min-w-0 flex-1 items-center gap-3"
                    >
                      {r ? <ResultChip r={r} /> : <span className="h-[22px] w-[22px] rounded-[7px] border border-dashed border-[#C9CEC6]" />}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[15px] font-semibold">{opp?.name ?? 'Rakip bekleniyor'}</span>
                        <span className="block truncate text-xs text-muted">{[formatDay(m), m.place].filter(Boolean).join(' · ')}</span>
                      </span>
                      <span className="font-display text-lg font-bold">{scoreLine(m, teamId)}</span>
                    </a>
                    {r && (
                      <button
                        onClick={() => start(m.place, m.time)}
                        disabled={busy}
                        aria-label={`${opp?.name ?? 'Rakip'} ile rövanş kur`}
                        className="flex h-9 items-center gap-1.5 rounded-xl border border-line bg-bg px-3 text-[13px] font-semibold active:scale-95"
                      >
                        <RefreshCw size={13} strokeWidth={2.4} /> Rövanş
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        <PrimaryButton onClick={() => setCreating(true)} className="w-full">
          <Plus size={20} strokeWidth={2.4} /> Maç kur, linki rakibe at
        </PrimaryButton>
      </div>

      <CreateMatchSheet
        open={creating}
        busy={busy}
        initial={state.match}
        onClose={() => setCreating(false)}
        onCreate={start}
      />
    </div>
  );
}

export function ResultChip({ r }: { r: Result }) {
  return (
    <span
      className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-[7px] text-[11px] font-bold text-white"
      style={{ background: RESULT_COLOR[r] }}
    >
      {r}
    </span>
  );
}

function NextMatchCard({ match, teamId }: { match: WithId<MatchDoc>; teamId: string }) {
  const me = match.home.teamId === teamId ? match.home : match.away;
  const opp = opponentOf(match, teamId);
  return (
    <a
      href={`/m/${match.id}`}
      onClick={(e) => {
        e.preventDefault();
        navigate(`/m/${match.id}`);
      }}
      className="block overflow-hidden rounded-[22px] bg-pitch text-white"
    >
      <div
        className="relative h-24"
        style={{ background: 'radial-gradient(120% 90% at 50% 0%, #2C9A5A 0%, #1B6E3D 55%, #0B1A12 100%)' }}
      >
        <span
          className="absolute inset-x-8 -bottom-10 top-3 rounded-t border-[1.5px] border-b-0 border-white/50"
          style={{ transform: 'perspective(300px) rotateX(38deg)', transformOrigin: '50% 0%' }}
        />
        <span className="absolute left-4 top-3.5 flex items-center gap-1.5 rounded-full bg-black/35 px-2.5 py-1 text-xs font-semibold">
          <span className={`h-[7px] w-[7px] rounded-full ${match.away ? 'bg-[#7CF0A6]' : 'bg-[#FACC15]'}`} />
          {match.away ? 'Rakip katıldı' : 'Rakip bekleniyor'}
        </span>
      </div>
      <div className="space-y-2.5 p-4">
        <div className="flex items-center justify-between gap-2 text-base font-bold">
          <span className="flex min-w-0 items-center gap-2">
            <span className="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ background: kitFor(me?.kit ?? '').color }} />
            <span className="truncate">{me?.name}</span>
          </span>
          <span className="font-display text-xs text-white/60">VS</span>
          <span className="flex min-w-0 items-center justify-end gap-2">
            <span className="truncate">{opp?.name ?? '?'}</span>
            {opp && <span className="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ background: kitFor(opp.kit).color }} />}
          </span>
        </div>
        <div className="flex items-center justify-between text-[13px] text-white/70">
          <span>{match.time || 'Saat belirtilmedi'}</span>
          <span className="flex items-center gap-1">
            {match.place}
            <ChevronRight size={15} />
          </span>
        </div>
      </div>
    </a>
  );
}

function CreateMatchSheet({
  open, busy, initial, onClose, onCreate,
}: {
  open: boolean;
  busy: boolean;
  initial: AppState['match'];
  onClose: () => void;
  onCreate: (place: string, time: string) => void;
}) {
  const [place, setPlace] = useState(initial.place);
  const [time, setTime] = useState(initial.time);
  useEffect(() => {
    if (open) {
      setPlace(initial.place);
      setTime(initial.time);
    }
  }, [open, initial.place, initial.time]);

  return (
    <Sheet open={open} onClose={onClose} label="Maç kur">
      <div className="space-y-5">
        <div>
          <h2 className="text-xl font-bold">Maç kur</h2>
          <p className="mt-1 text-sm text-muted">Sonra linki rakip takıma atarsın; açınca kendi kadrosuyla katılır.</p>
        </div>
        <TextField label="Gün / saat" placeholder="Örn. Perşembe 21:00" value={time} onChange={setTime} icon={<CalendarClock size={17} />} maxLength={60} />
        <TextField label="Saha" placeholder="Örn. Yıldız Halı Saha" value={place} onChange={setPlace} icon={<MapPin size={17} />} maxLength={60} />
        <PrimaryButton onClick={() => onCreate(place.trim(), time.trim())} disabled={busy} className="w-full">
          {busy ? <Loader2 size={18} className="animate-spin" /> : null}
          Maçı kur ve linki al
        </PrimaryButton>
      </div>
    </Sheet>
  );
}
