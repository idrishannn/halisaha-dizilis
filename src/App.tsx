import { forwardRef, useCallback, useEffect, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { toBlob } from 'html-to-image';
import {
  ArrowLeftRight, CalendarClock, Camera, Crown, Download, Eye, ImagePlus, Loader2,
  MapPin, RotateCcw, Settings, Share2, Trash2, Undo2, X,
} from 'lucide-react';
import Bench from './components/Bench.tsx';
import FormationPicker from './components/FormationPicker.tsx';
import HalfPitch, { DragGuides, PlayerToken } from './components/HalfPitch.tsx';
import type { PitchDrag } from './components/HalfPitch.tsx';
import PerspectivePitch from './components/PerspectivePitch.tsx';
import { Avatar, initials } from './components/PlayerDisc.tsx';
import {
  IconButton, KitSwatches, PrimaryButton, SecondaryButton, Segmented, Sheet, Switch, TextField, Toast,
} from './components/ui.tsx';
import type { ToastData } from './components/ui.tsx';
import { haptic } from './hooks/usePointerDrag.ts';
import { SIZES, TEAM_SIZES, formationKey } from './formations.ts';
import { GK_KIT, KITS, kitFor } from './kits.ts';
import { resizeImage } from './image.ts';
import {
  defaultState, loadState, movePlayer, positionsFor, resetPositions,
  saveState, setFormation, setSize, swapPlayers, updatePlayer,
} from './state.ts';
import type { AppState, Kit, Player, Role, Slot } from './types.ts';

const storage = (() => {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
})();

const SWAP_RADIUS = 9; // saha genişliğinin yüzdesi: bu kadar yakına bırakılırsa yer değiştirir
const SNAP_RADIUS = 4; // dizilişin varsayılan noktasına bu kadar yaklaşınca mıknatıs gibi oturur

function useIsDesktop() {
  const query = '(min-width: 1024px)';
  const [match, setMatch] = useState(() => typeof window !== 'undefined' && window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const on = () => setMatch(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return match;
}

export default function App() {
  const [state, setState] = useState<AppState>(() => (storage ? loadState(storage) : defaultState()));
  const [toast, setToast] = useState<ToastData | null>(null);
  const [busy, setBusy] = useState<'share' | 'download' | null>(null);
  const [drag, setDrag] = useState<PitchDrag | null>(null);
  const [editing, setEditing] = useState<number | null>(null); // düzenlenen oyuncunun kadro sırası
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [canUndo, setCanUndo] = useState(false);
  const isDesktop = useIsDesktop();

  const cardRef = useRef<HTMLDivElement>(null);
  const fieldRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const pickingFor = useRef<number | null>(null);
  const stateRef = useRef(state);
  const dragRef = useRef<PitchDrag | null>(null);
  const past = useRef<AppState[]>([]);
  stateRef.current = state;
  dragRef.current = drag;

  const notify = (text: string, extra: Partial<ToastData> = {}) => setToast({ id: Date.now(), text, ...extra });

  useEffect(() => {
    if (storage && !saveState(storage, state)) {
      notify('Tarayıcı depolama alanı doldu; son değişiklik kaydedilemedi. Bazı fotoğrafları kaldır.');
    }
  }, [state]);

  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(null), toast.action ? 5000 : 3500);
    return () => clearTimeout(t);
  }, [toast]);

  const kit = kitFor(state.kit);
  const positions = positionsFor(state);
  const basePositions = TEAM_SIZES[state.size][state.formation];
  const lineup = state.players.slice(0, state.size);
  const bench = state.players.slice(state.size);

  /* ---------- geri alınabilir değişiklikler ---------- */
  const apply = (fn: (s: AppState) => AppState) => {
    past.current = [...past.current.slice(-40), stateRef.current];
    setCanUndo(true);
    setState(fn);
  };

  // Yalnızca kadro düzenini geri alır; bu arada yazılan isimler/fotoğraflar korunur.
  const undo = useCallback(() => {
    const prev = past.current.pop();
    setCanUndo(past.current.length > 0);
    if (!prev) return;
    setState((s) => ({
      ...s,
      size: prev.size,
      formation: prev.formation,
      overrides: prev.overrides,
      players: prev.players.map((p) => s.players.find((q) => q.id === p.id) || p),
    }));
    haptic(6);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey && !/INPUT|TEXTAREA/.test(tag)) {
        e.preventDefault();
        undo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo]);

  /* ---------- sürükle-bırak ---------- */
  const startDrag = (kind: PitchDrag['kind']) => (slot: number) => {
    haptic(8);
    if (kind === 'pitch') {
      const origin = positions[slot];
      setDrag({ kind, slot, x: origin.x, y: origin.y, origin, base: basePositions[slot], over: null, snap: false });
    } else {
      setDrag({ kind, slot, over: null });
    }
  };

  const moveDrag = (cx: number, cy: number) => {
    const d = dragRef.current;
    const rect = fieldRef.current?.getBoundingClientRect();
    if (!d || !rect) return;
    const x = ((cx - rect.left) / rect.width) * 100;
    const y = ((cy - rect.top) / rect.height) * 100;
    const outside = y > 100 || y < 0 || x < 0 || x > 100;

    let over: number | null = null;
    let best = SWAP_RADIUS;
    positions.forEach((p, j) => {
      if (j === d.slot) return;
      const dist = Math.hypot(x - p.x, (y - p.y) * 1.17);
      if (dist < best) {
        best = dist;
        over = j;
      }
    });
    if (over == null && d.kind === 'pitch' && outside) {
      const hit = document.elementsFromPoint(cx, cy).find((el) => (el as HTMLElement).dataset?.benchSlot != null) as
        | HTMLElement
        | undefined;
      if (hit) over = Number(hit.dataset.benchSlot);
    }
    const snap =
      d.kind === 'pitch' && over == null && !!d.base && Math.hypot(x - d.base.x, (y - d.base.y) * 1.17) < SNAP_RADIUS;
    if ((over != null && over !== d.over) || (snap && !d.snap)) haptic(4);

    const next = { ...d, x, y, over, snap };
    dragRef.current = next;
    setDrag(next);
  };

  const endDrag = (cancelled: boolean) => {
    const d = dragRef.current;
    dragRef.current = null;
    setDrag(null);
    if (!d || cancelled) return;

    if (d.over != null) {
      const over = d.over;
      const a = stateRef.current.players[d.slot];
      const b = stateRef.current.players[over];
      apply((s) => swapPlayers(s, d.slot, over));
      haptic([10, 40, 14]);
      const benchMove = d.kind === 'bench' || over >= stateRef.current.size;
      const incoming = d.kind === 'bench' ? a : b;
      const outgoing = d.kind === 'bench' ? b : a;
      notify(
        benchMove
          ? `${incoming.name || 'Yedek'} oyuna girdi, ${outgoing.name || 'oyuncu'} yedeğe geçti`
          : `${a.name || 'Oyuncu'} ↔ ${b.name || 'Oyuncu'} yer değiştirdi`,
        { icon: <ArrowLeftRight size={16} className="text-lime" />, action: { label: 'Geri al', run: undo } },
      );
      return;
    }
    if (d.kind === 'pitch' && d.x != null && d.y != null) {
      const target = d.snap && d.base ? d.base : { x: d.x, y: d.y };
      apply((s) => movePlayer(s, d.slot, target.x, target.y));
      haptic(d.snap ? [6, 30, 6] : 6);
    }
  };

  /* ---------- fotoğraf ---------- */
  const pickImage = (id: number) => {
    pickingFor.current = id;
    fileRef.current?.click();
  };

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    const id = pickingFor.current;
    if (!file || id == null) return;
    try {
      const image = await resizeImage(file);
      setState((s) => updatePlayer(s, id, { image }));
    } catch (err) {
      notify((err as Error).message);
    }
  };

  /* ---------- dışa aktarma ---------- */
  const renderImage = useCallback(async () => {
    // Fontların ve resimlerin yüklenmesini bekle, yoksa ilk görüntü eksik çıkabiliyor.
    await document.fonts?.ready;
    if (!cardRef.current) throw new Error('Önizleme bulunamadı');
    const blob = await toBlob(cardRef.current, {
      pixelRatio: 3,
      cacheBust: true,
      // kartın sayfadaki dış boşluğu görüntüye girmesin (yoksa görüntü kayıyor)
      style: { margin: '0' },
      filter: (node) => !(node as HTMLElement).classList?.contains('export-hide'),
    });
    if (!blob) throw new Error('Görüntü oluşturulamadı');
    return blob;
  }, []);

  const fileName = () =>
    `${(state.teamName || 'halisaha').toLocaleLowerCase('tr').replace(/[^a-z0-9ğüşöçı]+/gi, '-')}-kadro.png`;

  const saveBlob = (blob: Blob) => {
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement('a'), { href: url, download: fileName() });
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const download = async () => {
    setBusy('download');
    try {
      saveBlob(await renderImage());
      notify('Görüntü indirildi', { icon: <Download size={16} className="text-lime" /> });
    } catch {
      notify('Görüntü oluşturulamadı, tekrar dene.');
    } finally {
      setBusy(null);
    }
  };

  const share = async () => {
    setBusy('share');
    try {
      const blob = await renderImage();
      const file = new File([blob], fileName(), { type: 'image/png' });
      const text = [state.teamName, state.match.place, state.match.time].filter(Boolean).join(' · ');
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: state.teamName, text });
      } else {
        saveBlob(blob);
        notify('Bu tarayıcı doğrudan paylaşmayı desteklemiyor; görüntü indirildi.');
      }
    } catch (err) {
      if ((err as Error)?.name !== 'AbortError') notify('Paylaşılamadı, görüntüyü indirip gönderebilirsin.');
    } finally {
      setBusy(null);
    }
  };

  /* ---------- diğer ---------- */
  const resetAll = () => {
    if (window.confirm('Tüm kadro, fotoğraflar ve konumlar sıfırlansın mı?')) {
      past.current = [];
      setCanUndo(false);
      setState(defaultState());
      setSettingsOpen(false);
    }
  };
  const setMatch = (patch: Partial<AppState['match']>) => setState((s) => ({ ...s, match: { ...s.match, ...patch } }));
  const toggleCaptain = (id: number) => setState((s) => ({ ...s, captain: s.captain === id ? null : id }));
  const rename = (id: number, name: string) => setState((s) => updatePlayer(s, id, { name }));

  const editingPlayer = editing != null ? state.players[editing] : null;
  const editingRole: Role | 'YDK' = editing != null ? (editing < state.size ? positions[editing].role : 'YDK') : 'YDK';
  const moved = Object.keys(state.overrides[formationKey(state.size, state.formation)] || {}).length > 0;

  const card = (
    <ShareCard ref={cardRef} state={state} kit={kit} slots={positions} lineup={lineup} />
  );
  const shareButtons = (
    <div className="flex gap-2">
      <PrimaryButton onClick={share} disabled={!!busy} className="flex-1">
        {busy === 'share' ? <Loader2 size={18} className="animate-spin" /> : <Share2 size={18} strokeWidth={2.4} />}
        Gruba gönder
      </PrimaryButton>
      <SecondaryButton onClick={download} disabled={!!busy} label="PNG indir">
        {busy === 'download' ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}
        PNG
      </SecondaryButton>
    </div>
  );

  return (
    <div className="min-h-screen pb-28 lg:pb-12">
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFile} />

      <div className="mx-auto grid max-w-6xl gap-10 px-4 lg:grid-cols-[minmax(0,440px)_minmax(0,1fr)] lg:px-8">
        {/* Düzenleyici */}
        <main className="mx-auto w-full max-w-[440px]">
          <header className="flex items-center justify-between gap-3 pb-3 pt-5">
            <div className="flex min-w-0 items-center gap-3">
              <span
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] font-display text-[15px] font-bold"
                style={{ background: kit.color, color: kit.ink }}
              >
                {initials(state.teamName) || 'T'}
              </span>
              <div className="min-w-0">
                <div className="text-xs font-medium text-muted">Takımın</div>
                <h1 className="truncate text-lg font-bold tracking-[-0.01em]">{state.teamName || 'Takımım'}</h1>
              </div>
            </div>
            <IconButton label="Takım ve maç ayarları" onClick={() => setSettingsOpen(true)}>
              <Settings size={19} />
            </IconButton>
          </header>

          <div className="space-y-3">
            <Segmented
              label="Oyuncu sayısı"
              value={state.size}
              onChange={(n) => apply((s) => setSize(s, n))}
              options={SIZES.map((n) => ({ value: n, label: `${n}'li` }))}
            />
            <FormationPicker
              formations={TEAM_SIZES[state.size]}
              value={state.formation}
              onChange={(f) => apply((s) => setFormation(s, f))}
            />
          </div>

          <div className="mt-3">
            <HalfPitch ref={fieldRef} overlay={<DragGuides drag={drag} />}>
              {lineup.map((p, i) => (
                <PlayerToken
                  key={p.id}
                  player={p}
                  slot={i}
                  order={i}
                  position={positions[i]}
                  role={positions[i].role}
                  kit={i === 0 ? GK_KIT : kit}
                  captain={state.captain === p.id}
                  showName={state.showNames}
                  dragging={drag?.kind === 'pitch' && drag.slot === i}
                  dragPos={drag?.kind === 'pitch' && drag.slot === i && drag.x != null && drag.y != null ? { x: drag.x, y: drag.y } : null}
                  isTarget={drag?.over === i}
                  onDragStart={startDrag('pitch')}
                  onDragMove={moveDrag}
                  onDragEnd={endDrag}
                  onTap={setEditing}
                  onNudge={(slot, x, y) => apply((s) => movePlayer(s, slot, x, y))}
                />
              ))}
            </HalfPitch>
          </div>

          <div className="mt-3 flex items-center gap-2">
            <IconButton label="Geri al (Ctrl+Z)" onClick={undo} disabled={!canUndo}>
              <Undo2 size={18} />
            </IconButton>
            <IconButton label="Konumları sıfırla" onClick={() => apply(resetPositions)} disabled={!moved}>
              <RotateCcw size={17} />
            </IconButton>
            <p className="ml-1 text-[12px] leading-snug text-muted">
              <b className="font-semibold text-ink">Sürükle</b> taşı · <b className="font-semibold text-ink">üstüne bırak</b> yer değiştir ·{' '}
              <b className="font-semibold text-ink">dokun</b> düzenle
            </p>
          </div>

          <div className="mt-5">
            <Bench
              players={bench}
              startIndex={state.size}
              kit={kit}
              targetSlot={drag?.over}
              draggingSlot={drag?.kind === 'bench' ? drag.slot : null}
              onDragStart={startDrag('bench')}
              onDragMove={moveDrag}
              onDragEnd={endDrag}
              onTap={setEditing}
            />
          </div>
        </main>

        {/* Masaüstü: canlı önizleme */}
        {isDesktop && (
          <aside className="sticky top-6 hidden self-start pt-5 lg:block">
            <div className="mx-auto max-w-[420px] space-y-4">
              <h2 className="text-[13px] font-semibold text-muted">Önizleme · gruba giden görüntü</h2>
              {card}
              {shareButtons}
            </div>
          </aside>
        )}
      </div>

      {/* Mobil: alt çubuk */}
      {!isDesktop && (
        <div className="fixed inset-x-0 bottom-0 z-50 border-t border-line bg-bg/95 px-4 pb-[max(0.875rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur">
          <div className="mx-auto max-w-[440px]">
            <PrimaryButton onClick={() => setPreviewOpen(true)} className="w-full">
              <Eye size={19} /> Önizle ve paylaş
            </PrimaryButton>
          </div>
        </div>
      )}

      {!isDesktop && (
        <Sheet open={previewOpen} onClose={() => setPreviewOpen(false)} label="Önizle ve paylaş" wide>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">Gruba giden görüntü</h2>
              <button onClick={() => setPreviewOpen(false)} aria-label="Kapat" className="flex h-11 w-11 items-center justify-center rounded-[14px] text-muted hover:bg-bg">
                <X size={20} />
              </button>
            </div>
            {card}
            {shareButtons}
          </div>
        </Sheet>
      )}

      <Sheet open={settingsOpen} onClose={() => setSettingsOpen(false)} label="Takım ve maç">
        <div className="space-y-5">
          <h2 className="text-lg font-bold">Takım ve maç</h2>
          <TextField label="Takım adı" value={state.teamName} maxLength={24} onChange={(v) => setState((s) => ({ ...s, teamName: v }))} />
          <div className="space-y-2">
            <span className="block text-[13px] font-semibold text-muted">Forma rengi · kaleci her zaman sarı</span>
            <KitSwatches kits={KITS} value={state.kit} onChange={(k) => setState((s) => ({ ...s, kit: k }))} />
          </div>
          <TextField label="Saha" placeholder="Örn. Yıldız Halı Saha" value={state.match.place} onChange={(v) => setMatch({ place: v })} icon={<MapPin size={17} />} />
          <TextField label="Gün / saat" placeholder="Örn. Perşembe 21:00" value={state.match.time} onChange={(v) => setMatch({ time: v })} icon={<CalendarClock size={17} />} />
          <Switch checked={state.showNames} onChange={(v) => setState((s) => ({ ...s, showNames: v }))} label="Sahada isimleri göster" />
          <PrimaryButton onClick={() => setSettingsOpen(false)} className="w-full">Tamam</PrimaryButton>
          <button onClick={resetAll} className="flex min-h-[44px] items-center gap-2 text-sm font-medium text-muted transition hover:text-[#B42318]">
            <Trash2 size={15} /> Her şeyi sıfırla
          </button>
        </div>
      </Sheet>

      <Sheet open={!!editingPlayer} onClose={() => setEditing(null)} label="Oyuncuyu düzenle">
        {editingPlayer && (
          <PlayerEditor
            player={editingPlayer}
            role={editingRole}
            kit={editing === 0 ? GK_KIT : kit}
            captain={state.captain === editingPlayer.id}
            onRename={(v) => rename(editingPlayer.id, v)}
            onPick={() => pickImage(editingPlayer.id)}
            onClear={() => setState((s) => updatePlayer(s, editingPlayer.id, { image: null }))}
            onCaptain={() => toggleCaptain(editingPlayer.id)}
            onClose={() => setEditing(null)}
          />
        )}
      </Sheet>

      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}

