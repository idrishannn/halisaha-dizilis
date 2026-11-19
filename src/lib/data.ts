import {
  addDoc, collection, doc, getDocs, limit, onSnapshot, orderBy, query, serverTimestamp, updateDoc, where,
  arrayUnion,
} from 'firebase/firestore';
import type { AppState } from '../types.ts';
import { db } from './firebase.ts';
import { teamFields } from './model.ts';
import type { MatchDoc, MatchSide, TeamDoc, WithId } from './model.ts';

const teams = collection(db, 'teams');
const matches = collection(db, 'matches');

/* ---------------- takım ---------------- */

/** Bu kullanıcının yönettiği takımı bulur (MVP: kullanıcı başına bir takım). */
export async function findMyTeamId(uid: string): Promise<string | null> {
  const snap = await getDocs(query(teams, where('adminUid', '==', uid), limit(1)));
  return snap.empty ? null : snap.docs[0].id;
}

export async function createTeam(uid: string, state: AppState): Promise<string> {
  const ref = await addDoc(teams, {
    adminUid: uid,
    ...teamFields(state),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export function saveTeam(teamId: string, state: AppState): Promise<void> {
  return updateDoc(doc(teams, teamId), { ...teamFields(state), updatedAt: serverTimestamp() });
}

export function watchTeam(teamId: string, cb: (team: TeamDoc | null) => void): () => void {
  return onSnapshot(
    doc(teams, teamId),
    (snap) => cb(snap.exists() ? (snap.data() as TeamDoc) : null),
    () => cb(null),
  );
}

/* ---------------- maç ---------------- */

export async function createMatch(uid: string, home: MatchSide, place: string, time: string): Promise<string> {
  const ref = await addDoc(matches, {
    createdBy: uid,
    createdAt: serverTimestamp(),
    members: [uid],
    home,
    away: null,
    place: place.slice(0, 60),
    time: time.slice(0, 60),
    score: null,
  });
  return ref.id;
}

/** Rakip takım linkten maça katılır. */
export function joinMatch(matchId: string, uid: string, away: MatchSide): Promise<void> {
  return updateDoc(doc(matches, matchId), { away, members: arrayUnion(uid) });
}

export function setScore(matchId: string, uid: string, byTeam: string, home: number, away: number): Promise<void> {
  return updateDoc(doc(matches, matchId), {
    score: { home, away, by: byTeam.slice(0, 24), byUid: uid, at: serverTimestamp() },
  });
}

export function watchMatch(matchId: string, cb: (match: WithId<MatchDoc> | null, error?: Error) => void): () => void {
  return onSnapshot(
    doc(matches, matchId),
    (snap) => cb(snap.exists() ? { id: snap.id, ...(snap.data() as MatchDoc) } : null),
    (err) => cb(null, err),
  );
}

/** Kullanıcının taraf olduğu maçlar, yeniden eskiye. */
export function watchMyMatches(uid: string, cb: (list: WithId<MatchDoc>[]) => void, onError?: (e: Error) => void): () => void {
  return onSnapshot(
    query(matches, where('members', 'array-contains', uid), orderBy('createdAt', 'desc'), limit(50)),
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...(d.data({ serverTimestamps: 'estimate' }) as MatchDoc) }))),
    (err) => onError?.(err),
  );
}

export const matchUrl = (id: string) => `${window.location.origin}/m/${id}`;
