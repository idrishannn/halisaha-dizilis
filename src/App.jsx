import { Component, Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
import { toBlob } from 'html-to-image';
import {
  ArrowLeftRight, Box, CalendarClock, Camera, Crown, Download, Hand, ImagePlus, LayoutGrid, Square,
  Loader2, MapPin, RotateCcw, Share2, Shirt, Tag, Trash2, Trophy, Undo2, Users, X,
} from 'lucide-react';
import Pitch, { DragGuides, PlayerToken, Ripples, initials } from './components/Pitch.jsx';
import Bench from './components/Bench.jsx';
import FormationPicker from './components/FormationPicker.jsx';
import { Card, IconButton, KitSwatches, Segmented, Sheet, Switch, TextField, Toast } from './components/ui.jsx';
import { haptic } from './hooks/usePointerDrag.js';
import { TEAM_SIZES } from './formations.js';
import { GK_KIT, KITS, kitFor } from './kits.js';
import { resizeImage } from './image.js';
import {
  defaultState, loadState, movePlayer, positionsFor, resetPositions,
  saveState, setFormation, setSize, swapPlayers, updatePlayer,
} from './state.js';

// three.js yalnızca 3D görünüm açılınca indirilir
const Pitch3D = lazy(() => import('./components/Pitch3D.jsx'));

const storage = (() => {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
})();
const HINT_KEY = 'halisaha_hint_seen';

const SWAP_RADIUS = 9; // saha genişliğinin yüzdesi: bu kadar yakına bırakılırsa yer değiştirir
const SNAP_RADIUS = 4; // dizilişin varsayılan noktasına bu kadar yaklaşınca mıknatıs gibi oturur

export default function App() {
  const [state, setState] = useState(() => (storage ? loadState(storage) : defaultState()));
  const [toast, setToast] = useState(null);
  const [busy, setBusy] = useState(null); // 'share' | 'download'
  const [tab, setTab] = useState('dizilis');
  const [drag, setDrag] = useState(null);
  const [ripples, setRipples] = useState([]);
  const [editing, setEditing] = useState(null); // düzenlenen oyuncunun kadro sırası
  const [canUndo, setCanUndo] = useState(false);
  const [hint, setHint] = useState(() => {
    try { return !storage?.getItem(HINT_KEY); } catch { return false; }
  });

  const pitchRef = useRef(null);
  const fieldRef = useRef(null);
  const fileRef = useRef(null);
  const pickingFor = useRef(null);
  const stateRef = useRef(state);
  const dragRef = useRef(null);
  const past = useRef([]);
  stateRef.current = state;
  dragRef.current = drag;

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

  const notify = (text, extra = {}) => setToast({ id: Date.now(), text, ...extra });

  const kit = kitFor(state.kit);
  const positions = positionsFor(state);
  const basePositions = TEAM_SIZES[state.size][state.formation];
  const lineup = state.players.slice(0, state.size);
  const bench = state.players.slice(state.size);

  /* ---------- geri alınabilir değişiklikler ---------- */
  const apply = (fn) => {
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
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey && !/INPUT|TEXTAREA/.test(e.target.tagName)) {
        e.preventDefault();
        undo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo]);

  /* ---------- sürükle-bırak ---------- */
  const addRipple = (x, y) => {
    const id = Math.random();
    setRipples((r) => [...r, { id, x, y }]);
    setTimeout(() => setRipples((r) => r.filter((i) => i.id !== id)), 700);
  };

  const dismissHint = () => {
    if (!hint) return;
    setHint(false);
    try { storage?.setItem(HINT_KEY, '1'); } catch { /* yoksay */ }
  };

  const startDrag = (kind) => (slot) => {
    dismissHint();
    haptic(8);
    if (kind === 'pitch') {
      const origin = positions[slot];
      setDrag({ kind, slot, x: origin.x, y: origin.y, origin, base: basePositions[slot], over: null, snap: false });
    } else {
      setDrag({ kind, slot, over: null });
    }
  };

  const moveDrag = (cx, cy) => {
    const rect = fieldRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = ((cx - rect.left) / rect.width) * 100;
    const y = ((cy - rect.top) / rect.height) * 100;
    updateDrag(x, y, cx, cy, y > 100 || x < 0 || x > 100);
  };

  // x, y: saha yüzdesi; outside: işaretçi sahanın dışında mı (yedek kulübesine bırakma için)
  const updateDrag = (x, y, cx, cy, outside) => {
    const d = dragRef.current;
    if (!d) return;

    let over = null;
    let best = SWAP_RADIUS;
    positions.forEach((p, j) => {
      if (j === d.slot) return;
      const dist = Math.hypot(x - p.x, (y - p.y) * 1.5);
      if (dist < best) { best = dist; over = j; }
    });
    if (over == null && d.kind === 'pitch' && outside) {
      const hit = document.elementsFromPoint(cx, cy).find((el) => el.dataset?.benchSlot != null);
      if (hit) over = Number(hit.dataset.benchSlot);
    }
    const snap = d.kind === 'pitch' && over == null && Math.hypot(x - d.base.x, (y - d.base.y) * 1.5) < SNAP_RADIUS;
    if ((over != null && over !== d.over) || (snap && !d.snap)) haptic(4);

    const next = { ...d, x, y, over, snap };
    dragRef.current = next;
    setDrag(next);
  };

  const endDrag = (cancelled) => {
    const d = dragRef.current;
    dragRef.current = null;
    setDrag(null);
    if (!d || cancelled) return;

    if (d.over != null) {
      const a = stateRef.current.players[d.slot];
      const b = stateRef.current.players[d.over];
      apply((s) => swapPlayers(s, d.slot, d.over));
      const spot = positions[d.over] || positions[d.slot];
      addRipple(spot.x, spot.y);
      haptic([10, 40, 14]);
      const benchMove = d.kind === 'bench' || d.over >= stateRef.current.size;
      notify(
        benchMove
          ? `${(d.kind === 'bench' ? a : b).name || 'Yedek'} oyuna girdi, ${(d.kind === 'bench' ? b : a).name || 'oyuncu'} kenara geçti`
          : `${a.name || 'Oyuncu'} ↔ ${b.name || 'Oyuncu'} yer değiştirdi`,
        { icon: <ArrowLeftRight size={16} style={{ color: 'var(--accent)' }} />, action: { label: 'Geri al', run: undo } },
      );
      return;
    }
    if (d.kind === 'pitch') {
      const target = d.snap ? d.base : { x: d.x, y: d.y };
      apply((s) => movePlayer(s, d.slot, target.x, target.y));
      addRipple(Math.min(96, Math.max(4, target.x)), Math.min(96, Math.max(4, target.y)));
      haptic(d.snap ? [6, 30, 6] : 6);
    }
  };

  /* ---------- fotoğraf ---------- */
  const pickImage = (id) => {
    pickingFor.current = id;
    fileRef.current?.click();
  };

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || pickingFor.current == null) return;
    try {
      const image = await resizeImage(file);
      setState((s) => updatePlayer(s, pickingFor.current, { image }));
    } catch (err) {
      notify(err.message);
    }
  };

  /* ---------- dışa aktarma ---------- */
  const renderImage = useCallback(async () => {
    // Fontların ve resimlerin yüklenmesini bekle, yoksa ilk görüntü eksik çıkabiliyor.
    await document.fonts?.ready;
    return toBlob(pitchRef.current, {
      pixelRatio: 2,
      cacheBust: true,
      filter: (node) => !node.classList?.contains('export-hide'),
    });
  }, []);

  const fileName = () =>
    `${(state.match.title || 'halisaha').toLowerCase().replace(/[^a-z0-9ğüşöçı]+/gi, '-')}-dizilis.png`;

  const saveBlob = (blob) => {
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement('a'), { href: url, download: fileName() });
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const download = async () => {
    setBusy('download');
    try {
      saveBlob(await renderImage());
      notify('Görüntü indirildi', { icon: <Download size={16} style={{ color: 'var(--accent)' }} /> });
    } catch {
      notify('Görüntü oluşturulamadı, tekrar dene.');
    } finally {
      setBusy(null);
    }
  };

  const shareText = () => [state.match.title, state.match.place, state.match.time].filter(Boolean).join(' · ');

  const share = async () => {
    setBusy('share');
    try {
      const blob = await renderImage();
      const file = new File([blob], fileName(), { type: 'image/png' });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: state.match.title, text: shareText() });
      } else {
        saveBlob(blob);
        notify('Bu tarayıcı doğrudan paylaşmayı desteklemiyor; görüntü indirildi.');
      }
    } catch (err) {
      if (err?.name !== 'AbortError') notify('Paylaşılamadı, görüntüyü indirip gönderebilirsin.');
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
    }
  };
  const setMatch = (patch) => setState((s) => ({ ...s, match: { ...s.match, ...patch } }));
  const toggleCaptain = (id) => setState((s) => ({ ...s, captain: s.captain === id ? null : id }));
  const rename = (id, name) => setState((s) => updatePlayer(s, id, { name }));

  const editingPlayer = editing != null ? state.players[editing] : null;
  const editingRole = editing != null ? (editing < state.size ? positions[editing].role : 'YDK') : '';
  const is3d = state.view === '3d';
  const setView = (view) => setState((s) => ({ ...s, view }));
  const moved = Object.keys(state.overrides[`${state.size}:${state.formation}`] || {}).length > 0;

  const actions = (
    <>
      <button
        onClick={share}
        disabled={!!busy}
        className="group relative flex h-12 flex-1 items-center justify-center gap-2 overflow-hidden rounded-2xl px-5 text-[15px] font-bold transition duration-300 ease-spring hover:scale-[1.02] active:scale-[0.97] disabled:opacity-70"
        style={{ background: 'var(--accent)', color: 'var(--accent-ink)', boxShadow: '0 10px 30px -10px rgb(198 244 50 / 0.6), inset 0 1px 0 rgba(255,255,255,0.5)' }}
      >
        <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/40 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
        {busy === 'share' ? <Loader2 size={18} className="animate-spin" /> : <Share2 size={18} strokeWidth={2.4} />}
        Gruba gönder
      </button>
      <button
        onClick={download}
        disabled={!!busy}
        aria-label="PNG indir"
        className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-white/[0.08] px-4 text-[15px] font-semibold ring-1 ring-inset ring-white/10 transition hover:bg-white/[0.14] active:scale-[0.97] disabled:opacity-70"
      >
        {busy === 'download' ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}
        <span className="hidden sm:inline">PNG</span>
      </button>
    </>
  );

  return (
    <div className="app-bg grain min-h-screen pb-28 lg:pb-10">
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFile} />

      {/* Üst çubuk */}
      <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-ink-950/70 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 lg:px-8">
          <div className="flex items-center gap-3">
            <Logo />
            <div className="leading-tight">
              <h1 className="text-[17px] font-extrabold tracking-[-0.02em]">Halı Saha Diziliş</h1>
              <p className="hidden text-xs text-zinc-500 sm:block">Kadronu kur, görüntüyü gruba at.</p>
            </div>
          </div>
          <div className="hidden w-[300px] gap-2 lg:flex">{actions}</div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-6 px-4 pt-5 lg:grid-cols-[minmax(0,1fr)_400px] lg:gap-10 lg:px-8 lg:pt-8">
        {/* Saha */}
        <main className="flex flex-col items-center">
          <div className="w-full max-w-[480px] lg:max-w-[min(100%,calc((100dvh-12rem)*0.56))] lg:min-w-[340px]">
            <Pitch
              ref={pitchRef}
              fieldRef={fieldRef}
              match={state.match}
              meta={{ size: state.size, formation: state.formation }}
              kit={kit}
              flat={!is3d}
              overlay={
                is3d ? null : (
                  <>
                    <Ripples items={ripples} />
                    <DragGuides drag={drag} kit={kit} />
                    {hint && <DragHint />}
                  </>
                )
              }
            >
              {is3d && (
                <ThreeBoundary onError={() => { setView('2d'); notify('Bu cihaz 3D görünümü desteklemiyor; 2D görünüme dönüldü.'); }}>
                  <Suspense fallback={<Loading3D />}>
                    <Pitch3D
                      lineup={lineup}
                      positions={positions}
                      kit={kit}
                      gkKit={GK_KIT}
                      captainId={state.captain}
                      showNames={state.showNames}
                      drag={drag}
                      handlers={{
                        onDragStart: startDrag('pitch'),
                        onDragMove: updateDrag,
                        onDragEnd: endDrag,
                        onTap: setEditing,
                      }}
                    />
                  </Suspense>
                </ThreeBoundary>
              )}
              {!is3d && lineup.map((p, i) => (
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
                  dragPos={drag?.kind === 'pitch' && drag.slot === i ? drag : null}
                  isTarget={drag?.over === i}
                  anyDragging={!!drag}
                  onDragStart={startDrag('pitch')}
                  onDragMove={moveDrag}
                  onDragEnd={endDrag}
                  onTap={setEditing}
                  onNudge={(slot, x, y) => apply((s) => movePlayer(s, slot, x, y))}
                />
              ))}
            </Pitch>

            {/* Saha araç çubuğu */}
            <div className="mt-3 flex items-center justify-between gap-2">
              <div className="glass flex items-center gap-0.5 rounded-2xl p-1">
                <IconButton label="2D görünüm" active={!is3d} onClick={() => setView('2d')}>
                  <Square size={15} /> <span className="text-xs font-bold">2D</span>
                </IconButton>
                <IconButton label="3D görünüm" active={is3d} onClick={() => { dismissHint(); setView('3d'); }}>
                  <Box size={16} /> <span className="text-xs font-bold">3D</span>
                </IconButton>
                <span className="mx-1 h-5 w-px bg-white/10" />
                <IconButton label="Geri al (Ctrl+Z)" onClick={undo} disabled={!canUndo}>
                  <Undo2 size={17} />
                </IconButton>
                <IconButton label="Konumları sıfırla" onClick={() => apply(resetPositions)} disabled={!moved}>
                  <RotateCcw size={16} />
                </IconButton>
                <span className="mx-1 h-5 w-px bg-white/10" />
                <IconButton
                  label="İsimleri göster"
                  active={state.showNames}
                  onClick={() => setState((s) => ({ ...s, showNames: !s.showNames }))}
                >
                  <Tag size={16} />
                </IconButton>
              </div>
              <p className="hidden text-right text-[11px] leading-snug text-zinc-500 sm:block">
                <span className="text-zinc-300">Sürükle</span> taşı · <span className="text-zinc-300">üstüne bırak</span> değiştir
                <br />
                <span className="text-zinc-300">Dokun</span> düzenle
              </p>
            </div>

            <div className="mt-3">
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
          </div>
        </main>

        {/* Kontrol paneli */}
        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <Segmented
            size="lg"
            value={tab}
            onChange={setTab}
            options={[
              { value: 'dizilis', label: 'Diziliş', icon: <LayoutGrid size={15} /> },
              { value: 'kadro', label: 'Kadro', icon: <Users size={15} /> },
              { value: 'mac', label: 'Maç', icon: <Trophy size={15} /> },
            ]}
          />

          <div key={tab} className="animate-fade-up space-y-4">
            {tab === 'dizilis' && (
              <>
                <Card title="Oyuncu sayısı">
                  <Segmented
                    value={state.size}
                    onChange={(n) => apply((s) => setSize(s, n))}
                    options={Object.keys(TEAM_SIZES).map((n) => ({ value: Number(n), label: `${n}'li` }))}
                  />
                </Card>
                <Card title="Diziliş" action={<span className="font-mono text-xs text-zinc-500">{state.size}v{state.size}</span>}>
                  <FormationPicker
                    formations={TEAM_SIZES[state.size]}
                    value={state.formation}
                    onChange={(f) => apply((s) => setFormation(s, f))}
                  />
                </Card>
                <Card title="Forma" action={<span className="text-xs text-zinc-500">{kit.name}</span>}>
                  <KitSwatches kits={KITS} value={state.kit} onChange={(k) => setState((s) => ({ ...s, kit: k }))} />
                  <p className="flex items-center gap-1.5 text-xs text-zinc-500">
                    <Shirt size={13} /> Kaleci her zaman sarı giyer.
                  </p>
                </Card>
              </>
            )}

            {tab === 'kadro' && (
              <Card title={`İlk ${state.size}`} action={<span className="text-xs text-zinc-500">Kaptan için ♛</span>}>
                <ul className="space-y-1.5">
                  {lineup.map((p, i) => (
                    <RosterRow
                      key={p.id}
                      player={p}
                      role={positions[i].role}
                      kit={i === 0 ? GK_KIT : kit}
                      captain={state.captain === p.id}
                      onRename={(v) => rename(p.id, v)}
                      onPick={() => pickImage(p.id)}
                      onClear={() => setState((s) => updatePlayer(s, p.id, { image: null }))}
                      onCaptain={() => toggleCaptain(p.id)}
                    />
                  ))}
                </ul>
                {bench.length > 0 && (
                  <>
                    <div className="pt-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">Yedekler</div>
                    <ul className="space-y-1.5 opacity-80">
                      {bench.map((p) => (
                        <RosterRow
                          key={p.id}
                          player={p}
                          role="YDK"
                          kit={kit}
                          onRename={(v) => rename(p.id, v)}
                          onPick={() => pickImage(p.id)}
                          onClear={() => setState((s) => updatePlayer(s, p.id, { image: null }))}
                        />
                      ))}
                    </ul>
                  </>
                )}
              </Card>
            )}

            {tab === 'mac' && (
              <Card title="Maç bilgisi">
                <TextField label="Başlık" value={state.match.title} onChange={(v) => setMatch({ title: v })} icon={<Trophy size={15} />} />
                <TextField label="Saha" placeholder="Örn. Yıldız Halı Saha" value={state.match.place} onChange={(v) => setMatch({ place: v })} icon={<MapPin size={15} />} />
                <TextField label="Gün / saat" placeholder="Örn. Perşembe 21:00" value={state.match.time} onChange={(v) => setMatch({ time: v })} icon={<CalendarClock size={15} />} />
              </Card>
            )}
          </div>

          <button onClick={resetAll} className="flex items-center gap-2 px-1 text-xs text-zinc-500 transition hover:text-rose-400">
            <Trash2 size={13} /> Her şeyi sıfırla
          </button>
        </aside>
      </div>

      {/* Mobil alt aksiyon çubuğu */}
      <div className="fixed inset-x-0 bottom-0 z-50 border-t border-white/[0.06] bg-ink-950/80 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur-xl lg:hidden">
        <div className="mx-auto flex max-w-[480px] gap-2">{actions}</div>
      </div>

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

