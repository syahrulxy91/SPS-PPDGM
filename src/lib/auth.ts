import { signInWithPopup, GoogleAuthProvider, onAuthStateChanged, User, signOut, setPersistence, browserLocalPersistence, getIdTokenResult } from 'firebase/auth';
import { auth, db, handleFirestoreError, OperationType } from './firebase';
import { AppUser } from '../types';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';

export const syncUserToFirestore = async (appUser: AppUser) => {
  const path = `users/${appUser.uid}`;
  try {
    const userDocRef = doc(db, 'users', appUser.uid);
    await setDoc(userDocRef, {
      uid: appUser.uid,
      name: appUser.name,
      email: appUser.email,
      photoURL: appUser.photoURL,
      role: appUser.role || 'USER',
      lastLogin: serverTimestamp(),
      disabled: false
    }, { merge: true });
    console.log('[DEBUG AUTH] Berjaya menyelaraskan pengguna ke Firestore:', appUser.email);
  } catch (err) {
    console.error('[DEBUG AUTH] Gagal menyelaraskan pengguna ke Firestore:', err);
    handleFirestoreError(err, OperationType.WRITE, path);
  }
};

// Set Firebase Auth Persistence explicitly to browserLocalPersistence for reliable session tracking
setPersistence(auth, browserLocalPersistence)
  .then(() => {
    console.log('[DEBUG AUTH] Firebase Auth persistence set to browserLocalPersistence successfully.');
  })
  .catch((err) => {
    console.warn('[DEBUG AUTH] Gagal menetapkan Firebase Auth persistence:', err);
  });

const provider = new GoogleAuthProvider();

let isSigningIn = false;
let currentAppUser: AppUser | null = sessionStorage.getItem('sps_auth_user') ? JSON.parse(sessionStorage.getItem('sps_auth_user')!) : null;

export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    console.log('[DEBUG AUTH] onAuthStateChanged dipanggil. User Firebase:', user?.email, 'auth.currentUser:', auth.currentUser?.email);
    
    if (user) {
      const email = user.email || '';
      const emailLower = email.toLowerCase().trim();
      const isMoeEmail = emailLower.endsWith('@moe.gov.my');
      const isMaintainer = emailLower === 'syahrulxy91@gmail.com';

      if (!isMoeEmail && !isMaintainer) {
        console.warn('[SECURITY] Domain email tidak sah dikesan di onAuthStateChanged. Sign out...');
        await signOut(auth).catch(() => {});
        currentAppUser = null;
        sessionStorage.removeItem('sps_auth_user');
        if (onAuthFailure) onAuthFailure();
        return;
      }

      try {
        const tokenResult = await getIdTokenResult(user);
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

        currentAppUser = {
          uid: user.uid,
          name: user.displayName || 'Pengguna',
          email: email,
          photoURL: user.photoURL || '',
          role: role
        };

        sessionStorage.setItem('sps_auth_user', JSON.stringify(currentAppUser));
        console.log('[DEBUG AUTH] Berjaya mengesahkan sesi:', user.email, 'Role:', role);
        await syncUserToFirestore(currentAppUser);

        if (onAuthSuccess) onAuthSuccess(user, tokenResult.token);
      } catch (err) {
        console.error('[DEBUG AUTH] Gagal mendapatkan token semasa onAuthStateChanged:', err);
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      console.log('[DEBUG AUTH] Tiada sesi Firebase Auth yang aktif.');
      if (onAuthFailure) onAuthFailure();
    }
  });
};

export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  const isIframe = window.self !== window.top;
  console.log('[DEBUG AUTH] googleSignIn dimulakan.', {
    isIframe,
    origin: window.location.origin,
    currentUser: auth.currentUser?.email
  });

  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    console.log('[DEBUG AUTH] signInWithPopup berjaya. User:', result.user?.email);

    // Semakan diagnostic persekitaran kuki/storage pihak ketiga dalam iframe
    try {
      const testKey = 'sps_test_storage';
      localStorage.setItem(testKey, '1');
      localStorage.removeItem(testKey);
      console.log('[DEBUG AUTH] Diagnosis LocalStorage: Berjaya menulis ke storage.');
    } catch (e) {
      console.error('[DEBUG AUTH] Diagnosis LocalStorage GAGAL (Mungkin sekatan kuki pihak ketiga/kuki iframe diaktifkan oleh penyemak imbas):', e);
    }

    const email = result.user.email || '';
    const emailLower = email.toLowerCase().trim();
    const isMoeEmail = emailLower.endsWith('@moe.gov.my');
    const isMaintainer = emailLower === 'syahrulxy91@gmail.com';

    if (!isMoeEmail && !isMaintainer) {
      console.warn('[SECURITY] Sesi ditolak kerana bukan domain @moe.gov.my.');
      await signOut(auth).catch(() => {});
      currentAppUser = null;
      sessionStorage.removeItem('sps_auth_user');
      throw new Error('Hanya pengguna dengan email @moe.gov.my dibenarkan mengakses sistem ini.');
    }

    const credential = GoogleAuthProvider.credentialFromResult(result);
    const fallbackIdToken = await result.user.getIdToken(true);
    const resolvedAccessToken = credential?.accessToken || fallbackIdToken;

    if (!resolvedAccessToken) {
      throw new Error('Gagal mendapatkan access token / ID token dari Firebase Auth');
    }

    const tokenResult = await getIdTokenResult(result.user);
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

    currentAppUser = {
      uid: result.user.uid,
      name: result.user.displayName || 'Pengguna',
      email: email,
      photoURL: result.user.photoURL || '',
      role: role
    };

    // Keep logged-in user logging for display in Admin panel (Kakitangan Bersistem)
    const loggedInUsersStr = localStorage.getItem('sps_logged_in_users');
    let loggedInUsers = loggedInUsersStr ? JSON.parse(loggedInUsersStr) : [];
    
    const existsIdx = loggedInUsers.findIndex((u: any) => u.email.toLowerCase() === emailLower);
    const userInfo = {
      email: email,
      name: result.user.displayName || 'Pengguna',
      photoURL: result.user.photoURL || '',
      lastLogin: new Date().toISOString(),
    };
    
    if (existsIdx > -1) {
      loggedInUsers[existsIdx] = userInfo;
    } else {
      loggedInUsers.push(userInfo);
    }
    localStorage.setItem('sps_logged_in_users', JSON.stringify(loggedInUsers));

    sessionStorage.setItem('sps_auth_user', JSON.stringify(currentAppUser));
    await syncUserToFirestore(currentAppUser);

    return { user: result.user, accessToken: resolvedAccessToken };
  } catch (error: any) {
    console.error('Sign in error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  if (auth.currentUser) {
    try {
      return await auth.currentUser.getIdToken();
    } catch (err) {
      console.error('[DEBUG AUTH] Gagal mendapatkan token dari currentUser:', err);
      return null;
    }
  }
  return null;
};

export const getCurrentAppUser = (): AppUser | null => {
  const cached = sessionStorage.getItem('sps_auth_user');
  if (cached) {
    try {
      return JSON.parse(cached);
    } catch {
      return currentAppUser;
    }
  }
  return currentAppUser;
};

export const logout = async () => {
  await signOut(auth).catch(() => {});
  currentAppUser = null;
  sessionStorage.removeItem('sps_auth_user');
};
