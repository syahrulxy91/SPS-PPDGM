import { useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
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
    const unsubscribeAuth = onAuthStateChanged(auth, (firebaseUser) => {
      if (!firebaseUser) {
        setUser(null);
        sessionStorage.removeItem('sps_auth_user');
        sessionStorage.removeItem('sps_auth_token');
        setLoading(false);
        return;
      }

      const email = firebaseUser.email || '';
      const emailLower = email.toLowerCase();

      // Listen in real-time to this user's role assignment in Firestore
      const docRef = doc(db, 'roleAssignments', emailLower);
      const unsubscribeRole = onSnapshot(docRef, (docSnap) => {
        let role: UserRole = 'PEMERHATI';
        let assignedUnit: Unit | undefined = undefined;

        if (emailLower === 'syahrulxy91@gmail.com') {
          role = 'SUPER ADMIN';
        } else if (docSnap.exists()) {
          const data = docSnap.data();
          role = data.role as UserRole;
          assignedUnit = data.unit as Unit;
        } else {
          // Fallback to localStorage if Firestore doesn't have it yet of if offline
          const savedRolesStr = localStorage.getItem('sps_role_assignments');
          if (savedRolesStr) {
            try {
              const assignments = JSON.parse(savedRolesStr);
              if (assignments[emailLower]) {
                role = assignments[emailLower].role;
                assignedUnit = assignments[emailLower].unit;
              }
            } catch (e) {
              console.warn(e);
            }
          }
        }

        const appUser: AppUser = {
          uid: firebaseUser.uid,
          name: firebaseUser.displayName || 'Pengguna',
          email: email,
          photoURL: firebaseUser.photoURL || '',
          role: role,
          unit: assignedUnit
        };

        setUser(appUser);
        sessionStorage.setItem('sps_auth_user', JSON.stringify(appUser));
        setLoading(false);
      }, (err) => {
        console.warn("Gagal listen role dari Firestore:", err);
        // Fallback on error / offline
        let role: UserRole = 'PEMERHATI';
        let assignedUnit: Unit | undefined = undefined;
        if (emailLower === 'syahrulxy91@gmail.com') {
          role = 'SUPER ADMIN';
        } else {
          const savedRolesStr = localStorage.getItem('sps_role_assignments');
          if (savedRolesStr) {
            try {
              const assignments = JSON.parse(savedRolesStr);
              if (assignments[emailLower]) {
                role = assignments[emailLower].role;
                assignedUnit = assignments[emailLower].unit;
              }
            } catch (e) {}
          }
        }
        const appUser: AppUser = {
          uid: firebaseUser.uid,
          name: firebaseUser.displayName || 'Pengguna',
          email: email,
          photoURL: firebaseUser.photoURL || '',
          role: role,
          unit: assignedUnit
        };
        setUser(appUser);
        setLoading(false);
      });

      return () => unsubscribeRole();
    });

    return () => unsubscribeAuth();
  }, []);

  const isAuthenticated = !!user;
  return { isAuthenticated, user, loading };
}
