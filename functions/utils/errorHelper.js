/**
 * SPS Cloud Functions - Centralized Error Helper and Decorator
 * Sprint P1 — Enterprise Production Hardening
 */

const ERROR_CODES = require('../constants/errorCodes');
const { ERROR_CLASSIFICATIONS } = require('../constants/errorClassifications');

/**
 * Classifies an error into one of the diagnostic categories.
 * Diagnostics only - does not expose internal class details to the client.
 *
 * @param {Error} error Any error instance
 * @returns {string} Error classification
 */
function classifyError(error) {
  if (!error) return ERROR_CLASSIFICATIONS.PROGRAMMING;

  // If it's a validation/application error
  if (error.name === 'AppError' || error.code) {
    switch (error.code) {
      case ERROR_CODES.AUTH_REQUIRED:
      case ERROR_CODES.AUTH_INVALID:
      case ERROR_CODES.FORBIDDEN:
        return ERROR_CLASSIFICATIONS.SECURITY;
      case ERROR_CODES.RATE_LIMIT:
        return ERROR_CLASSIFICATIONS.SECURITY;
      case ERROR_CODES.INVALID_REQUEST:
      case ERROR_CODES.INVALID_FILE:
      case ERROR_CODES.FILE_TOO_LARGE:
      case ERROR_CODES.FILE_TYPE_NOT_ALLOWED:
        return ERROR_CLASSIFICATIONS.OPERATIONAL;
      case ERROR_CODES.UPLOAD_FAILED:
      case ERROR_CODES.GOOGLE_DRIVE_TIMEOUT:
      case ERROR_CODES.GOOGLE_DRIVE_UNAVAILABLE:
        return ERROR_CLASSIFICATIONS.INFRASTRUCTURE;
      case ERROR_CODES.INTERNAL_ERROR:
        return ERROR_CLASSIFICATIONS.INFRASTRUCTURE;
      default:
        // Check standard fallback mappings
        if (error.status === 401 || error.status === 403) return ERROR_CLASSIFICATIONS.SECURITY;
        if (error.status === 400 || error.status === 404 || error.status === 429) return ERROR_CLASSIFICATIONS.OPERATIONAL;
        return ERROR_CLASSIFICATIONS.INFRASTRUCTURE;
    }
  }

  const message = (error.message || '').toLowerCase();
  
  // Security checks
  if (message.includes('auth') || message.includes('unauthorized') || message.includes('forbidden') || message.includes('permission') || message.includes('token')) {
    return ERROR_CLASSIFICATIONS.SECURITY;
  }
  
  // Infrastructure checks
  if (
    message.includes('timeout') ||
    message.includes('etimedout') ||
    message.includes('deadline') ||
    message.includes('unavailable') ||
    message.includes('connection') ||
    message.includes('network') ||
    message.includes('firestore') ||
    message.includes('database') ||
    message.includes('socket')
  ) {
    return ERROR_CLASSIFICATIONS.INFRASTRUCTURE;
  }

  // Operational checks
  if (message.includes('invalid') || message.includes('validation') || message.includes('required') || message.includes('format')) {
    return ERROR_CLASSIFICATIONS.OPERATIONAL;
  }

  // Programming/system-level errors
  if (error instanceof TypeError || error instanceof ReferenceError || error instanceof SyntaxError) {
    return ERROR_CLASSIFICATIONS.PROGRAMMING;
  }

  return ERROR_CLASSIFICATIONS.PROGRAMMING;
}

/**
 * Determines whether the given error is retryable.
 *
 * @param {Error} error Any error instance
 * @returns {boolean} Whether the error is retryable
 */
function isErrorRetryable(error) {
  if (!error) return false;

  if (error.code) {
    switch (error.code) {
      case ERROR_CODES.GOOGLE_DRIVE_TIMEOUT:
      case ERROR_CODES.GOOGLE_DRIVE_UNAVAILABLE:
      case ERROR_CODES.INTERNAL_ERROR:
        return true;
      case ERROR_CODES.AUTH_REQUIRED:
      case ERROR_CODES.AUTH_INVALID:
      case ERROR_CODES.FORBIDDEN:
      case ERROR_CODES.INVALID_REQUEST:
      case ERROR_CODES.INVALID_FILE:
      case ERROR_CODES.FILE_TOO_LARGE:
      case ERROR_CODES.FILE_TYPE_NOT_ALLOWED:
      case ERROR_CODES.RATE_LIMIT:
      case ERROR_CODES.UPLOAD_FAILED:
        return false;
      default:
        break;
    }
  }

  const message = (error.message || '').toLowerCase();

  // Explicit retry patterns (Google Drive timeout, unavailable, temporary DB issues)
  if (
    message.includes('timeout') ||
    message.includes('etimedout') ||
    message.includes('deadline') ||
    message.includes('503') ||
    message.includes('unavailable') ||
    message.includes('rate limit exceeded') ||
    message.includes('temporary') ||
    message.includes('resource exhausted')
  ) {
    return true;
  }

  return false;
}

module.exports = {
  classifyError,
  isErrorRetryable
};
