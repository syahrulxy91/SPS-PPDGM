/**
 * SPS Cloud Functions - Utilities and Helpers
 */

const crypto = require('crypto');
const admin = require('firebase-admin');
const { AsyncLocalStorage } = require('async_hooks');
const { LOG_CATEGORIES, HTTP_STATUS, ERROR_CODES } = require('../constants');
const CONFIG = require('../config');

// AsyncLocalStorage context for end-to-end tracing
const requestContextStore = new AsyncLocalStorage();

/**
 * Generates a unique Request ID in the standard format REQ-YYYYMMDD-XXXXXXXX
 */
function generateRequestId() {
  const d = new Date();
  // Adjust UTC to Malaysia Time (UTC+8)
  const localTime = new Date(d.getTime() + (8 * 60 * 60 * 1000));
  const yyyy = localTime.getUTCFullYear();
  const mm = String(localTime.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(localTime.getUTCDate()).padStart(2, '0');
  const randomHex = crypto.randomBytes(4).toString('hex').toUpperCase();
  return `REQ-${yyyy}${mm}${dd}-${randomHex}`;
}

/**
 * Generates a unique Correlation ID in the format CORR-YYYYMMDD-XXXXXXXXXXXX
 */
function generateCorrelationId() {
  const d = new Date();
  const localTime = new Date(d.getTime() + (8 * 60 * 60 * 1000));
  const yyyy = localTime.getUTCFullYear();
  const mm = String(localTime.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(localTime.getUTCDate()).padStart(2, '0');
  const randomHex = crypto.randomBytes(6).toString('hex').toUpperCase();
  return `CORR-${yyyy}${mm}${dd}-${randomHex}`;
}

/**
 * Executes a callback within a specific request context (requestId and correlationId)
 */
function runWithRequestContext(requestId, correlationId, callback) {
  return requestContextStore.run({ requestId, correlationId }, callback);
}

/**
 * Retrieves the current request context from AsyncLocalStorage store
 */
function getRequestContext() {
  return requestContextStore.getStore();
}

/**
 * Enterprise standard structured logger with built-in Correlation ID propagation
 */
function logWithLevel(level, category, requestId, message, details = '') {
  const context = requestContextStore.getStore();
  const currentRequestId = requestId || (context ? context.requestId : 'SYSTEM');
  const correlationId = context ? context.correlationId : 'N/A';

  const allowedCategories = Object.values(LOG_CATEGORIES);
  let cat = category;
  if (!cat.startsWith('[')) cat = `[${cat}`;
  if (!cat.endsWith(']')) cat = `${cat}]`;
  if (!allowedCategories.includes(cat)) {
    cat = LOG_CATEGORIES.SYSTEM;
  }
  const detailStr = details ? ` | Details: ${typeof details === 'object' ? JSON.stringify(details) : details}` : '';
  const logStr = `${cat}[${currentRequestId}][CORR: ${correlationId}] ${message}${detailStr}`;
  if (level === 'error') {
    console.error(logStr);
  } else if (level === 'warn') {
    console.warn(logStr);
  } else {
    console.log(logStr);
  }
}

function logInfo(category, requestId, message, details = '') {
  logWithLevel('info', category, requestId, message, details);
}

function logWarn(category, requestId, message, details = '') {
  logWithLevel('warn', category, requestId, message, details);
}

function logError(category, requestId, message, details = '') {
  logWithLevel('error', category, requestId, message, details);
}

/**
 * Enterprise Standard success response
 * Automatically merges the data fields onto the root level of the response object
 * to preserve 100% backward compatibility with client expectations (e.g., result.id, result.url)
 */
function sendSuccess(res, requestId, category, message, data = {}, status = HTTP_STATUS.OK) {
  logInfo(category, requestId, `Response SUCCESS: ${message}`);
  return res.status(status).json({
    success: true,
    requestId: requestId,
    message: message,
    data: data,
    ...data
  });
}

/**
 * Enterprise Standard error response
 */
function sendError(res, requestId, category, status, code, message) {
  const { classifyError, isErrorRetryable } = require('./errorHelper');
  const classification = classifyError(status, code);
  const retryable = isErrorRetryable(status, code);
  const context = requestContextStore.getStore();
  const correlationId = context ? context.correlationId : 'N/A';
  const email = context ? context.email : '';

  logWarn(category, requestId, `Response ERROR: [${code}] [${classification}] [Retryable: ${retryable}] [Correlation: ${correlationId}] ${message}`);

  // Automatically record security incidents and drive failures based on classification / codes
  try {
    const { ERROR_CLASSIFICATIONS, ERROR_CODES } = require('../constants');
    const metricsService = require('../services/metricsService');

    if (classification === ERROR_CLASSIFICATIONS.SECURITY) {
      metricsService.recordSecurityIncident({ email, requestId }).catch(() => {});
    } else if (
      code === ERROR_CODES.GOOGLE_DRIVE_UNAVAILABLE ||
      code === ERROR_CODES.GOOGLE_DRIVE_TIMEOUT ||
      code === ERROR_CODES.UPLOAD_FAILED
    ) {
      metricsService.recordDriveFailure({ email, requestId }).catch(() => {});
    }
  } catch (err) {
    // Suppress potential failures during metrics recording inside sendError
  }

  return res.status(status).json({
    success: false,
    requestId: requestId,
    correlationId: correlationId,
    code: code,
    classification: classification,
    retryable: retryable,
    message: message
  });
}

/**
 * Authenticate Firebase Token and extract decoded user info
 */
async function authenticateUser(req, res, requestId) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    logWarn(LOG_CATEGORIES.AUTH, requestId, 'Pemberian token pengesahan (Bearer Token) tidak ditemui.');
    sendError(res, requestId, LOG_CATEGORIES.AUTH, HTTP_STATUS.UNAUTHORIZED, ERROR_CODES.AUTH_REQUIRED, 'Pemberian token pengesahan (Bearer Token) tidak ditemui.');
    return null;
  }

  const idToken = authHeader.split('Bearer ')[1];
  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    logInfo(LOG_CATEGORIES.AUTH, requestId, `Token successfully verified for: ${decodedToken.email}`);
    
    // Enrich the current request context with user info
    const context = requestContextStore.getStore();
    if (context) {
      context.email = decodedToken.email || '';
      context.uid = decodedToken.uid || '';
    }

    return decodedToken;
  } catch (error) {
    logError(LOG_CATEGORIES.AUTH, requestId, 'Ralat semasa memproses verifikasi token id', error);
    sendError(res, requestId, LOG_CATEGORIES.AUTH, HTTP_STATUS.FORBIDDEN, ERROR_CODES.AUTH_INVALID, 'Token pengesahan tidak sah atau sudah tamat tempoh.');
    return null;
  }
}