/** Gruba gönderilen kart: üstte takım bilgisi, ortada perspektifli saha. Dışa aktarılan düğüm budur. */
const ShareCard = forwardRef<HTMLDivElement, { state: AppState; kit: Kit; slots: Slot[]; lineup: Player[] }>(
  function ShareCard({ state, kit, slots, lineup }, ref) {
    const { match } = state;
    return (
      <div ref={ref} className="overflow-hidden rounded-[26px] bg-pitch text-white shadow-[0_30px_60px_-30px_rgba(15,23,18,0.6)]">
        <div className="flex items-center justify-between gap-3 px-5 pb-4 pt-5" style={{ background: 'linear-gradient(180deg, #0B140F, #0B140F)' }}>
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] font-display text-[15px] font-bold" style={{ background: kit.color, color: kit.ink }}>
              {initials(state.teamName) || 'T'}
            </span>
            <div className="min-w-0">
              <div className="truncate text-lg font-bold leading-tight">{state.teamName || 'Takımım'}</div>
              <div className="truncate text-[13px] text-white/65">
                {[match.time, match.place].filter(Boolean).join(' · ') || `${state.size}'li kadro`}
              </div>
            </div>
          </div>
          <div className="shrink-0 text-right">
            <div className="text-[11px] font-semibold text-white/50">{state.size}&apos;li</div>
            <div className="font-display text-xl font-bold leading-none text-lime">{state.formation}</div>
          </div>
        </div>
        <PerspectivePitch
          view="half"
          showNames={state.showNames}
          teams={[{ side: 'home', kit, players: lineup, slots, captainId: state.captain }]}
        />
        <div className="flex items-center justify-between bg-[#0E2318] px-5 py-3 text-[11px] font-medium text-white/50">
          <span>halısaha diziliş</span>
          <span className="h-1.5 w-1.5 rounded-full bg-lime" />
        </div>
      </div>
    );
  },
);

