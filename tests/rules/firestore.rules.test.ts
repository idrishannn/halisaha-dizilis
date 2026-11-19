import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';
import {
  addDoc, arrayUnion, collection, deleteDoc, doc, getDoc, getDocs, query, serverTimestamp, setDoc, updateDoc, where,
} from 'firebase/firestore';

let env: RulesTestEnvironment;

const team = (adminUid: string, name = 'Perşembe FC') => ({
  adminUid,
  name,
  kit: 'blue',
  size: 7,
  formation: '3-2-1',
  players: [{ id: 1, name: 'Hakan' }],
  overrides: {},
  captain: null,
  showNames: true,
  createdAt: serverTimestamp(),
  updatedAt: serverTimestamp(),
});

const newMatch = (uid: string, teamId: string) => ({
  createdBy: uid,
  createdAt: serverTimestamp(),
  members: [uid],
  home: { teamId, name: 'Perşembe FC', kit: 'blue' },
  away: null,
  place: 'Yıldız',
  time: 'Perşembe 21:00',
  score: null,
});

const as = (uid: string) => env.authenticatedContext(uid).firestore();

/** Kurallara takılmadan başlangıç verisi yazar. */
async function seed(fn: (db: ReturnType<RulesTestEnvironment['unauthenticatedContext']>['firestore'] extends () => infer R ? R : never) => Promise<void>) {
  await env.withSecurityRulesDisabled(async (ctx) => fn(ctx.firestore() as never));
}

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-halisaha',
    firestore: { rules: readFileSync('firestore.rules', 'utf8') },
  });
});
afterAll(async () => env?.cleanup());
beforeEach(async () => env.clearFirestore());

describe('takımlar', () => {
  it('oturum açmayan hiçbir şey okuyamaz', async () => {
    await seed(async (db) => setDoc(doc(db, 'teams/t1'), team('ali')));
    await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), 'teams/t1')));
  });

  it('kendi takımını oluşturabilir, başkası adına oluşturamaz', async () => {
    await assertSucceeds(addDoc(collection(as('ali'), 'teams'), team('ali')));
    await assertFails(addDoc(collection(as('ali'), 'teams'), team('veli')));
  });

  it('geçersiz takım verisini reddeder', async () => {
    await assertFails(addDoc(collection(as('ali'), 'teams'), { ...team('ali'), size: 11 }));
    await assertFails(addDoc(collection(as('ali'), 'teams'), { ...team('ali'), name: 'x'.repeat(30) }));
    await assertFails(addDoc(collection(as('ali'), 'teams'), { ...team('ali'), isAdmin: true }));
  });

  it('sadece yönetici günceller; yöneticilik devredilemez', async () => {
    await seed(async (db) => setDoc(doc(db, 'teams/t1'), team('ali')));
    await assertSucceeds(updateDoc(doc(as('ali'), 'teams/t1'), { name: 'Yeni Ad' }));
    await assertFails(updateDoc(doc(as('veli'), 'teams/t1'), { name: 'Ele geçirildi' }));
    await assertFails(updateDoc(doc(as('ali'), 'teams/t1'), { adminUid: 'veli' }));
  });

  it("ID'yi bilen okur ama başkalarının takımlarını listeleyemez", async () => {
    await seed(async (db) => setDoc(doc(db, 'teams/t1'), team('ali')));
    await assertSucceeds(getDoc(doc(as('veli'), 'teams/t1')));
    await assertFails(getDocs(collection(as('veli'), 'teams')));
    await assertSucceeds(getDocs(query(collection(as('ali'), 'teams'), where('adminUid', '==', 'ali'))));
  });
});

