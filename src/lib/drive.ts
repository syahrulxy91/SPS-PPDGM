// Google Drive Sektor Pengurusan Sekolah Provider (Real Production Connector Mode)
// This file coordinates folder discovery from Firestore and communicates with the trusted Cloud Functions backend.
import { getGoogleDriveConfigSync, auth } from './firebase';

// Read the Cloud Functions Base URL from Vite environment or default to the regional endpoint of the project
const CLOUD_FUNCTIONS_BASE_URL = (import.meta as any).env?.VITE_CLOUD_FUNCTIONS_URL || 'https://us-central1-spsppdgm.cloudfunctions.net';

/**
 * Retrieves the Google Drive root folder ID stored securely in the Firestore configuration.
 */
export function getRootFolderName(): string {
  const config = getGoogleDriveConfigSync();
  return config.googleDriveRootFolderId;
}

/**
 * Retrieves the Google Drive unit folder map. 
 * Reads directly from Firestore (the single source of truth) to avoid un-synchronized localStorage states.
 */
export function getUnitFolderNames(): Record<string, string> {
  const config = getGoogleDriveConfigSync();
  if (config && config.unitFolders && Object.keys(config.unitFolders).length > 0) {
    return config.unitFolders;
  }
  
  // Return the default unit mapping as defined by the application schema if Firestore is offline
  return {
    'UNIT PRASEKOLAH': 'UNIT_PRASEKOLAH',
    'UNIT RENDAH': 'UNIT_RENDAH',
    'UNIT MENENGAH & TINGKATAN 6': 'UNIT_MENENGAH',
    'UNIT SWASTA': 'UNIT_SWASTA',
    'UNIT SIP+': 'SIP',
    'RUJUKAN_BERSAMA': 'RUJUKAN_BERSAMA'
  };
}

let cachedDriveFolders: { rootFolderId: string; folderMap: Record<string, string> } | null = null;

export function resetDriveFoldersCache() {
  cachedDriveFolders = null;
}

/**
 * Initializes and maps the folder configurations.
 * Always resolves coordinates using the active cloud configuration.
 */
export async function initDriveFolders() {
  if (cachedDriveFolders) return cachedDriveFolders;

  const folderNames = getUnitFolderNames();
  const folderMap: Record<string, string> = {};

  const foldersToFind = Object.keys(folderNames);
  for (const f of foldersToFind) {
    // Map unit keys to the respective Cloud/Drive folder ID stored in configuration
    folderMap[f] = folderNames[f];
  }

  cachedDriveFolders = {
    rootFolderId: getGoogleDriveConfigSync().googleDriveRootFolderId,
    folderMap
  };
  return cachedDriveFolders;
}

/**
 * Handles real-production upload requests to Google Drive via secure Cloud Functions backend.
 * Verification token is automatically passed to verify the identity of the user.
 */
export async function uploadFileToDrive(file: File, unit: string): Promise<{ id: string; url: string; size: number }> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error("Pengguna tidak log masuk. Sila log masuk terlebih dahulu untuk memuat naik fail.");
  }

  try {
    // Retrieve the active Firebase ID token securely for server-side verification
    const idToken = await currentUser.getIdToken(true);

    // Build the multipart/form-data payload with the binary file
    const formData = new FormData();
    formData.append('file', file);
    formData.append('unit', unit);

    // Generate a unique upload token for idempotency
    const uploadToken = typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
          const r = Math.random() * 16 | 0;
          const v = c === 'x' ? r : (r & 0x3 | 0x8);
          return v.toString(16);
        });

    console.log(`[STORAGE] Memulakan muat naik fail "${file.name}" (Saiz: ${file.size} bait) bagi unit "${unit}" ke Google Drive dengan Token: ${uploadToken}...`);

    // Call the production Cloud Function endpoint
    const response = await fetch(`${CLOUD_FUNCTIONS_BASE_URL}/uploadToGoogleDrive`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${idToken}`,
        'X-Upload-Token': uploadToken
      },
      body: formData
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = errorText;
      try {
        const parsed = JSON.parse(errorText);
        if (parsed && parsed.message) {
          errorMessage = parsed.message;
        }
      } catch (e) {
        // Not a JSON response
      }
      throw new Error(errorMessage || response.statusText);
    }

    const result = await response.json();
    if (!result.id || !result.url) {
      throw new Error("Respon pelayan tidak sah: Parameter metadata 'id' atau 'url' didapati kosong.");
    }

    console.log(`[STORAGE] Fail "${file.name}" berjaya disimpan di Google Drive dengan ID: ${result.id}`);
    return {
      id: result.id,
      url: result.url,
      size: result.size || file.size
    };

  } catch (error: any) {
    console.error(`[UPLOAD ERROR] Gagal memuat naik fail "${file.name}" ke Google Drive:`, error);
    throw new Error(
      `Sambungan Google Drive Gagal: ${error.message || "Masalah sambungan pelayan atau Cloud Function belum aktif."}`
    );
  }
}

/**
 * Deletes a file from Google Drive via the secure Cloud Functions backend.
 */
export async function deleteFileFromDrive(fileId: string): Promise<void> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error("Pengguna tidak log masuk. Tidak dibenarkan memadam fail.");
  }

  try {
    const idToken = await currentUser.getIdToken(true);

    console.log(`[STORAGE] Memadam fail ID "${fileId}" daripada Google Drive...`);

    const response = await fetch(`${CLOUD_FUNCTIONS_BASE_URL}/deleteFromGoogleDrive`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${idToken}`
      },
      body: JSON.stringify({ fileId })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Ralat Server (${response.status}): ${errorText || response.statusText}`);
    }

    console.log(`[STORAGE] Fail ID "${fileId}" berjaya dipadam daripada Google Drive.`);
  } catch (error: any) {
    console.error(`[DELETE ERROR] Gagal memadam fail dari Google Drive:`, error);
    throw new Error(
      `Pemadaman Google Drive Gagal: ${error.message || "Masalah sambungan pelayan."}`
    );
  }
}