interface EditorProps {
  player: Player;
  role: Role | 'YDK';
  kit: Kit;
  captain: boolean;
  onRename: (v: string) => void;
  onPick: () => void;
  onClear: () => void;
  onCaptain: () => void;
  onClose: () => void;
}

function PlayerEditor({ player, role, kit, captain, onRename, onPick, onClear, onCaptain, onClose }: EditorProps) {
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-4">
        <button onClick={onPick} className="group relative shrink-0 rounded-full transition active:scale-95" title="Fotoğraf seç">
          <Avatar player={player} kit={kit} className="h-20 w-20 text-2xl" />
          <span className="absolute inset-0 flex items-center justify-center rounded-full bg-ink/50 text-white opacity-0 transition group-hover:opacity-100">
            <Camera size={22} />
          </span>
        </button>
        <div className="min-w-0">
          <div className="font-display text-xs font-bold text-muted">{role === 'YDK' ? 'YEDEK' : role}</div>
          <div className="truncate text-xl font-bold tracking-tight">{player.name || 'İsimsiz'}</div>
        </div>
      </div>

      <TextField label="İsim" value={player.name} onChange={onRename} maxLength={18} onEnter={onClose} />

      <div className="grid grid-cols-2 gap-2">
        <SecondaryButton onClick={onPick} className="h-12 text-[15px]">
          <ImagePlus size={17} /> {player.image ? 'Değiştir' : 'Fotoğraf ekle'}
        </SecondaryButton>
        {player.image ? (
          <SecondaryButton onClick={onClear} className="h-12 text-[15px] text-[#B42318]">
            <X size={17} /> Kaldır
          </SecondaryButton>
        ) : (
          <div />
        )}
      </div>

      {role !== 'YDK' && (
        <Switch
          checked={captain}
          onChange={onCaptain}
          label={
            <span className="flex items-center gap-2">
              <Crown size={17} /> Kaptan
            </span>
          }
        />
      )}

      <PrimaryButton onClick={onClose} className="w-full">Tamam</PrimaryButton>
    </div>
  );
}
