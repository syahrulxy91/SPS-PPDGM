import { useEffect, useState } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../lib/firebase';
import { AppUser, UserRole, Unit } from '../types';

export function useAuthStatus() {
  const [user, setUser] = useState<AppUser | null>(() => {
    const cached = sessionStorage.getItem('sps_auth_user');
    return cached ? JSON.parse(cached) : null;
  });
  const [loading, setLoading] = useState(() => {
    const cached = sessionStorage.getItem('sps_auth_user');
    return cached ? false : true;
  });

  useEffect(() => {
    let unsubscribeRole: (() => void) | null = null;
    const isIframe = window.self !== window.top;

    console.log('[DEBUG useAuthStatus] Hook diinisialisasi.', {
      isIframe,
      origin: window.location.origin,
      sessionStorageUser: sessionStorage.getItem('sps_auth_user') ? 'Ada' : 'Tiada',
      sessionStorageToken: sessionStorage.getItem('sps_auth_token') ? 'Ada' : 'Tiada'
    });

    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      console.log('[DEBUG useAuthStatus] onAuthStateChanged dikesan.', {
        email: firebaseUser?.email || 'NULL',
        uid: firebaseUser?.uid || 'NULL',
        authCurrentUser: auth.currentUser?.email || 'NULL'
      });

      if (firebaseUser) {
        try {
          const freshToken = await firebaseUser.getIdToken();
          console.log('[DEBUG useAuthStatus] Berjaya mendapatkan ID Token terkini. Panjang:', freshToken?.length);
        } catch (err) {
          console.error('[DEBUG useAuthStatus] Gagal memperolehi ID Token daripada user:', err);
        }
      }

      // Clean up previous role snapshot subscription to prevent leak & stale state updates
      if (unsubscribeRole) {
        unsubscribeRole();
        unsubscribeRole = null;
      }

      if (!firebaseUser) {
        setUser(null);
        sessionStorage.removeItem('sps_auth_user');
        sessionStorage.removeItem('sps_auth_token');
        setLoading(false);
        return;
      }

      const email = firebaseUser.email || '';
      const emailLower = email.toLowerCase();

      // Listen in real-time to this user's email registration status in Firestore
      const docRef = doc(db, 'registeredEmails', emailLower);
      unsubscribeRole = onSnapshot(docRef, async (docSnap) => {
        let role: UserRole = 'ADMIN SPS';

        if (emailLower === 'syahrulxy91@gmail.com') {
          role = 'SUPER ADMIN';
          
          const appUser: AppUser = {
            uid: firebaseUser.uid,
            name: firebaseUser.displayName || 'Pengguna',
            email: email,
            photoURL: firebaseUser.photoURL || '',
            role: role
          };

          setUser(appUser);
          sessionStorage.setItem('sps_auth_user', JSON.stringify(appUser));
          setLoading(false);
        } else if (docSnap.exists()) {
          role = 'ADMIN SPS';

          const appUser: AppUser = {
            uid: firebaseUser.uid,
            name: firebaseUser.displayName || 'Pengguna',
            email: email,
            photoURL: firebaseUser.photoURL || '',
            role: role
          };

          setUser(appUser);
          sessionStorage.setItem('sps_auth_user', JSON.stringify(appUser));
          setLoading(false);
        } else {
          // If the user's email is not registered, sign out immediately
          console.warn("[SECURITY] Email tidak berdaftar dikesan semasa onSnapshot. Menandatangani keluar...");
          setUser(null);
          sessionStorage.removeItem('sps_auth_user');
          sessionStorage.removeItem('sps_auth_token');
          setLoading(false);
          await signOut(auth).catch(() => {});
        }
      }, (err) => {
        console.warn("Gagal listen registered email status dari Firestore:", err);
        
        if (!auth.currentUser) {
          console.log("Firestore error diabaikan kerana tiada sesi auth yang aktif.");
          return;
        }

        // Fallback for offline usage (assume in-session cache if already populated)
        if (emailLower === 'syahrulxy91@gmail.com') {
          const appUser: AppUser = {
            uid: firebaseUser.uid,
            name: firebaseUser.displayName || 'Pengguna',
            email: email,
            photoURL: firebaseUser.photoURL || '',
            role: 'SUPER ADMIN'
          };
          setUser(appUser);
          setLoading(false);
        } else {
          // Check if session cached user exists, keep it offline
          const cached = sessionStorage.getItem('sps_auth_user');
          if (cached) {
            setLoading(false);
          } else {
            // Force logout
            setUser(null);
            setLoading(false);
            signOut(auth).catch(() => {});
          }
        }

        // Throw error conforming to FirestoreErrorInfo for diagnostics
        handleFirestoreError(err, OperationType.GET, 'registeredEmails/' + emailLower);
      });
    });

    return () => {
      if (unsubscribeRole) {
        unsubscribeRole();
      }
      unsubscribeAuth();
    };
  }, []);

  const isAuthenticated = !!user;
  return { isAuthenticated, user, loading };
}