describe('maçlar', () => {
  beforeEach(async () => {
    await seed(async (db) => {
      await setDoc(doc(db, 'teams/home'), team('ali'));
      await setDoc(doc(db, 'teams/away'), team('veli', 'Kartallar'));
      await setDoc(doc(db, 'teams/third'), team('can', 'Ofis United'));
    });
  });

  it('kendi takımıyla maç kurar, başkasının takımıyla kuramaz', async () => {
    await assertSucceeds(addDoc(collection(as('ali'), 'matches'), newMatch('ali', 'home')));
    await assertFails(addDoc(collection(as('ali'), 'matches'), newMatch('ali', 'away')));
  });

  it('maçı hazır skorla ya da rakiple kuramaz', async () => {
    await assertFails(addDoc(collection(as('ali'), 'matches'), { ...newMatch('ali', 'home'), score: { home: 9, away: 0 } }));
    await assertFails(
      addDoc(collection(as('ali'), 'matches'), { ...newMatch('ali', 'home'), away: { teamId: 'away', name: 'K', kit: 'orange' } }),
    );
    await assertFails(addDoc(collection(as('ali'), 'matches'), { ...newMatch('ali', 'home'), members: ['ali', 'veli'] }));
  });

  describe('katılma', () => {
    beforeEach(async () => {
      await seed(async (db) => setDoc(doc(db, 'matches/m1'), { ...newMatch('ali', 'home'), createdAt: new Date() }));
    });

    const join = (uid: string, teamId: string) =>
      updateDoc(doc(as(uid), 'matches/m1'), { away: { teamId, name: 'Kartallar', kit: 'orange' }, members: arrayUnion(uid) });

    it('linki açan rakip kendi takımıyla katılır', async () => {
      await assertSucceeds(join('veli', 'away'));
    });

    it('başkasının takımıyla katılamaz', async () => {
      await assertFails(join('veli', 'third'));
    });

    it('maçı kuran kendi maçına rakip olamaz', async () => {
      await assertFails(join('ali', 'home'));
    });

    it('rakip katıldıktan sonra üçüncü bir takım giremez', async () => {
      await assertSucceeds(join('veli', 'away'));
      await assertFails(join('can', 'third'));
    });

    it('katılırken skor ya da başka alan değiştiremez', async () => {
      await assertFails(
        updateDoc(doc(as('veli'), 'matches/m1'), {
          away: { teamId: 'away', name: 'Kartallar', kit: 'orange' },
          members: arrayUnion('veli'),
          place: 'Başka saha',
        }),
      );
    });
  });

  describe('skor ve liste', () => {
    beforeEach(async () => {
      await seed(async (db) =>
        setDoc(doc(db, 'matches/m1'), {
          ...newMatch('ali', 'home'),
          createdAt: new Date(),
          members: ['ali', 'veli'],
          away: { teamId: 'away', name: 'Kartallar', kit: 'orange' },
        }),
      );
    });

    const score = (uid: string, extra: object = {}) =>
      updateDoc(doc(as(uid), 'matches/m1'), {
        score: { home: 5, away: 3, by: 'Perşembe FC', byUid: uid, at: serverTimestamp(), ...extra },
      });

    it('iki takımın yöneticisi de skoru girip düzeltebilir', async () => {
      await assertSucceeds(score('ali'));
      await assertSucceeds(score('veli'));
    });

    it('maçta olmayan skor giremez', async () => {
      await assertFails(score('can'));
    });

    it('skoru başkası adına giremez, saçma skor giremez', async () => {
      await assertFails(score('ali', { byUid: 'veli' }));
      await assertFails(score('ali', { home: -1 }));
      await assertFails(score('ali', { home: 2.5 }));
    });

    it('taraflar üye listesini ya da takımları değiştiremez', async () => {
      await assertFails(updateDoc(doc(as('ali'), 'matches/m1'), { members: ['ali'] }));
      await assertFails(updateDoc(doc(as('ali'), 'matches/m1'), { away: null }));
    });

    it('sadece taraf olduğu maçları listeler', async () => {
      await assertSucceeds(getDocs(query(collection(as('veli'), 'matches'), where('members', 'array-contains', 'veli'))));
      await assertFails(getDocs(collection(as('can'), 'matches')));
    });

    it('rakip katıldıktan sonra maç silinemez', async () => {
      await assertFails(deleteDoc(doc(as('ali'), 'matches/m1')));
    });
  });
});
