import { useEffect, useState } from 'react';
import { LayoutGrid, Loader2, Users, WifiOff } from 'lucide-react';
import { Toast } from './components/ui.tsx';
import type { ToastData } from './components/ui.tsx';
import { navigate, parseRoute, usePath } from './lib/router.ts';
import { useSession } from './lib/session.ts';
import Home from './screens/Home.tsx';
import Lineup from './screens/Lineup.tsx';
import Match from './screens/Match.tsx';
import { defaultState, loadState, saveState } from './state.ts';
import type { AppState } from './types.ts';

const storage = (() => {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
})();

export default function App() {
  const [state, setState] = useState<AppState>(() => (storage ? loadState(storage) : defaultState()));
  const [toast, setToast] = useState<ToastData | null>(null);
  const session = useSession(state);
  const route = parseRoute(usePath());

  const notify = (text: string, extra: Partial<ToastData> = {}) => setToast({ id: Date.now(), text, ...extra });

  // Yerel kayıt: fotoğraflar dahil her şey cihazda da durur (çevrimdışı açılış için)
  useEffect(() => {
    if (storage && !saveState(storage, state)) {
      notify('Cihaz depolama alanı doldu; son değişiklik kaydedilemedi. Bazı fotoğrafları kaldır.');
    }
  }, [state]);

  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(null), toast.action ? 5000 : 3500);
    return () => clearTimeout(t);
  }, [toast]);

  const online = session.status === 'ready' ? session : null;
  const showNav = route.name === 'home' || route.name === 'lineup';

  let screen;
  if (route.name === 'lineup') {
    screen = <Lineup state={state} setState={setState} notify={notify} />;
  } else if (route.name === 'match') {
    screen = online ? (
      <Match id={route.id} session={online} state={state} setState={setState} notify={notify} />
    ) : (
      <Waiting session={session} />
    );
  } else if (route.name === 'home') {
    screen = online ? <Home session={online} state={state} setState={setState} notify={notify} /> : <Waiting session={session} />;
  } else {
    screen = (
      <div className="mx-auto max-w-md px-6 pt-24 text-center">
        <h1 className="text-xl font-bold">Sayfa bulunamadı</h1>
        <button onClick={() => navigate('/')} className="mt-4 font-semibold underline">Ana sayfaya dön</button>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${showNav ? 'pb-24' : ''}`}>
      {screen}
      {showNav && <BottomNav active={route.name} />}
      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}

function Waiting({ session }: { session: ReturnType<typeof useSession> }) {
  if (session.status === 'error') {
    return (
      <div className="mx-auto flex max-w-sm flex-col items-center gap-3 px-6 pt-28 text-center">
        <WifiOff size={28} className="text-muted" />
        <p className="text-[15px] font-medium">{session.message}</p>
        <button onClick={() => window.location.reload()} className="mt-2 h-12 rounded-2xl bg-ink px-6 font-bold text-white">
          Tekrar dene
        </button>
        <button onClick={() => navigate('/kadro')} className="h-11 font-semibold text-muted">
          Çevrimdışı kadroyu aç
        </button>
      </div>
    );
  }
  return (
    <div className="flex justify-center pt-32 text-muted">
      <Loader2 className="animate-spin" />
    </div>
  );
}

function BottomNav({ active }: { active: string }) {
  const items = [
    { name: 'home', to: '/', label: 'Maçlar', icon: <LayoutGrid size={22} /> },
    { name: 'lineup', to: '/kadro', label: 'Kadro', icon: <Users size={22} /> },
  ];
  return (
    <nav
      aria-label="Ana menü"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-line bg-surface/95 pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur"
    >
      <div className="mx-auto grid max-w-md grid-cols-2">
        {items.map((it) => (
          <a
            key={it.name}
            href={it.to}
            onClick={(e) => {
              e.preventDefault();
              navigate(it.to);
            }}
            aria-current={active === it.name ? 'page' : undefined}
            className={`flex h-14 flex-col items-center justify-center gap-0.5 text-[11px] ${
              active === it.name ? 'font-bold text-ink' : 'font-semibold text-muted'
            }`}
          >
            {it.icon}
            {it.label}
          </a>
        ))}
      </div>
    </nav>
  );
}

