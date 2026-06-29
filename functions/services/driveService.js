/**
 * SPS Cloud Functions - Google Drive Service Layer
 */

const { google } = require('googleapis');
const { Readable } = require('stream');
const CONFIG = require('../config');
const cb = require('../utils/circuitBreaker');
const { getRequestContext } = require('../utils');

/**
 * Initializes and authenticates the Google Drive API client.
 * All google.drive() calls, credentials, and scopes are managed here.
 * 
 * @returns {object} Google Drive client instance
 */
function createDriveClient() {
  const auth = new google.auth.GoogleAuth({
    scopes: [
      'https://www.googleapis.com/auth/drive',
      'https://www.googleapis.com/auth/drive.file'
    ]
  });
  return google.drive({ version: 'v3', auth });
}

/**
 * Normalizes and generates a standardized filename for Google Drive storage.
 * Format: YYYY-MM-DD_HHMMSS_MMM_UNIT_FILENAME.ext
 * 
 * @param {string} originalFileName The uploaded filename
 * @param {string} unit The organizational unit name
 * @returns {string} Standardized filename
 */
function generateDriveFilename(originalFileName, unit) {
  const d = new Date();
  const localTime = new Date(d.getTime() + (8 * 60 * 60 * 1000));
  const yyyy = localTime.getUTCFullYear();
  const mm = String(localTime.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(localTime.getUTCDate()).padStart(2, '0');
  const hh = String(localTime.getUTCHours()).padStart(2, '0');
  const min = String(localTime.getUTCMinutes()).padStart(2, '0');
  const ss = String(localTime.getUTCSeconds()).padStart(2, '0');
  const mmm = String(localTime.getUTCMilliseconds()).padStart(3, '0');
  const datePrefix = `${yyyy}-${mm}-${dd}_${hh}${min}${ss}_${mmm}`;

  const normalizedUnit = unit
    .replace(/[^a-zA-Z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');

  const extIndex = originalFileName.lastIndexOf('.');
  const baseName = extIndex !== -1 ? originalFileName.substring(0, extIndex) : originalFileName;
  const fileExtension = extIndex !== -1 ? originalFileName.substring(extIndex) : '';

  const normalizedBase = baseName
    .replace(/[^a-zA-Z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');

  return `${datePrefix}_${normalizedUnit}_${normalizedBase}${fileExtension}`;
}

/**
 * Builds Google Drive file metadata object.
 * 
 * @param {string} fileName The destination file name on Google Drive
 * @param {string} parentFolderId The ID of the target Google Drive folder
 * @returns {object} Google Drive file metadata
 */
function buildDriveMetadata(fileName, parentFolderId) {
  return {
    name: fileName,
    parents: [parentFolderId]
  };
}

/**
 * Uploads a file buffer to Google Drive.
 * 
 * @param {object} params Parameter object
 * @param {Buffer} params.fileBuffer Buffer containing the file content
 * @param {string} params.mimeType File MIME type
 * @param {string} params.originalFileName original uploaded filename
 * @param {string} params.unit Target unit mapping
 * @returns {Promise<object>} Upload result details
 */
/**
 * Uploads a file buffer to Google Drive.
 * 
 * @param {object} params Parameter object
 * @param {Buffer} params.fileBuffer Buffer containing the file content
 * @param {string} params.mimeType File MIME type
 * @param {string} params.originalFileName original uploaded filename
 * @param {string} params.unit Target unit mapping
 * @returns {Promise<object>} Upload result details
 */
async function uploadFile({ fileBuffer, mimeType, originalFileName, unit }) {
  const context = getRequestContext();
  const requestId = context ? context.requestId : '';

  if (!cb.canExecute(requestId)) {
    const error = new Error('Google Drive service is temporarily unavailable (Circuit Breaker OPEN). Sila cuba sebentar lagi.');
    error.status = 503;
    error.code = 'SERVICE_UNAVAILABLE';
    throw error;
  }

  const generatedFileName = generateDriveFilename(originalFileName, unit);
  const parentFolderId = CONFIG.drive.DRIVE_FOLDERS[unit];
  if (!parentFolderId) {
    throw new Error(`Folder ID untuk unit "${unit}" tidak ditemui.`);
  }

  try {
    const drive = createDriveClient();
    const fileMetadata = buildDriveMetadata(generatedFileName, parentFolderId);

    const media = {
      mimeType: mimeType,
      body: Readable.from(fileBuffer)
    };

    const driveFile = await drive.files.create({
      requestBody: fileMetadata,
      media: media,
      fields: 'id, name, webViewLink, size'
    });

    // Record success in Circuit Breaker
    await cb.recordSuccess(requestId);

    return {
      id: driveFile.data.id,
      url: driveFile.data.webViewLink,
      size: Number(driveFile.data.size) || fileBuffer.length,
      generatedFileName: generatedFileName
    };
  } catch (error) {
    // Record failure in Circuit Breaker
    await cb.recordFailure(requestId);
    throw error;
  }
}

/**
 * Deletes a file from Google Drive.
 * 
 * @param {object} params Parameter object
 * @param {string} params.driveFileId Google Drive File ID to delete
 * @returns {Promise<object>} Status indicating success
 */
async function deleteFile({ driveFileId }) {
  const context = getRequestContext();
  const requestId = context ? context.requestId : '';

  if (!cb.canExecute(requestId)) {
    const error = new Error('Google Drive service is temporarily unavailable (Circuit Breaker OPEN). Sila cuba sebentar lagi.');
    error.status = 503;
    error.code = 'SERVICE_UNAVAILABLE';
    throw error;
  }

  try {
    const drive = createDriveClient();
    await drive.files.delete({
      fileId: driveFileId
    });

    // Record success in Circuit Breaker
    await cb.recordSuccess(requestId);

    return { success: true };
  } catch (error) {
    // Record failure in Circuit Breaker
    await cb.recordFailure(requestId);
    throw error;
  }
}

/**
 * Renames a file on Google Drive.
 * 
 * @param {object} params Parameter object
 * @param {string} params.driveFileId Google Drive File ID
 * @param {string} params.newName The new file name
 * @returns {Promise<object>} Google Drive response data
 */
async function renameFile({ driveFileId, newName }) {
  const context = getRequestContext();
  const requestId = context ? context.requestId : '';

  if (!cb.canExecute(requestId)) {
    const error = new Error('Google Drive service is temporarily unavailable (Circuit Breaker OPEN). Sila cuba sebentar lagi.');
    error.status = 503;
    error.code = 'SERVICE_UNAVAILABLE';
    throw error;
  }

  try {
    const drive = createDriveClient();
    const response = await drive.files.update({
      fileId: driveFileId,
      requestBody: {
        name: newName
      },
      fields: 'id, name'
    });

    // Record success in Circuit Breaker
    await cb.recordSuccess(requestId);

    return response.data;
  } catch (error) {
    // Record failure in Circuit Breaker
    await cb.recordFailure(requestId);
    throw error;
  }
}

module.exports = {
  createDriveClient,
  generateDriveFilename,
  buildDriveMetadata,
  uploadFile,
  deleteFile,
  renameFile
};