/** WebGL açılamazsa (eski cihaz, kapalı donanım hızlandırma) 2D'ye geri döner. */
class ThreeBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onError?.(); }
  render() { return this.state.failed ? null : this.props.children; }
}

function Loading3D() {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-ink-900 text-sm text-white/70">
      <Loader2 className="animate-spin" style={{ color: 'var(--accent)' }} />
      3D saha hazırlanıyor…
    </div>
  );
}

function Logo() {
  return (
    <span
      className="relative flex h-10 w-10 items-center justify-center rounded-xl shadow-[0_8px_24px_-8px_rgb(198_244_50/0.7)]"
      style={{ background: 'var(--accent)' }}
    >
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="#0b0f02" strokeWidth="2" aria-hidden="true">
        <rect x="4" y="2.5" width="16" height="19" rx="2" />
        <line x1="4" y1="12" x2="20" y2="12" />
        <circle cx="12" cy="12" r="3" />
        <path d="M8.5 2.5v3h7v-3M8.5 21.5v-3h7v3" />
      </svg>
    </span>
  );
}

function DragHint() {
  return (
    <div className="export-hide pointer-events-none absolute inset-x-0 bottom-[30%] z-40 flex justify-center">
      <div className="animate-fade-up flex items-center gap-2 rounded-full bg-black/70 px-3.5 py-2 text-[3.2cqw] font-medium text-white shadow-xl ring-1 ring-white/15">
        <Hand className="h-[4cqw] w-[4cqw] animate-bounce" style={{ color: 'var(--accent)' }} />
        Oyuncuyu tut ve sürükle
      </div>
    </div>
  );
}

