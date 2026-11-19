import { useEffect, useMemo, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import {
  CalendarClock, Check, ChevronLeft, Link2, Loader2, MapPin, Minus, Pencil, Plus, RefreshCw, Share2, ShieldCheck,
} from 'lucide-react';
import PerspectivePitch from '../components/PerspectivePitch.tsx';
import type { PitchTeam } from '../components/PerspectivePitch.tsx';
import { KitSwatches, PrimaryButton, SecondaryButton, Sheet, TextField } from '../components/ui.tsx';
import type { ToastData } from '../components/ui.tsx';
import { createMatch, joinMatch, matchUrl, setScore, watchMatch, watchMyMatches, watchTeam } from '../lib/data.ts';
import { headToHead, teamLineup } from '../lib/model.ts';
import type { MatchDoc, TeamDoc, WithId } from '../lib/model.ts';
import { navigate } from '../lib/router.ts';
import { KITS, kitFor } from '../kits.ts';
import { positionsFor } from '../state.ts';
import type { AppState, Kit } from '../types.ts';
import { ResultChip } from './Home.tsx';

interface Props {
  id: string;
  session: { uid: string; teamId: string };
  state: AppState;
  setState: Dispatch<SetStateAction<AppState>>;
  notify: (text: string, extra?: Partial<ToastData>) => void;
}

/** İki takımın formaları aynıysa üstteki takım farklı görünsün. */
function distinctKit(kit: Kit, other: Kit): Kit {
  if (kit.color !== other.color) return kit;
  return kit.color === KITS.orange.color ? KITS.blue : KITS.orange;
}

export default function Match({ id, session, state, setState, notify }: Props) {
  const { uid, teamId } = session;
  const [match, setMatch] = useState<WithId<MatchDoc> | null | undefined>(undefined);
  const [teams, setTeams] = useState<Record<string, TeamDoc | null>>({});
  const [spectate, setSpectate] = useState(false);
  const [scoring, setScoring] = useState(false);
  const [justCreated] = useState(() => new URLSearchParams(window.location.search).has('yeni'));

  useEffect(() => {
    if (justCreated) window.history.replaceState(null, '', `/m/${id}`);
  }, [id, justCreated]);

  useEffect(() => watchMatch(id, (m) => setMatch(m)), [id]);

  // Diğer takım(lar)ın kadrosunu canlı izle
  const otherIds = useMemo(
    () => [match?.home.teamId, match?.away?.teamId].filter((t): t is string => !!t && t !== teamId),
    [match?.home.teamId, match?.away?.teamId, teamId],
  );
  useEffect(() => {
    const stops = otherIds.map((tid) => watchTeam(tid, (t) => setTeams((prev) => ({ ...prev, [tid]: t }))));
    return () => stops.forEach((s) => s());
  }, [otherIds.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps

  if (match === undefined) {
    return (
      <div className="flex justify-center pt-32 text-muted">
        <Loader2 className="animate-spin" />
      </div>
    );
  }
  if (match === null) {
    return (
      <div className="mx-auto max-w-sm px-6 pt-28 text-center">
        <h1 className="text-xl font-bold">Maç bulunamadı</h1>
        <p className="mt-2 text-sm text-muted">Link hatalı olabilir ya da maç silinmiş.</p>
        <PrimaryButton onClick={() => navigate('/')} className="mx-auto mt-6">Ana sayfa</PrimaryButton>
      </div>
    );
  }

  const amHome = match.home.teamId === teamId;
  const amAway = match.away?.teamId === teamId;
  const member = match.members.includes(uid) && (amHome || amAway);
  const canJoin = !member && !match.away && !amHome;

  if (canJoin && !spectate) {
    return <Invite match={match} session={session} state={state} setState={setState} notify={notify} onSpectate={() => setSpectate(true)} />;
  }

  const myKit = kitFor(state.kit);
  const myTeam: PitchTeam = {
    side: 'home',
    kit: myKit,
    players: state.players.slice(0, state.size),
    slots: positionsFor(state),
    captainId: state.captain,
  };
  const fromDoc = (tid: string | undefined, side: 'home' | 'away', fallbackKit: string): PitchTeam | null => {
    const doc = tid ? teams[tid] : null;
    if (!doc) return null;
    return { side, kit: kitFor(doc.kit || fallbackKit), ...teamLineup(doc) };
  };

  // Görünüm: kendi takımın altta. İzleyiciysen ev sahibi altta.
  let bottom: PitchTeam | null;
  let top: PitchTeam | null;
  if (member) {
    bottom = myTeam;
    top = amHome ? fromDoc(match.away?.teamId, 'away', match.away?.kit ?? '') : fromDoc(match.home.teamId, 'away', match.home.kit);
  } else {
    bottom = fromDoc(match.home.teamId, 'home', match.home.kit);
    top = fromDoc(match.away?.teamId, 'away', match.away?.kit ?? '');
  }
  if (top && bottom) top = { ...top, kit: distinctKit(top.kit, bottom.kit) };

  const homeName = amHome ? state.teamName : teams[match.home.teamId]?.name ?? match.home.name;
  const awayName = match.away ? (amAway ? state.teamName : teams[match.away.teamId]?.name ?? match.away.name) : null;
  const bottomName = member ? state.teamName : homeName;
  const topName = member ? (amHome ? awayName : homeName) : awayName;

  const share = () => shareMatch(match, homeName, notify);

  return (
    <div className="mx-auto max-w-md pb-8">
      <header className="flex items-center gap-2.5 px-4 pb-2.5 pt-3.5">
        <button
          onClick={() => navigate('/')}
          aria-label="Geri"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] border border-line bg-surface"
        >
          <ChevronLeft size={21} />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-base font-bold">{match.time || 'Halı saha maçı'}</h1>
          <p className="truncate text-xs text-muted">{[match.place, `${state.size}'li`].filter(Boolean).join(' · ')}</p>
        </div>
        <button
          onClick={share}
          className="flex h-11 shrink-0 items-center gap-1.5 rounded-[14px] border border-line bg-surface px-3.5 text-sm font-semibold"
        >
          <Link2 size={17} /> Link
        </button>
      </header>

      {justCreated && !match.away && (
        <div className="mx-4 mb-3 flex items-center gap-3 rounded-[18px] bg-ink p-3.5 pl-4 text-white">
          <div className="min-w-0 flex-1">
            <div className="text-[15px] font-bold">Maç kuruldu</div>
            <div className="text-[13px] text-white/70">Linki rakip takımın kaptanına gönder.</div>
          </div>
          <button onClick={share} className="flex h-11 items-center gap-1.5 rounded-xl bg-lime px-4 text-sm font-bold text-ink">
            <Share2 size={16} /> Gönder
          </button>
        </div>
      )}

      {/* takımlar / skor */}
      <section aria-label="Takımlar" className="mx-4 grid grid-cols-[1fr_auto_1fr] items-center gap-2 rounded-[18px] border border-line bg-surface px-3.5 py-3">
        <TeamLabel name={bottomName} kit={bottom?.kit ?? myKit} sub={member ? 'sen' : 'ev sahibi'} />
        {match.score ? (
          <div className="font-display text-2xl font-bold tracking-tight">
            {member && amAway ? `${match.score.away}–${match.score.home}` : `${match.score.home}–${match.score.away}`}
          </div>
        ) : (
          <div className="rounded-lg bg-bg px-2 py-1 font-display text-xs font-bold text-muted">VS</div>
        )}
        <TeamLabel name={topName ?? 'Rakip bekleniyor'} kit={top?.kit} sub={top ? 'rakip' : 'link bekliyor'} right />
      </section>

      {/* saha */}
      <section aria-label="Saha" className="relative mt-3">
        <PerspectivePitch
          view="full"
          showNames={state.showNames}
          teams={[bottom, top].filter(Boolean) as PitchTeam[]}
          overlay={
            !match.away && (
              <div className="absolute inset-x-0 top-[16%] flex justify-center px-6">
                <div className="flex flex-col items-center gap-2.5 rounded-2xl bg-black/65 px-5 py-4 text-center text-white backdrop-blur-sm">
                  <span className="text-[15px] font-bold">Rakip bekleniyor</span>
                  <span className="max-w-[240px] text-[13px] text-white/75">Linki açınca kadroları burada belirecek.</span>
                  <button onClick={share} className="mt-1 flex h-10 items-center gap-1.5 rounded-xl bg-white px-4 text-sm font-bold text-ink">
                    <Share2 size={15} /> Linki gönder
                  </button>
                </div>
              </div>
            )
          }
        />
      </section>

      {match.score && (
        <p className="mt-2.5 text-center text-xs text-muted">Skoru {match.score.by} girdi</p>
      )}

      {/* aksiyonlar */}
      {member ? (
        <div className="mt-4 grid grid-cols-2 gap-2.5 px-4">
          <SecondaryButton onClick={() => navigate('/kadro')} className="h-[52px] whitespace-nowrap px-3 text-[15px]">
            <Pencil size={17} className="shrink-0" /> Kadromu düzenle
          </SecondaryButton>
          <PrimaryButton onClick={() => setScoring(true)} disabled={!match.away} className="h-[52px] whitespace-nowrap px-3 text-[15px]">
            <Check size={18} /> {match.score ? 'Skoru düzelt' : 'Skoru gir'}
          </PrimaryButton>
        </div>
      ) : (
        <div className="mt-4 px-4">
          <SecondaryButton onClick={() => navigate('/')} className="w-full">Kendi maçını kur</SecondaryButton>
        </div>
      )}

      {member && match.away && match.score && (
        <Rivalry uid={uid} teamId={teamId} opponentId={amHome ? match.away.teamId : match.home.teamId} match={match} notify={notify} />
      )}

      {member && match.away && (
        <ScoreSheet
          open={scoring}
          onClose={() => setScoring(false)}
          match={match}
          homeName={homeName}
          awayName={awayName ?? ''}
          onSave={async (h, a) => {
            try {
              await setScore(match.id, uid, state.teamName.trim() || 'Takımım', h, a);
              setScoring(false);
              notify('Skor kaydedildi', { icon: <Check size={16} className="text-lime" /> });
            } catch (err) {
              console.error(err);
              notify('Skor kaydedilemedi, tekrar dene.');
            }
          }}
        />
      )}
    </div>
  );
}

function TeamLabel({ name, kit, sub, right = false }: { name: string; kit?: Kit; sub: string; right?: boolean }) {
  return (
    <div className={`flex min-w-0 items-center gap-2 ${right ? 'flex-row-reverse text-right' : ''}`}>
      <span className="h-3 w-3 shrink-0 rounded" style={{ background: kit?.color ?? '#D8DCD5' }} />
      <div className="min-w-0">
        <div className="truncate text-sm font-bold">{name}</div>
        <div className="text-[11px] text-muted">{sub}</div>
      </div>
    </div>
  );
}

async function shareMatch(match: MatchDoc & { id: string }, homeName: string, notify: Props['notify']) {
  const url = matchUrl(match.id);
  const text = `${homeName} seni maça çağırıyor${match.time ? ` · ${match.time}` : ''}${match.place ? ` · ${match.place}` : ''}`;
  try {
    if (navigator.share) {
      await navigator.share({ title: 'Halı saha maçı', text, url });
      return;
    }
  } catch (err) {
    if ((err as Error)?.name === 'AbortError') return;
  }
  try {
    await navigator.clipboard.writeText(`${text}\n${url}`);
    notify('Link kopyalandı, WhatsApp grubuna yapıştır', { icon: <Link2 size={16} className="text-lime" /> });
  } catch {
    window.prompt('Linki kopyala:', url);
  }
}

/* ---------------- davet ---------------- */

function Invite({
  match, session, state, setState, notify, onSpectate,
}: Omit<Props, 'id'> & { match: WithId<MatchDoc>; onSpectate: () => void }) {
  const homeKit = match.home.kit;
  const [name, setName] = useState(state.teamName === 'Takımım' ? '' : state.teamName);
  const [kit, setKit] = useState(state.kit === homeKit ? (homeKit === 'orange' ? 'blue' : 'orange') : state.kit);
  const [busy, setBusy] = useState(false);

  const join = async () => {
    const teamName = name.trim() || 'Rakip Takım';
    setBusy(true);
    try {
      setState((s) => ({ ...s, teamName, kit }));
      await joinMatch(match.id, session.uid, { teamId: session.teamId, name: teamName.slice(0, 24), kit });
      notify(`${match.home.name} ile maçtasın. Kadronu kur!`, { icon: <Check size={16} className="text-lime" /> });
    } catch (err) {
      console.error(err);
      notify('Katılılamadı. Başka bir takım daha önce katılmış olabilir.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col">
      <section
        className="relative overflow-hidden px-5 pb-12 pt-6 text-white"
        style={{ background: 'radial-gradient(70% 60% at 50% 0%, #2C9A5A 0%, #17603A 50%, #0B1A12 100%)' }}
      >
        <span
          aria-hidden="true"
          className="absolute inset-x-10 top-36 h-64 rounded-md border-2 border-white/30"
          style={{ transform: 'perspective(500px) rotateX(55deg)', transformOrigin: '50% 0%' }}
        />
        <div className="relative text-[13px] font-semibold text-white/75">Maç daveti</div>
        <h1 className="relative mt-2.5 text-[28px] font-bold leading-[1.15] tracking-[-0.02em]">
          {match.home.name} seni maça çağırıyor
        </h1>
        <div className="relative mt-4 flex flex-wrap gap-2">
          {match.time && (
            <span className="flex items-center gap-1.5 rounded-full bg-black/30 px-3 py-1.5 text-[13px] font-semibold">
              <CalendarClock size={14} /> {match.time}
            </span>
          )}
          {match.place && (
            <span className="flex items-center gap-1.5 rounded-full bg-black/30 px-3 py-1.5 text-[13px] font-semibold">
              <MapPin size={14} /> {match.place}
            </span>
          )}
        </div>
      </section>

      <main className="relative -mt-6 flex-1 space-y-5 rounded-t-[26px] bg-bg px-5 pt-6">
        <TextField label="Takımının adı" placeholder="Örn. Kartallar" value={name} onChange={setName} maxLength={24} onEnter={join} />
        <div className="space-y-2.5">
          <span className="block text-[13px] font-semibold text-muted">Forma rengi</span>
          <KitSwatches kits={KITS} value={kit} onChange={setKit} />
        </div>
        <div className="flex items-start gap-3 rounded-2xl border border-line bg-surface p-3.5">
          <ShieldCheck size={20} className="mt-0.5 shrink-0 text-[#138A43]" />
          <p className="text-sm leading-relaxed text-[#3D4640]">
            Kayıt yok, şifre yok. Katılınca kendi yarı sahanda kadronu kurarsın; iki takım da birbirini anında görür.
          </p>
        </div>
      </main>

      <div className="space-y-2 px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-4">
        <PrimaryButton onClick={join} disabled={busy} className="w-full">
          {busy ? <Loader2 size={18} className="animate-spin" /> : <span className="h-3 w-3 rounded" style={{ background: kitFor(kit).color }} />}
          Takımımla katıl
        </PrimaryButton>
        <button onClick={onSpectate} className="h-12 w-full text-[15px] font-semibold text-[#3D4640]">
          Sadece izle
        </button>
      </div>
    </div>
  );
}

/* ---------------- skor ---------------- */

function ScoreSheet({
  open, onClose, match, homeName, awayName, onSave,
}: {
  open: boolean;
  onClose: () => void;
  match: MatchDoc;
  homeName: string;
  awayName: string;
  onSave: (home: number, away: number) => Promise<void>;
}) {
  const [h, setH] = useState(match.score?.home ?? 0);
  const [a, setA] = useState(match.score?.away ?? 0);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open) {
      setH(match.score?.home ?? 0);
      setA(match.score?.away ?? 0);
    }
  }, [open, match.score?.home, match.score?.away]);

  const row = (label: string, kitId: string, value: number, set: (n: number) => void) => (
    <div className="flex items-center gap-3 rounded-[20px] border border-[#EEF0EC] bg-[#F8F9F6] p-3.5">
      <span className="h-10 w-3.5 shrink-0 rounded-[5px]" style={{ background: kitFor(kitId).color }} />
      <div className="min-w-0 flex-1 truncate text-base font-bold">{label}</div>
      <button
        onClick={() => set(Math.max(0, value - 1))}
        aria-label={`${label} golü azalt`}
        className="flex h-14 w-14 items-center justify-center rounded-[18px] border border-line bg-bg active:scale-95"
      >
        <Minus size={20} strokeWidth={2.6} />
      </button>
      <span aria-live="polite" className="w-12 text-center font-display text-[40px] font-bold">{value}</span>
      <button
        onClick={() => set(Math.min(99, value + 1))}
        aria-label={`${label} golü artır`}
        className="flex h-14 w-14 items-center justify-center rounded-[18px] bg-ink text-white active:scale-95"
      >
        <Plus size={20} strokeWidth={2.6} />
      </button>
    </div>
  );

  return (
    <Sheet open={open} onClose={onClose} label="Skoru gir">
      <div className="space-y-4">
        <div>
          <h2 className="text-[22px] font-bold">Maç nasıl bitti?</h2>
          <p className="mt-1 text-sm text-muted">{[match.time, match.place].filter(Boolean).join(' · ')}</p>
        </div>
        {row(homeName, match.home.kit, h, setH)}
        {row(awayName, match.away?.kit ?? 'orange', a, setA)}
        <p className="text-[13px] leading-relaxed text-muted">İki takım da skoru düzeltebilir. Sonucun altında kimin girdiği yazar.</p>
        <PrimaryButton
          onClick={async () => {
            setBusy(true);
            await onSave(h, a);
            setBusy(false);
          }}
          disabled={busy}
          className="w-full"
        >
          {busy && <Loader2 size={18} className="animate-spin" />}
          Sonucu kaydet · <span className="font-display">{h}–{a}</span>
        </PrimaryButton>
      </div>
    </Sheet>
  );
}

/* ---------------- rekabet ---------------- */

function Rivalry({
  uid, teamId, opponentId, match, notify,
}: { uid: string; teamId: string; opponentId: string; match: WithId<MatchDoc>; notify: Props['notify'] }) {
  const [list, setList] = useState<WithId<MatchDoc>[]>([]);
  const [busy, setBusy] = useState(false);
  useEffect(() => watchMyMatches(uid, setList), [uid]);

  const h2h = headToHead(list, teamId, opponentId);
  const meetings = list
    .filter((m) => m.score && m.away && [m.home.teamId, m.away.teamId].includes(opponentId))
    .slice(0, 5);
  if (!h2h.played) return null;

  const me = match.home.teamId === teamId ? match.home : match.away!;
  const rematch = async () => {
    setBusy(true);
    try {
      const id = await createMatch(uid, { teamId, name: me.name, kit: me.kit }, match.place, match.time);
      navigate(`/m/${id}?yeni=1`);
    } catch {
      notify('Rövanş kurulamadı, tekrar dene.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section aria-label="Aranızdaki seri" className="mx-4 mt-5 space-y-3.5 rounded-[20px] border border-line bg-surface p-4">
      <div className="flex items-baseline justify-between">
        <h2 className="text-[15px] font-bold">Aranızdaki seri</h2>
        <span className="text-[13px] text-muted"><b className="font-display text-ink">{h2h.played}</b> maç</span>
      </div>
      <div className="grid grid-cols-3 text-center">
        <div><div className="font-display text-3xl font-bold text-[#138A43]">{h2h.G}</div><div className="text-xs text-muted">Galibiyet</div></div>
        <div><div className="font-display text-3xl font-bold text-muted">{h2h.B}</div><div className="text-xs text-muted">Beraberlik</div></div>
        <div><div className="font-display text-3xl font-bold text-[#B42318]">{h2h.M}</div><div className="text-xs text-muted">Mağlubiyet</div></div>
      </div>
      <div aria-hidden="true" className="flex h-2.5 gap-[3px] overflow-hidden rounded-full">
        {h2h.G > 0 && <span className="bg-[#138A43]" style={{ flex: h2h.G }} />}
        {h2h.B > 0 && <span className="bg-[#C9CEC6]" style={{ flex: h2h.B }} />}
        {h2h.M > 0 && <span className="bg-[#B42318]" style={{ flex: h2h.M }} />}
      </div>
      {meetings.length > 1 && (
        <div className="flex gap-1.5">
          {meetings.map((m) => {
            const mine = m.home.teamId === teamId;
            const r = m.score!.home === m.score!.away ? 'B' : (m.score!.home > m.score!.away) === mine ? 'G' : 'M';
            return <ResultChip key={m.id} r={r} />;
          })}
        </div>
      )}
      <PrimaryButton onClick={rematch} disabled={busy} className="w-full">
        <RefreshCw size={18} strokeWidth={2.4} /> Rövanş kur
      </PrimaryButton>
    </section>
  );
}
