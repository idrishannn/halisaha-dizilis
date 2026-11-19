import { useEffect, useRef, useState } from 'react';
import type { AppState } from '../types.ts';
import { createTeam, findMyTeamId, saveTeam } from './data.ts';
import { ensureSignedIn } from './firebase.ts';
import { teamFields } from './model.ts';

export type Session =
  | { status: 'loading' }
  | { status: 'ready'; uid: string; teamId: string }
  | { status: 'error'; message: string };

const TEAM_KEY = 'halisaha_team';

function readCachedTeam(uid: string): string | null {
  try {
    const raw = localStorage.getItem(TEAM_KEY);
    if (!raw) return null;
    const [cachedUid, teamId] = raw.split(':');
    return cachedUid === uid && teamId ? teamId : null;
  } catch {
    return null;
  }
}

function cacheTeam(uid: string, teamId: string) {
  try {
    localStorage.setItem(TEAM_KEY, `${uid}:${teamId}`);
  } catch {
    // depolama yoksa her açılışta sorgulanır
  }
}

/**
 * Anonim oturumu açar, kullanıcının takımını bulur ya da (ilk açılışta) yerel kadrodan oluşturur.
 * Sonra yerel kadrodaki değişiklikleri kısa bir gecikmeyle Firestore'a yazar.
 */
export function useSession(state: AppState): Session {
  const [session, setSession] = useState<Session>({ status: 'loading' });
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const user = await ensureSignedIn();
        let teamId = readCachedTeam(user.uid) ?? (await findMyTeamId(user.uid));
        if (!teamId) teamId = await createTeam(user.uid, stateRef.current);
        cacheTeam(user.uid, teamId);
        lastSaved.current = JSON.stringify(teamFields(stateRef.current));
        if (alive) setSession({ status: 'ready', uid: user.uid, teamId });
      } catch (err) {
        console.error(err);
        if (alive) setSession({ status: 'error', message: 'Sunucuya bağlanılamadı. İnternet bağlantını kontrol et.' });
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // Kadro değişikliklerini yaz (fotoğraflar hariç; onlar cihazda kalır)
  const lastSaved = useRef<string | null>(null);
  const fieldsKey = JSON.stringify(teamFields(state));
  const teamId = session.status === 'ready' ? session.teamId : null;
  useEffect(() => {
    if (!teamId || fieldsKey === lastSaved.current) return undefined;
    const t = setTimeout(() => {
      lastSaved.current = fieldsKey;
      saveTeam(teamId, stateRef.current).catch((err) => {
        console.error(err);
        lastSaved.current = null; // sonraki değişiklikte tekrar dene
      });
    }, 700);
    return () => clearTimeout(t);
  }, [teamId, fieldsKey]);

  return session;
}