function Avatar({ player, kit, size = 'h-10 w-10', text = 'text-xs' }) {
  return (
    <span
      className={`flex ${size} shrink-0 items-center justify-center overflow-hidden rounded-full font-extrabold ring-2 ring-white/80 ${text}`}
      style={{ background: `radial-gradient(circle at 30% 25%, ${kit.a}, ${kit.b} 75%)`, color: kit.ink }}
    >
      {player.image ? <img src={player.image} alt="" className="h-full w-full object-cover" /> : initials(player.name) || '?'}
    </span>
  );
}

function RosterRow({ player, role, kit, captain, onRename, onPick, onClear, onCaptain }) {
  return (
    <li className="group flex items-center gap-2.5 rounded-xl p-1 transition hover:bg-white/[0.03]">
      <span className="w-9 shrink-0 rounded-md bg-white/[0.06] py-1 text-center font-mono text-[10px] font-bold text-zinc-400">{role}</span>
      <button onClick={onPick} className="relative shrink-0 rounded-full transition active:scale-90" title="Fotoğraf seç">
        <Avatar player={player} kit={kit} size="h-9 w-9" text="text-[11px]" />
        {!player.image && (
          <span className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-white text-zinc-800">
            <ImagePlus size={10} strokeWidth={2.6} />
          </span>
        )}
      </button>
      <input
        value={player.name}
        onChange={(e) => onRename(e.target.value)}
        maxLength={18}
        aria-label={`${role} adı`}
        className="min-w-0 flex-1 rounded-lg bg-transparent px-2 py-2 text-sm text-white outline-none ring-1 ring-inset ring-transparent transition hover:ring-white/10 focus:bg-black/30 focus:ring-[color:var(--accent)]"
      />
      {player.image && (
        <button onClick={onClear} className="rounded-lg p-1.5 text-zinc-600 transition hover:bg-white/10 hover:text-rose-400" title="Fotoğrafı kaldır">
          <X size={15} />
        </button>
      )}
      {onCaptain && (
        <button
          onClick={onCaptain}
          title={captain ? 'Kaptanlığı kaldır' : 'Kaptan yap'}
          className={`rounded-lg p-1.5 transition hover:bg-white/10 ${captain ? '' : 'text-zinc-600 hover:text-zinc-300'}`}
          style={captain ? { color: 'var(--accent)' } : undefined}
        >
          <Crown size={15} fill={captain ? 'currentColor' : 'none'} />
        </button>
      )}
    </li>
  );
}

