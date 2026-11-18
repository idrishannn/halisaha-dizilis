import { useCallback, useEffect, useRef, useState } from 'react';
import { toBlob } from 'html-to-image';
import { Download, ImagePlus, RotateCcw, Share2, Trash2, X } from 'lucide-react';
import Pitch, { PlayerToken } from './components/Pitch.jsx';
import { TEAM_SIZES } from './formations.js';
import { resizeImage } from './image.js';
import {
  defaultState, loadState, movePlayer, positionsFor, resetPositions,
  saveState, setFormation, setSize, updatePlayer,
} from './state.js';

const storage = typeof window !== 'undefined' ? window.localStorage : null;

export default function App() {
  const [state, setState] = useState(() => (storage ? loadState(storage) : defaultState()));
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState(false);
  const pitchRef = useRef(null);
  const fileRef = useRef(null);
  const pickingFor = useRef(null);

  useEffect(() => {
    if (storage && !saveState(storage, state)) {
      setNotice('Tarayıcı depolama alanı doldu; son değişiklik kaydedilemedi. Bazı fotoğrafları kaldır.');
    }
  }, [state]);

  useEffect(() => {
    if (!notice) return undefined;
    const t = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(t);
  }, [notice]);

  const positions = positionsFor(state);
  const lineup = state.players.slice(0, state.size);

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
      setNotice(err.message);
    }
  };

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

  const download = async () => {
    setBusy(true);
    try {
      const blob = await renderImage();
      const url = URL.createObjectURL(blob);
      const a = Object.assign(document.createElement('a'), { href: url, download: fileName() });
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setNotice('Görüntü oluşturulamadı, tekrar dene.');
    } finally {
      setBusy(false);
    }
  };

  const share = async () => {
    setBusy(true);
    try {
      const blob = await renderImage();
      const file = new File([blob], fileName(), { type: 'image/png' });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: state.match.title, text: shareText() });
      } else {
        await download();
        setNotice('Bu tarayıcı doğrudan paylaşmayı desteklemiyor; görüntü indirildi.');
      }
    } catch (err) {
      if (err?.name !== 'AbortError') setNotice('Paylaşılamadı, görüntüyü indirip gönderebilirsin.');
    } finally {
      setBusy(false);
    }
  };

  const shareText = () =>
    [state.match.title, state.match.place, state.match.time].filter(Boolean).join(' · ');

  const resetAll = () => {
    if (window.confirm('Tüm kadro, fotoğraflar ve konumlar sıfırlansın mı?')) setState(defaultState());
  };

  const setMatch = (patch) => setState((s) => ({ ...s, match: { ...s.match, ...patch } }));

  return (
    <div className="min-h-full bg-neutral-950 text-neutral-100">
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFile} />

      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-6 lg:flex-row lg:items-start">
        <div className="lg:hidden">
          <AppHeader />
        </div>
        {/* Saha */}
        <main className="order-1 w-full lg:order-2 lg:flex-1">
          <div className="mx-auto w-full max-w-[min(100%,calc((100vh-9rem)*0.62))] min-w-[280px]">
            <Pitch ref={pitchRef} match={state.match}>
              {positions.map((pos, i) => (
                <PlayerToken
                  key={`${state.size}-${state.formation}-${i}`}
                  player={lineup[i]}
                  position={pos}
                  showName={state.showNames}
                  onMove={(x, y) => setState((s) => movePlayer(s, i, x, y))}
                  onPickImage={() => pickImage(lineup[i].id)}
                />
              ))}
            </Pitch>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <button
                onClick={share}
                disabled={busy}
                className="flex items-center justify-center gap-2 rounded-xl bg-green-500 px-4 py-3 font-bold text-neutral-950 transition hover:bg-green-400 disabled:opacity-60"
              >
                <Share2 size={18} /> Paylaş
              </button>
              <button
                onClick={download}
                disabled={busy}
                className="flex items-center justify-center gap-2 rounded-xl bg-white/10 px-4 py-3 font-bold transition hover:bg-white/20 disabled:opacity-60"
              >
                <Download size={18} /> PNG indir
              </button>
            </div>
            <p className="mt-2 text-center text-xs text-neutral-500">
              Oyuncuyu sürükleyerek taşı · boş yuvarlağa dokunup fotoğraf ekle
            </p>
          </div>
        </main>

        {/* Kontroller */}
        <aside className="order-2 w-full space-y-5 lg:order-1 lg:w-80 lg:shrink-0">
          <div className="hidden lg:block">
            <AppHeader />
          </div>

          <Section title="Maç">
            <Field label="Başlık" value={state.match.title} onChange={(v) => setMatch({ title: v })} />
            <Field label="Saha" placeholder="Örn. Yıldız Halı Saha" value={state.match.place} onChange={(v) => setMatch({ place: v })} />
            <Field label="Gün / saat" placeholder="Örn. Perşembe 21:00" value={state.match.time} onChange={(v) => setMatch({ time: v })} />
          </Section>

          <Section title="Diziliş">
            <div className="grid grid-cols-3 gap-2">
              {Object.keys(TEAM_SIZES).map((n) => (
                <Chip key={n} active={state.size === Number(n)} onClick={() => setState((s) => setSize(s, Number(n)))}>
                  {n}'li
                </Chip>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-2">
              {Object.keys(TEAM_SIZES[state.size]).map((f) => (
                <Chip key={f} active={state.formation === f} onClick={() => setState((s) => setFormation(s, f))}>
                  {f}
                </Chip>
              ))}
            </div>
            <div className="flex items-center justify-between text-sm">
              <label className="flex cursor-pointer items-center gap-2 text-neutral-300">
                <input
                  type="checkbox"
                  checked={state.showNames}
                  onChange={(e) => setState((s) => ({ ...s, showNames: e.target.checked }))}
                  className="h-4 w-4 accent-green-500"
                />
                İsimleri göster
              </label>
              <button
                onClick={() => setState(resetPositions)}
                className="flex items-center gap-1 text-neutral-400 hover:text-white"
              >
                <RotateCcw size={14} /> Konumları sıfırla
              </button>
            </div>
          </Section>

          <Section title="Oyuncular">
            <ul className="space-y-2">
              {lineup.map((p, i) => (
                <li key={p.id} className="flex items-center gap-2">
                  <span className="w-8 shrink-0 text-center text-[11px] font-bold text-neutral-500">{positions[i].role}</span>
                  <button
                    onClick={() => pickImage(p.id)}
                    className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full bg-white/10 ring-1 ring-white/20"
                    title="Fotoğraf seç"
                  >
                    {p.image ? (
                      <img src={p.image} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <ImagePlus size={16} className="m-auto text-neutral-400" />
                    )}
                  </button>
                  <input
                    value={p.name}
                    onChange={(e) => setState((s) => updatePlayer(s, p.id, { name: e.target.value }))}
                    maxLength={18}
                    className="min-w-0 flex-1 rounded-lg bg-white/5 px-3 py-2 text-sm outline-none ring-1 ring-white/10 focus:ring-green-500"
                  />
                  {p.image && (
                    <button
                      onClick={() => setState((s) => updatePlayer(s, p.id, { image: null }))}
                      className="text-neutral-500 hover:text-red-400"
                      title="Fotoğrafı kaldır"
                    >
                      <X size={16} />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </Section>

          <button onClick={resetAll} className="flex items-center gap-2 text-sm text-neutral-500 hover:text-red-400">
            <Trash2 size={14} /> Her şeyi sıfırla
          </button>
        </aside>
      </div>

      {notice && (
        <div role="status" className="fixed inset-x-4 bottom-4 z-50 mx-auto max-w-md rounded-xl bg-neutral-800 px-4 py-3 text-sm shadow-2xl ring-1 ring-white/10">
          {notice}
        </div>
      )}
    </div>
  );
}

function AppHeader() {
  return (
    <header>
      <h1 className="text-2xl font-extrabold tracking-tight">⚽ Halı Saha Diziliş</h1>
      <p className="text-sm text-neutral-400">Kadronu kur, görüntüyü gruba at.</p>
    </header>
  );
}

function Section({ title, children }) {
  return (
    <section className="space-y-3 rounded-2xl bg-white/[0.04] p-4 ring-1 ring-white/10">
      <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400">{title}</h3>
      {children}
    </section>
  );
}

function Field({ label, value, onChange, placeholder }) {
  return (
    <label className="block">
      <span className="text-xs text-neutral-400">{label}</span>
      <input
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        maxLength={40}
        className="mt-1 w-full rounded-lg bg-white/5 px-3 py-2 text-sm outline-none ring-1 ring-white/10 placeholder:text-neutral-600 focus:ring-green-500"
      />
    </label>
  );
}

function Chip({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-lg px-2 py-2 text-sm font-semibold transition ${
        active ? 'bg-green-500 text-neutral-950' : 'bg-white/5 text-neutral-300 ring-1 ring-white/10 hover:bg-white/10'
      }`}
    >
      {children}
    </button>
  );
}
