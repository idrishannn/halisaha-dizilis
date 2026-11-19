import { initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, signInAnonymously } from 'firebase/auth';
import type { User } from 'firebase/auth';
import {
  connectFirestoreEmulator, initializeFirestore, memoryLocalCache, persistentLocalCache, persistentMultipleTabManager,
} from 'firebase/firestore';

// Bu değerler gizli değildir; her web uygulamasında istemciye gömülür.
// Veriyi koruyan şey firestore.rules dosyasındaki güvenlik kurallarıdır.
const firebaseConfig = {
  apiKey: 'AIzaSyCVY0pMrXhUttxvf9h-Lcl-xJSFSNkoRDc',
  authDomain: 'halisaha-dizilis.firebaseapp.com',
  projectId: 'halisaha-dizilis',
  storageBucket: 'halisaha-dizilis.firebasestorage.app',
  messagingSenderId: '443735516850',
  appId: '1:443735516850:web:b5cadf0448eb1985b10bab',
  measurementId: 'G-GN18MT0S1R',
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Yerel geliştirme: VITE_EMULATORS=1 ile gerçek proje yerine Firebase emülatörlerine bağlanır.
const useEmulators = import.meta.env.VITE_EMULATORS === '1';

// Çevrimdışı önbellek: uygulama ağ yokken de son veriyle açılır, yazmalar bağlantı gelince gider.
export const db = initializeFirestore(app, {
  localCache: useEmulators ? memoryLocalCache() : persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
});

if (useEmulators) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
}

let signingIn: Promise<User> | null = null;

/**
 * Kayıt istemeden anonim oturum açar; aynı cihazda kimlik kalıcıdır.
 * Tek bir söz (promise) paylaşılır: aynı anda iki çağrı iki ayrı anonim hesap açmasın.
 */
export function ensureSignedIn(): Promise<User> {
  if (!signingIn) {
    signingIn = (async () => {
      await auth.authStateReady();
      if (auth.currentUser) return auth.currentUser;
      const cred = await signInAnonymously(auth);
      return cred.user;
    })();
    signingIn.catch(() => {
      signingIn = null; // hata olursa sonraki denemede yeniden dene
    });
  }
  return signingIn;
}