function PlayerEditor({ player, role, kit, captain, onRename, onPick, onClear, onCaptain, onClose }) {
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-4">
        <button onClick={onPick} className="group relative shrink-0 rounded-full transition active:scale-95" title="Fotoğraf seç">
          <Avatar player={player} kit={kit} size="h-20 w-20" text="text-2xl" />
          <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 opacity-0 transition group-hover:opacity-100">
            <Camera size={22} />
          </span>
        </button>
        <div className="min-w-0">
          <div className="font-mono text-xs font-bold text-zinc-500">{role === 'YDK' ? 'YEDEK' : role}</div>
          <div className="truncate text-xl font-extrabold tracking-tight">{player.name || 'İsimsiz'}</div>
        </div>
      </div>

      <TextField label="İsim" value={player.name} onChange={onRename} maxLength={18} onEnter={onClose} />

      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={onPick}
          className="flex h-11 items-center justify-center gap-2 rounded-xl bg-white/[0.08] text-sm font-semibold ring-1 ring-inset ring-white/10 transition hover:bg-white/[0.14] active:scale-[0.97]"
        >
          <ImagePlus size={16} /> {player.image ? 'Değiştir' : 'Fotoğraf ekle'}
        </button>
        {player.image ? (
          <button
            onClick={onClear}
            className="flex h-11 items-center justify-center gap-2 rounded-xl bg-white/[0.04] text-sm font-semibold text-rose-300 ring-1 ring-inset ring-white/10 transition hover:bg-rose-500/10 active:scale-[0.97]"
          >
            <X size={16} /> Fotoğrafı kaldır
          </button>
        ) : (
          <div />
        )}
      </div>

      {role !== 'YDK' && <Switch checked={captain} onChange={onCaptain} label={<span className="flex items-center gap-2"><Crown size={16} /> Kaptan</span>} />}

      <button
        onClick={onClose}
        className="h-12 w-full rounded-2xl text-[15px] font-bold transition active:scale-[0.98]"
        style={{ background: 'var(--accent)', color: 'var(--accent-ink)' }}
      >
        Tamam
      </button>
    </div>
  );
}
