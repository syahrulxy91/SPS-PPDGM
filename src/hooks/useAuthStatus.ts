import { useEffect, useState } from 'react';
import { onAuthStateChanged, signOut, getIdTokenResult } from 'firebase/auth';
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
        setLoading(false);
        return;
      }

      try {
        const tokenResult = await getIdTokenResult(firebaseUser);
        const appRoleFromClaims = tokenResult.claims.appRole as string | undefined;
        let role: 'SUPER_ADMIN' | 'ADMIN' | 'USER' = 'USER';

        if (appRoleFromClaims === 'SUPER_ADMIN') {
          role = 'SUPER_ADMIN';
        } else if (appRoleFromClaims === 'ADMIN') {
          role = 'ADMIN';
        } else if (appRoleFromClaims === 'USER') {
          role = 'USER';
        } else {
          // Fallback
          if (emailLower === 'syahrulxy91@gmail.com') {
            role = 'SUPER_ADMIN';
          } else {
            role = 'USER';
          }
        }

        const appUser: AppUser = {
          uid: firebaseUser.uid,
          name: firebaseUser.displayName || 'Pengguna',
          email: email,
          photoURL: firebaseUser.photoURL || '',
          role: role
        };

        setUser(appUser);
        sessionStorage.setItem('sps_auth_user', JSON.stringify(appUser));
      } catch (err) {
        console.error('[DEBUG useAuthStatus] Gagal mengambil claims:', err);
        // Fallback user state without crashes
        const appUser: AppUser = {
          uid: firebaseUser.uid,
          name: firebaseUser.displayName || 'Pengguna',
          email: email,
          photoURL: firebaseUser.photoURL || '',
          role: emailLower === 'syahrulxy91@gmail.com' ? 'SUPER_ADMIN' : 'USER'
        };
        setUser(appUser);
        sessionStorage.setItem('sps_auth_user', JSON.stringify(appUser));
      }
      setLoading(false);
    });

    return () => {
      unsubscribeAuth();
    };
  }, []);

  const isAuthenticated = !!user;
  return { isAuthenticated, user, loading };
}
