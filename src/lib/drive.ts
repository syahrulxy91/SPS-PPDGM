// Local Storage-based Google Drive Simulator
// This completely replaces Google Drive API calls to run locally with zero scopes
import { getCurrentAppUser } from './auth';
import { getGoogleDriveConfigSync } from './firebase';

export function getRootFolderName(): string {
  const config = getGoogleDriveConfigSync();
  return config.googleDriveRootFolderId;
}

export function getUnitFolderNames(): Record<string, string> {
  const custom = localStorage.getItem('sps_drive_unit_folders');
  if (custom) {
    try {
      return JSON.parse(custom);
    } catch (e) {
      // ignore
    }
  }
  return {
    'UNIT_PRASEKOLAH': 'UNIT_PRASEKOLAH',
    'UNIT_RENDAH': 'UNIT_RENDAH',
    'UNIT_MENENGAH': 'UNIT_MENENGAH',
    'UNIT_SWASTA': 'UNIT_SWASTA',
    'SIP': 'SIP',
    'RUJUKAN_BERSAMA': 'RUJUKAN_BERSAMA'
  };
}

let cachedDriveFolders: { rootFolderId: string, folderMap: Record<string, string> } | null = null;

export function resetDriveFoldersCache() {
  cachedDriveFolders = null;
}

export async function initDriveFolders() {
  if (cachedDriveFolders) return cachedDriveFolders;

  const folderNames = getUnitFolderNames();
  const folderMap: Record<string, string> = {};

  const foldersToFind = Object.keys(folderNames);
  for (const f of foldersToFind) {
    folderMap[f] = `mock_folder_id_${f.toLowerCase()}`;
  }

  cachedDriveFolders = {
    rootFolderId: getGoogleDriveConfigSync().googleDriveRootFolderId,
    folderMap
  };
  return cachedDriveFolders;
}

// Keep a session registry of uploaded file blobs to serving dynamic object URLs
const fileBlobsSessionRegistry = new Map<string, File>();

export async function uploadFileToDrive(file: File, parentFolderId: string): Promise<{ id: string; url: string; size: number }> {
  const fileId = 'mock_file_id_' + Math.random().toString(36).substring(7);
  
  // Register the file in-memory so it can be viewed or downloaded during this session
  fileBlobsSessionRegistry.set(fileId, file);
  
  // Create an interactive, temporary download URL
  const objectUrl = URL.createObjectURL(file);

  return {
    id: fileId,
    url: objectUrl,
    size: file.size
  };
}

export async function deleteFileFromDrive(fileId: string) {
  if (fileBlobsSessionRegistry.has(fileId)) {
    const file = fileBlobsSessionRegistry.get(fileId);
    if (file) {
      // no-op, just logging
      console.log(`Mock deleted file ${file.name} from fake Google Drive`);
    }
    fileBlobsSessionRegistry.delete(fileId);
  }
}
