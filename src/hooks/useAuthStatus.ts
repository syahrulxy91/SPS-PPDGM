import { useEffect, useState } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { AppUser } from '../types';

export function useAuthStatus() {
  const [user, setUser] = useState<AppUser | null>(() => {
    const cached = sessionStorage.getItem('sps_auth_user');
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        const emailLower = (parsed.email || '').toLowerCase().trim();
        if (emailLower.endsWith('@moe.gov.my') || emailLower === 'syahrulxy91@gmail.com') {
          return parsed;
        }
      } catch {
        // ignore
      }
    }
    return null;
  });

  const [loading, setLoading] = useState(() => {
    const cached = sessionStorage.getItem('sps_auth_user');
    return cached ? false : true;
  });

  useEffect(() => {
    const isIframe = window.self !== window.top;

    console.log('[DEBUG useAuthStatus] Hook diinisialisasi.', {
      isIframe,
      origin: window.location.origin,
      sessionStorageUser: sessionStorage.getItem('sps_auth_user') ? 'Ada' : 'Tiada',
    });

    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      console.log('[DEBUG useAuthStatus] onAuthStateChanged dikesan.', {
        email: firebaseUser?.email || 'NULL',
        uid: firebaseUser?.uid || 'NULL',
      });

      if (!firebaseUser) {
        setUser(null);
        sessionStorage.removeItem('sps_auth_user');
        sessionStorage.removeItem('sps_auth_token');
        setLoading(false);
        return;
      }

      const email = firebaseUser.email || '';
      const emailLower = email.toLowerCase().trim();
      const isMoeEmail = emailLower.endsWith('@moe.gov.my');
      const isMaintainer = emailLower === 'syahrulxy91@gmail.com';

      if (!isMoeEmail && !isMaintainer) {
        console.warn('[SECURITY] Domain email tidak sah dikesan di hook useAuthStatus. Menandatangani keluar...');
        await signOut(auth).catch(() => {});
        setUser(null);
        sessionStorage.removeItem('sps_auth_user');
        sessionStorage.removeItem('sps_auth_token');
        setLoading(false);
        return;
      }

      try {
        const freshToken = await firebaseUser.getIdToken();
        sessionStorage.setItem('sps_auth_token', freshToken);
      } catch (err) {
        console.error('[DEBUG useAuthStatus] Gagal memperolehi ID Token:', err);
      }

      const appUser: AppUser = {
        uid: firebaseUser.uid,
        name: firebaseUser.displayName || 'Pengguna',
        email: email,
        photoURL: firebaseUser.photoURL || '',
      };

      setUser(appUser);
      sessionStorage.setItem('sps_auth_user', JSON.stringify(appUser));
      setLoading(false);
    });

    return () => {
      unsubscribeAuth();
    };
  }, []);

  const isAuthenticated = !!user;
  return { isAuthenticated, user, loading };
}
