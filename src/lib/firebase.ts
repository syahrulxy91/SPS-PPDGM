import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore, doc, getDoc, setDoc } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

// Centralized Firebase initialization
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Use initializeFirestore with forced long-polling to prevent WebSocket/gRPC streams from being blocked by ad blockers or firewalls (ERR_BLOCKED_BY_CLIENT)
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
});

export const auth = getAuth(app);

// ----- FIRESTORE ERROR HANDLING PROTOCOL -----
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}
// ---------------------------------------------

// Dynamic Google Drive System Settings Interface
export interface GoogleDriveConfig {
  googleDriveEnabled: boolean;
  googleDriveRootFolderId: string;
  updatedBy: string;
}

// Default layout fallback
export const DEFAULT_DRIVE_CONFIG: GoogleDriveConfig = {
  googleDriveEnabled: true,
  googleDriveRootFolderId: '1-Gdkrl8YiQ-pJzi_vSV940qDRv_9OEaH',
  updatedBy: 'syahrulxy91@gmail.com'
};

// Memory cache for sub-millisecond lookups
let cachedConfig: GoogleDriveConfig | null = null;

/**
 * Loads the core Google Drive root folder reference and settings from Firestore.
 * Automatically seeds the document in Firestore if it doesn't exist yet,
 * and maintains a local offline cache in localStorage.
 */
export async function fetchGoogleDriveConfig(): Promise<GoogleDriveConfig> {
  try {
    const docRef = doc(db, 'systemSettings', 'googleDriveConfig');
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const data = docSnap.data();
      const config: GoogleDriveConfig = {
        googleDriveEnabled: data.googleDriveEnabled !== undefined ? Boolean(data.googleDriveEnabled) : true,
        googleDriveRootFolderId: data.googleDriveRootFolderId || DEFAULT_DRIVE_CONFIG.googleDriveRootFolderId,
        updatedBy: data.updatedBy || DEFAULT_DRIVE_CONFIG.updatedBy
      };
      cachedConfig = config;
      localStorage.setItem('sps_central_drive_config', JSON.stringify(config));
      return config;
    } else {
      // Document is missing, let's auto-seed the default
      await setDoc(docRef, DEFAULT_DRIVE_CONFIG);
      cachedConfig = DEFAULT_DRIVE_CONFIG;
      localStorage.setItem('sps_central_drive_config', JSON.stringify(DEFAULT_DRIVE_CONFIG));
      return DEFAULT_DRIVE_CONFIG;
    }
  } catch (error) {
    console.warn('Fallback: Centralized Firestore settings are unavailable or offline. Accessing cached defaults.', error);
    const cached = localStorage.getItem('sps_central_drive_config');
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        cachedConfig = parsed;
        return parsed;
      } catch (e) {
        // ignore parsing error
      }
    }
    cachedConfig = DEFAULT_DRIVE_CONFIG;
    return DEFAULT_DRIVE_CONFIG;
  }
}

/**
 * Returns the Google Drive configuration synchronously.
 * Ideal for synchronous upload hooks, render components, or background file managers.
 */
export function getGoogleDriveConfigSync(): GoogleDriveConfig {
  if (cachedConfig) return cachedConfig;
  const cached = localStorage.getItem('sps_central_drive_config');
  if (cached) {
    try {
      const parsed = JSON.parse(cached);
      cachedConfig = parsed;
      return parsed;
    } catch (e) {
      // ignore parsing error
    }
  }
  return DEFAULT_DRIVE_CONFIG;
}

/**
 * Saves and publishes updates to the Google Drive system configurations.
 * Writes to both Firestore (the single source of truth) and updates the local storage cache.
 */
export async function saveGoogleDriveConfig(config: GoogleDriveConfig): Promise<void> {
  cachedConfig = config;
  localStorage.setItem('sps_central_drive_config', JSON.stringify(config));
  try {
    const docRef = doc(db, 'systemSettings', 'googleDriveConfig');
    await setDoc(docRef, config);
    console.log('Centralized system settings for Google Drive successfully synced with Firestore.');
  } catch (error) {
    console.error('Firestore save failed for systemSettings/googleDriveConfig:', error);
    handleFirestoreError(error, OperationType.WRITE, 'systemSettings/googleDriveConfig');
  }
}