/**
 * Role checks mimicking firestore.rules
 */
function isMoeEmail(email) {
  return email && email.toLowerCase().endsWith('@moe.gov.my');
}

function isSuperAdminUser(decodedToken) {
  const email = decodedToken.email || '';
  const role = decodedToken.appRole || '';
  return role === 'SUPER_ADMIN' || email.toLowerCase() === CONFIG.security.SUPER_ADMIN_EMAIL.toLowerCase();
}

function isAdminUser(decodedToken) {
  const role = decodedToken.appRole || '';
  return isSuperAdminUser(decodedToken) || role === 'ADMIN';
}

function isNormalUser(decodedToken) {
  const role = decodedToken.appRole || '';
  const email = decodedToken.email || '';
  return isAdminUser(decodedToken) || role === 'USER' || isMoeEmail(email);
}

/**
 * Standardized Authorization helpers
 */
function authorizeUser(decodedToken, res, requestId) {
  if (!isNormalUser(decodedToken)) {
    logWarn(LOG_CATEGORIES.RBAC, requestId, `Akses disekat: Domain e-mel anda tidak dibenarkan mengakses fungsi ini. Email: ${decodedToken.email}`);
    sendError(res, requestId, LOG_CATEGORIES.RBAC, HTTP_STATUS.FORBIDDEN, ERROR_CODES.FORBIDDEN, 'Akses disekat: Domain e-mel anda tidak dibenarkan mengakses fungsi ini.');
    return false;
  }
  logInfo(LOG_CATEGORIES.RBAC, requestId, `Otorisasi lulus (USER) bagi e-mel: ${decodedToken.email}`);
  return true;
}

function authorizeAdmin(decodedToken, res, requestId) {
  if (!isAdminUser(decodedToken)) {
    logWarn(LOG_CATEGORIES.RBAC, requestId, `Akses disekat: Hanya Admin dibenarkan mengakses fungsi ini. Email: ${decodedToken.email}`);
    sendError(res, requestId, LOG_CATEGORIES.RBAC, HTTP_STATUS.FORBIDDEN, ERROR_CODES.FORBIDDEN, 'Akses disekat: Hanya Admin dibenarkan mengakses fungsi ini.');
    return false;
  }
  logInfo(LOG_CATEGORIES.RBAC, requestId, `Otorisasi lulus (ADMIN) bagi e-mel: ${decodedToken.email}`);
  return true;
}

function authorizeSuperAdmin(decodedToken, res, requestId) {
  if (!isSuperAdminUser(decodedToken)) {
    logWarn(LOG_CATEGORIES.RBAC, requestId, `Akses disekat: Hanya Super Admin dibenarkan mengakses fungsi ini. Email: ${decodedToken.email}`);
    sendError(res, requestId, LOG_CATEGORIES.RBAC, HTTP_STATUS.FORBIDDEN, ERROR_CODES.FORBIDDEN, 'Akses disekat: Hanya Super Admin dibenarkan mengakses fungsi ini.');
    return false;
  }
  logInfo(LOG_CATEGORIES.RBAC, requestId, `Otorisasi lulus (SUPER_ADMIN) bagi e-mel: ${decodedToken.email}`);
  return true;
}

