/**
 * SPS Cloud Functions - Google Drive Validator Layer
 */

const CONFIG = require('../config');
const { HTTP_STATUS } = require('../constants');
const { AppError } = require('./commonValidator');

/**
 * Validates that the requested unit has a mapped Google Drive folder
 */
function validateDriveFolder(unit) {
  if (!CONFIG.drive.DRIVE_FOLDERS[unit]) {
    throw new AppError(
      HTTP_STATUS.FORBIDDEN,
      'FORBIDDEN',
      `Akses disekat: Unit "${unit}" tidak sah.`
    );
  }
  return true;
}

/**
 * Validates the Google Drive file ID
 */
function validateDriveFileId(fileId) {
  if (!fileId) {
    throw new AppError(
      HTTP_STATUS.BAD_REQUEST,
      'BAD_REQUEST',
      'Parameter "fileId" diperlukan untuk memadam fail.'
    );
  }
  if (typeof fileId !== 'string' || fileId.trim() === '') {
    throw new AppError(
      HTTP_STATUS.BAD_REQUEST,
      'BAD_REQUEST',
      'Parameter "fileId" mestilah rentetan teks yang sah.'
    );
  }
  return true;
}

/**
 * Validates a request to delete a file from Google Drive
 */
function validateDriveDeleteRequest(fileId) {
  validateDriveFileId(fileId);
  return true;
}

module.exports = {
  validateDriveFolder,
  validateDriveFileId,
  validateDriveDeleteRequest
};
