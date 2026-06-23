import { signInWithPopup, GoogleAuthProvider, onAuthStateChanged, User, signOut, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { auth, db } from './firebase';
import { AppUser, UserRole, Unit } from '../types';
import { getDoc, doc } from 'firebase/firestore';

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
let cachedAccessToken: string | null = sessionStorage.getItem('sps_auth_token') || null;
let currentAppUser: AppUser | null = sessionStorage.getItem('sps_auth_user') ? JSON.parse(sessionStorage.getItem('sps_auth_user')!) : null;

export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    console.log('[DEBUG AUTH] onAuthStateChanged dipanggil. User Firebase:', user?.email, 'auth.currentUser:', auth.currentUser?.email);
    
    if (user) {
      if (!cachedAccessToken) {
        cachedAccessToken = sessionStorage.getItem('sps_auth_token');
      }

      try {
        // Guna dynamic fallback token jika cachedAccessToken tiada (cth: refresh or tab baru)
        const token = cachedAccessToken || (await user.getIdToken());
        cachedAccessToken = token;
        sessionStorage.setItem('sps_auth_token', token);
        console.log('[DEBUG AUTH] Berjaya mengesahkan sesi:', user.email, 'Token diperolehi (panjang):', token?.length);
        if (onAuthSuccess) onAuthSuccess(user, token);
      } catch (err) {
        console.error('[DEBUG AUTH] Gagal mendapatkan token semasa onAuthStateChanged:', err);
        cachedAccessToken = null;
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      console.log('[DEBUG AUTH] Tiada sesi Firebase Auth yang aktif.');
      cachedAccessToken = null;
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

    const credential = GoogleAuthProvider.credentialFromResult(result);
    // Gunakan fallback idToken sekiranya credential Google Access Token null dalam beberapa senario iframe sandbox
    const fallbackIdToken = await result.user.getIdToken(true);
    const resolvedAccessToken = credential?.accessToken || fallbackIdToken;

    if (!resolvedAccessToken) {
      throw new Error('Gagal mendapatkan access token / ID token dari Firebase Auth');
    }

    cachedAccessToken = resolvedAccessToken;
    const email = result.user.email || 'unknown@example.com';
    const emailLower = email.toLowerCase();
    
    // Default role is ADMIN SPS so registered users can do all actions (adds, uploads, etc.)
    let role: UserRole = 'ADMIN SPS';
    let assignedUnit: Unit | undefined = undefined;

    // WAJIB tetapkan hanya email syahrulxy91@gmail.com sebagai superadmin utama
    if (emailLower === 'syahrulxy91@gmail.com') {
      role = 'SUPER ADMIN';
    } else {
      // Check if this email is registered in registeredEmails Firestore collection
      const docRef = doc(db, 'registeredEmails', emailLower);
      const docSnap = await getDoc(docRef);
      if (!docSnap.exists()) {
        // Sign out immediately to prevent stale session
        await signOut(auth).catch(() => {});
        throw new Error('NOT_REGISTERED');
      }
    }

    currentAppUser = {
      uid: result.user.uid,
      name: result.user.displayName || 'Unknown User',
      email: email,
      photoURL: result.user.photoURL || '',
      role: role,
      ...(assignedUnit ? { unit: assignedUnit } : {})
    };

    // Keep logged-in user logging for display in Admin panel (Kakitangan Bersistem)
    const loggedInUsersStr = localStorage.getItem('sps_logged_in_users');
    let loggedInUsers = loggedInUsersStr ? JSON.parse(loggedInUsersStr) : [];
    
    const existsIdx = loggedInUsers.findIndex((u: any) => u.email.toLowerCase() === emailLower);
    const userInfo = {
      email: email,
      name: result.user.displayName || 'Unknown User',
      photoURL: result.user.photoURL || '',
      lastLogin: new Date().toISOString(),
      role: role,
      unit: assignedUnit || ''
    };
    
    if (existsIdx > -1) {
      loggedInUsers[existsIdx] = userInfo;
    } else {
      loggedInUsers.push(userInfo);
    }
    localStorage.setItem('sps_logged_in_users', JSON.stringify(loggedInUsers));

    sessionStorage.setItem('sps_auth_token', cachedAccessToken);
    sessionStorage.setItem('sps_auth_user', JSON.stringify(currentAppUser));

    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error('Sign in error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
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
  cachedAccessToken = null;
  currentAppUser = null;
  sessionStorage.removeItem('sps_auth_token');
  sessionStorage.removeItem('sps_auth_user');
};