/**
 * Input validation helpers (Delegated to centralized Validator Layer)
 */
function validateFile(fileName, mimeType, fileBufferLength, requestId) {
  const { uploadValidator } = require('../validators');
  try {
    uploadValidator.validateUploadFile(fileName, mimeType, fileBufferLength);
    return { valid: true };
  } catch (err) {
    return {
      valid: false,
      code: err.code || 'BAD_REQUEST',
      status: err.status || HTTP_STATUS.BAD_REQUEST,
      message: err.message
    };
  }
}

/**
 * Enterprise Rate Limiting (RBAC Aware)
 * Uses a 60-second sliding/fixed window stored in 'rateLimits' collection.
 * Limit rules:
 * - USER: upload=20, delete=10, manageUsers=0
 * - ADMIN: upload=50, delete=30, manageUsers=0
 * - SUPER_ADMIN: upload=100, delete=100, manageUsers=30
 */
async function checkRateLimit({ req, res, user, functionName, requestId }) {
  if (!user) {
    return true; // Handled by auth layer
  }

  const uid = user.uid || '';
  const email = user.email || '';

  // Determine user role
  let role = 'USER';
  if (isSuperAdminUser(user)) {
    role = 'SUPER_ADMIN';
  } else if (isAdminUser(user)) {
    role = 'ADMIN';
  }

  const { RATE_LIMITS } = CONFIG.security;

  const limit = RATE_LIMITS[role] && RATE_LIMITS[role][functionName] !== undefined
    ? RATE_LIMITS[role][functionName]
    : 0;

  const docId = `${uid}_${functionName}`;
  const docRef = admin.firestore().collection('rateLimits').doc(docId);

  try {
    const now = new Date();
    const nowMs = now.getTime();
    let windowStart = now;
    let count = 1;

    // 1. ONE Firestore Read
    const docSnap = await docRef.get();

    if (docSnap.exists) {
      const data = docSnap.data();
      const dbWindowStart = data.windowStart;
      if (dbWindowStart) {
        const dbWindowStartMs = typeof dbWindowStart.toMillis === 'function'
          ? dbWindowStart.toMillis()
          : new Date(dbWindowStart).getTime();

        if (nowMs - dbWindowStartMs < 60000) {
          // Inside 60-second window
          windowStart = dbWindowStart.toDate ? dbWindowStart.toDate() : new Date(dbWindowStart);
          count = (data.count || 0) + 1;
        }
      }
    }

    // 2. ONE Firestore Write
    await docRef.set({
      uid: uid,
      function: functionName,
      windowStart: windowStart,
      count: count,
      lastRequest: now
    });

    // Check limit exceeded
    if (count > limit) {
      // Log to console with [SECURITY] category
      logWarn(LOG_CATEGORIES.SECURITY, requestId, 'Rate limit exceeded', {
        uid,
        email,
        role,
        function: functionName,
        count,
        requestId
      });

      // Write to Firestore securityLogs collection via AuditService
      try {
        const auditService = require('../services/auditService');
        await auditService.logRateLimit({
          performedBy: email,
          targetUser: email,
          status: 'BLOCKED',
          requestId: requestId,
          uid: uid,
          role: role,
          function: functionName,
          count: count
        });
      } catch (logErr) {
        logWarn(LOG_CATEGORIES.SECURITY, requestId, 'Gagal menulis securityLogs untuk RATE_LIMIT', logErr);
      }

      // Return HTTP 429 Response
      res.status(HTTP_STATUS.TOO_MANY_REQUESTS).json({
        success: false,
        code: ERROR_CODES.RATE_LIMIT,
        message: 'Terlalu banyak permintaan. Sila cuba semula sebentar lagi.'
      });
      return false;
    }

    return true;
  } catch (err) {
    logError(LOG_CATEGORIES.SECURITY, requestId, 'Ralat semasa memproses rate limiting', err);
    // On error, let the request proceed to ensure system availability
    return true;
  }
}

const circuitBreaker = require('./circuitBreaker');

module.exports = {
  generateRequestId,
  generateCorrelationId,
  runWithRequestContext,
  getRequestContext,
  logInfo,
  logWarn,
  logError,
  sendSuccess,
  sendError,
  authenticateUser,
  authorizeUser,
  authorizeAdmin,
  authorizeSuperAdmin,
  validateFile,
  isSuperAdminUser,
  isAdminUser,
  isNormalUser,
  checkRateLimit,
  circuitBreaker
};
