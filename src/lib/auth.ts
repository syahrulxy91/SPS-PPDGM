import { signInWithPopup, GoogleAuthProvider, onAuthStateChanged, User, signOut } from 'firebase/auth';
import { auth } from './firebase';
import { AppUser, UserRole, Unit } from '../types';

const provider = new GoogleAuthProvider();

let isSigningIn = false;
let cachedAccessToken: string | null = sessionStorage.getItem('sps_auth_token') || null;
let currentAppUser: AppUser | null = sessionStorage.getItem('sps_auth_user') ? JSON.parse(sessionStorage.getItem('sps_auth_user')!) : null;

export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        cachedAccessToken = null;
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Failed to get access token from Firebase Auth');
    }

    cachedAccessToken = credential.accessToken;
    const email = result.user.email || 'unknown@example.com';
    const emailLower = email.toLowerCase();
    
    // Default role and unit
    let role: UserRole = 'PEMERHATI';
    let assignedUnit: Unit | undefined = undefined;

    // WAJIB tetapkan hanya email syahrulxy91@gmail.com sebagai superadmin utama
    if (emailLower === 'syahrulxy91@gmail.com') {
      role = 'SUPER ADMIN';
    } else {
      // Semak konfigurasi role-assign daripada localStorage
      const savedRoles = localStorage.getItem('sps_role_assignments');
      if (savedRoles) {
        const assignments = JSON.parse(savedRoles);
        if (assignments[emailLower]) {
          role = assignments[emailLower].role;
          assignedUnit = assignments[emailLower].unit;
        }
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

    // Lepas login selesai, simpan dalam senarai pengguna yang berjaya login untuk tujuan assign role di Super Admin Panel
    const loggedInUsersStr = localStorage.getItem('sps_logged_in_users');
    let loggedInUsers = loggedInUsersStr ? JSON.parse(loggedInUsersStr) : [];
    
    // Periksa jika sudah ada, jika tiada tambah baharu, jika ada kemas kini masa login
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
