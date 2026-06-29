/**
 * SPS Cloud Functions - Common Validator Helpers
 */

const { HTTP_STATUS, ERROR_CODES } = require('../constants');

class AppError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    
    // Normalize legacy code strings to centralized error constants
    let normalizedCode = code;
    if (code === 'BAD_REQUEST') {
      normalizedCode = (ERROR_CODES && ERROR_CODES.INVALID_REQUEST) || 'INVALID_REQUEST';
    } else if (code === 'METHOD_NOT_ALLOWED') {
      normalizedCode = (ERROR_CODES && ERROR_CODES.INVALID_REQUEST) || 'INVALID_REQUEST';
    } else if (code === 'PAYLOAD_TOO_LARGE') {
      normalizedCode = (ERROR_CODES && ERROR_CODES.FILE_TOO_LARGE) || 'FILE_TOO_LARGE';
    } else if (code === 'FORBIDDEN') {
      normalizedCode = (ERROR_CODES && ERROR_CODES.FORBIDDEN) || 'FORBIDDEN';
    } else if (code === 'UNAUTHORIZED') {
      normalizedCode = (ERROR_CODES && ERROR_CODES.AUTH_REQUIRED) || 'AUTH_REQUIRED';
    }
    
    this.code = normalizedCode;
    this.name = 'AppError';
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Validates that a value is not null, undefined, or empty.
 */
function validateRequired(value, fieldName, customMessage = null) {
  if (value === undefined || value === null || (typeof value === 'string' && value.trim() === '')) {
    throw new AppError(
      HTTP_STATUS.BAD_REQUEST,
      'BAD_REQUEST',
      customMessage || `Parameter "${fieldName}" diperlukan.`
    );
  }
  return true;
}

/**
 * Validates that a value is of type string.
 */
function validateString(value, fieldName) {
  if (typeof value !== 'string') {
    throw new AppError(
      HTTP_STATUS.BAD_REQUEST,
      'BAD_REQUEST',
      `Parameter "${fieldName}" mestilah dalam format teks (string).`
    );
  }
  return true;
}

/**
 * Validates that a value belongs to a specified list of allowed values.
 */
function validateEnum(value, allowedValues, fieldName, customMessage = null) {
  if (!allowedValues.includes(value)) {
    throw new AppError(
      HTTP_STATUS.BAD_REQUEST,
      'BAD_REQUEST',
      customMessage || `Parameter "${fieldName}" tidak sah.`
    );
  }
  return true;
}

/**
 * Validates that a value is a valid email format.
 */
function validateEmail(email, fieldName = 'email') {
  validateRequired(email, fieldName);
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    throw new AppError(
      HTTP_STATUS.BAD_REQUEST,
      'BAD_REQUEST',
      `Format e-mel bagi "${fieldName}" tidak sah.`
    );
  }
  return true;
}

/**
 * Validates length of string.
 */
function validateLength(value, min, max, fieldName) {
  if (typeof value === 'string') {
    if (min !== null && value.length < min) {
      throw new AppError(
        HTTP_STATUS.BAD_REQUEST,
        'BAD_REQUEST',
        `Parameter "${fieldName}" terlalu pendek (min: ${min} aksara).`
      );
    }
    if (max !== null && value.length > max) {
      throw new AppError(
        HTTP_STATUS.BAD_REQUEST,
        'BAD_REQUEST',
        `Parameter "${fieldName}" terlalu panjang (max: ${max} aksara).`
      );
    }
  }
  return true;
}

/**
 * Validates the HTTP request method.
 */
function validateRequestMethod(req, expectedMethod) {
  if (req.method !== expectedMethod) {
    throw new AppError(
      HTTP_STATUS.METHOD_NOT_ALLOWED,
      'METHOD_NOT_ALLOWED',
      `Kaedah HTTP tidak dibenarkan. Sila gunakan kaedah ${expectedMethod}.`
    );
  }
  return true;
}

/**
 * Validates that request body is present and not empty.
 */
function validateRequestBody(req) {
  if (!req.body || Object.keys(req.body).length === 0) {
    throw new AppError(
      HTTP_STATUS.BAD_REQUEST,
      'BAD_REQUEST',
      'Kandungan permintaan (request body) kosong atau tidak lengkap.'
    );
  }
  return true;
}

module.exports = {
  AppError,
  validateRequired,
  validateString,
  validateEnum,
  validateEmail,
  validateLength,
  validateRequestMethod,
  validateRequestBody
};
