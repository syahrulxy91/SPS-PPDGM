/**
 * SPS Cloud Functions - Upload Validator Layer
 */

const CONFIG = require('../config');
const { HTTP_STATUS } = require('../constants');
const { AppError } = require('./commonValidator');

/**
 * Validates the file size
 */
function validateFileSize(fileBufferLength) {
  if (fileBufferLength > CONFIG.upload.MAX_FILE_SIZE) {
    throw new AppError(
      HTTP_STATUS.PAYLOAD_TOO_LARGE,
      'PAYLOAD_TOO_LARGE',
      'Saiz fail melebihi had maksimum 20MB.'
    );
  }
  return true;
}

/**
 * Validates the filename structure
 */
function validateFilename(fileName) {
  if (!fileName) {
    throw new AppError(
      HTTP_STATUS.BAD_REQUEST,
      'BAD_REQUEST',
      'Fail tidak ditemui dalam permintaan.'
    );
  }
  const parts = fileName.split('.');
  if (parts.length < 2) {
    throw new AppError(
      HTTP_STATUS.BAD_REQUEST,
      'BAD_REQUEST',
      'Nama fail tiada extension atau tidak sah.'
    );
  }
  return true;
}

/**
 * Validates the file extension
 */
function validateExtension(ext) {
  const extLower = (ext || '').toLowerCase();
  if (CONFIG.upload.REJECTED_EXTENSIONS.includes(extLower) || !CONFIG.upload.ALLOWED_EXTENSIONS.includes(extLower)) {
    throw new AppError(
      HTTP_STATUS.BAD_REQUEST,
      'BAD_REQUEST',
      `Jenis fail (.${extLower}) tidak dibenarkan.`
    );
  }
  return true;
}

/**
 * Validates the file mime type
 */
function validateMimeType(mimeType) {
  const mimeLower = (mimeType || '').toLowerCase();
  if (!CONFIG.upload.ALLOWED_MIME_TYPES.includes(mimeLower)) {
    throw new AppError(
      HTTP_STATUS.BAD_REQUEST,
      'BAD_REQUEST',
      `Mime-type "${mimeType}" tidak sah.`
    );
  }
  return true;
}

/**
 * Comprehensive upload file validation
 */
function validateUploadFile(fileName, mimeType, fileBufferLength) {
  if (!fileBufferLength || !fileName) {
    throw new AppError(
      HTTP_STATUS.BAD_REQUEST,
      'BAD_REQUEST',
      'Fail tidak ditemui dalam permintaan.'
    );
  }
  validateFileSize(fileBufferLength);
  validateFilename(fileName);
  
  const parts = fileName.split('.');
  const ext = parts[parts.length - 1].toLowerCase();
  validateExtension(ext);
  validateMimeType(mimeType);
  return true;
}

/**
 * Validates initial upload request payload and parameter
 */
function validateUploadRequest(unit) {
  if (!unit) {
    throw new AppError(
      HTTP_STATUS.BAD_REQUEST,
      'BAD_REQUEST',
      'Parameter unit tidak dinyatakan.'
    );
  }
  return true;
}

module.exports = {
  validateFileSize,
  validateFilename,
  validateExtension,
  validateMimeType,
  validateUploadFile,
  validateUploadRequest
};
