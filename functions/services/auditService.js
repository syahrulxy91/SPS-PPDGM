/**
 * SPS Cloud Functions - Centralized Audit & Logging Service Layer
 */

const admin = require('firebase-admin');
const { logInfo, logWarn } = require('../utils');
const { LOG_CATEGORIES, AUDIT_EVENT_TYPES } = require('../constants');
const CONFIG = require('../config');
const metricsService = require('./metricsService');

const auditService = {
  /**
   * Logs a file upload event in Firestore auditUploads
   */
  async logUpload({
    user,
    uploadedByEmail,
    uploadedByName,
    unit,
    fileName,
    originalFileName,
    fileSize,
    mimeType,
    driveFileId,
    driveFileUrl,
    userUid,
    userRole,
    eventType,
    uploadStatus = "SUCCESS",
    requestId,
    durationSeconds
  }) {
    const email = uploadedByEmail || (user && user.email) || '';
    const name = uploadedByName || (user && (user.name || user.displayName || user.email)) || '';
    const uid = userUid || (user && user.uid) || '';
    const role = userRole || (user && (user.appRole || (user.email === CONFIG.security.SUPER_ADMIN_EMAIL ? 'SUPER_ADMIN' : 'USER'))) || 'USER';

    try {
      await admin.firestore().collection('auditUploads').add({
        eventType: eventType || AUDIT_EVENT_TYPES.UPLOAD,
        uploadedByEmail: email,
        uploadedByName: name,
        unit: unit,
        fileName: fileName,
        fileSize: fileSize,
        mimeType: mimeType,
        uploadTimestamp: admin.firestore.FieldValue.serverTimestamp(),
        driveFileId: driveFileId,
        driveFileUrl: driveFileUrl,
        uploadStatus: uploadStatus,
        userUid: uid,
        userRole: role,
        originalFileName: originalFileName || fileName,
        requestId: requestId || ''
      });
      logInfo(LOG_CATEGORIES.AUDIT, requestId, `Rekod auditUploads berjaya disimpan bagi fail "${fileName}".`);

      // Trigger server-side metrics updates
      if (uploadStatus === "SUCCESS") {
        metricsService.recordUpload({
          fileSize: fileSize || 0,
          durationSeconds: durationSeconds || 1.8,
          email,
          requestId
        }).catch(err => {
          logWarn(LOG_CATEGORIES.AUDIT, requestId, 'Gagal merekod metrik muat naik berjaya', err);
        });
      } else {
        metricsService.recordFailedUpload({
          email,
          requestId
        }).catch(err => {
          logWarn(LOG_CATEGORIES.AUDIT, requestId, 'Gagal merekod metrik muat naik gagal', err);
        });
      }

    } catch (auditError) {
      logWarn(LOG_CATEGORIES.AUDIT, requestId, 'Graceful Degradation: Gagal menyimpan rekod audit ke Firestore', auditError);
      // Suppress error to avoid disrupting business operations
    }
  },

  /**
   * Logs a security or role change event in Firestore securityLogs
   */
  async logSecurity({
    eventType,
    performedBy,
    targetUser,
    oldRole,
    newRole,
    status,
    requestId,
    ...extra
  }) {
    try {
      const logData = {
        eventType,
        performedBy: performedBy || '',
        targetUser: targetUser || '',
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        status: status || 'SUCCESS',
        requestId: requestId || '',
        ...extra
      };
      if (oldRole) logData.oldRole = oldRole;
      if (newRole) logData.newRole = newRole;

      await admin.firestore().collection('securityLogs').add(logData);
      logInfo(LOG_CATEGORIES.AUDIT, requestId, `Security log "${eventType}" berjaya ditulis ke Firestore.`);

      // If this is a rate limit event, update rate limit metrics
      if (eventType === 'RATE_LIMIT') {
        metricsService.recordRateLimit({
          email: performedBy || targetUser || '',
          requestId
        }).catch(err => {
          logWarn(LOG_CATEGORIES.AUDIT, requestId, 'Gagal merekod metrik rate limit', err);
        });
      }

    } catch (auditError) {
      logWarn(LOG_CATEGORIES.AUDIT, requestId, 'Graceful Degradation: Gagal menulis security log ke Firestore', auditError);
      // Suppress error to avoid disrupting business operations
    }
  },

  /**
   * Dedicated rate limit logging helper (calls logSecurity under-the-hood)
   */
  async logRateLimit({ performedBy, targetUser, status, requestId, ...extra }) {
    return this.logSecurity({
      eventType: 'RATE_LIMIT',
      performedBy,
      targetUser,
      status: status || 'BLOCKED',
      requestId,
      ...extra
    });
  },

  /**
   * Logs actions performed by users (e.g., DELETE, DOWNLOAD, LOGIN, LOGOUT)
   */
  async logUserAction({ eventType, performedBy, targetUser, details, status, requestId }) {
    try {
      const logData = {
        eventType: eventType || 'USER_ACTION',
        performedBy: performedBy || '',
        targetUser: targetUser || performedBy || '',
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        details: details || {},
        status: status || 'SUCCESS',
        requestId: requestId || ''
      };
      await admin.firestore().collection('userActionLogs').add(logData);
      logInfo(LOG_CATEGORIES.AUDIT, requestId, `User action log "${eventType}" berjaya ditulis ke Firestore.`);

      // Trigger metrics update for user actions
      const userEmail = performedBy || targetUser || '';
      if (eventType === 'DELETE') {
        metricsService.recordDelete({ email: userEmail, requestId }).catch(() => {});
      } else if (eventType === 'DOWNLOAD') {
        metricsService.recordDownload({ email: userEmail, requestId }).catch(() => {});
      } else if (eventType === 'LOGIN') {
        metricsService.recordLogin({ email: userEmail, requestId }).catch(() => {});
      } else if (eventType === 'LOGOUT') {
        metricsService.recordLogout({ email: userEmail, requestId }).catch(() => {});
      }

    } catch (err) {
      logWarn(LOG_CATEGORIES.AUDIT, requestId, 'Gagal menulis user action log ke Firestore', err);
    }
  },

  /**
   * Logs system incidents (e.g., warnings, errors, drive connection issues)
   */
  async logSystem({ eventType, message, details, requestId }) {
    try {
      const logData = {
        eventType: eventType || 'SYSTEM_INFO',
        message: message || '',
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        details: details || {},
        requestId: requestId || ''
      };
      await admin.firestore().collection('systemLogs').add(logData);
      logInfo(LOG_CATEGORIES.AUDIT, requestId, `System log "${eventType}" berjaya ditulis ke Firestore.`);
    } catch (err) {
      logWarn(LOG_CATEGORIES.AUDIT, requestId, 'Gagal menulis system log ke Firestore', err);
    }
  }
};

module.exports = auditService;
