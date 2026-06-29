/**
 * SPS Cloud Functions - Centralized Metrics & Aggregations Service
 * Version: 2
 * Handles atomic server-side metrics logging with versioning, traceability, and backward compatibility.
 */

const admin = require('firebase-admin');
const { logInfo, logWarn } = require('../utils');
const { LOG_CATEGORIES } = require('../constants');

/**
 * Returns the current date formatted as daily_YYYY_MM_DD in Malaysian Timezone (UTC+8).
 */
function getDailyDocId() {
  const d = new Date();
  const utc = d.getTime() + (d.getTimezoneOffset() * 60000);
  const myt = new Date(utc + (3600000 * 8));
  
  const year = myt.getFullYear();
  const month = String(myt.getMonth() + 1).padStart(2, '0');
  const day = String(myt.getDate()).padStart(2, '0');
  return `daily_${year}_${month}_${day}`;
}

const metricsService = {
  /**
   * Normalizes a metrics document (global or daily) to ensure all fields are present and typed correctly,
   * providing robust backward compatibility for legacy documents without version, metricsVersion, or trace fields.
   * @param {Object} doc - The raw metrics document from Firestore.
   * @returns {Object} A fully normalized metrics object.
   */
  normalizeMetrics(doc) {
    if (!doc) {
      return {
        version: 1,
        metricsVersion: 0,
        lastEvent: 'INITIALIZED',
        lastEventId: '',
        lastUpdatedBy: 'MetricsService'
      };
    }

    const version = typeof doc.version === 'number' ? doc.version : 1;
    const metricsVersion = typeof doc.metricsVersion === 'number' ? doc.metricsVersion : 0;
    const lastEvent = doc.lastEvent || 'UNKNOWN';
    const lastEventId = doc.lastEventId || '';
    const lastUpdatedBy = doc.lastUpdatedBy || 'MetricsService';

    // Base properties that exist across any metrics document
    const normalized = Object.assign({}, doc, {
      version,
      metricsVersion,
      lastEvent,
      lastEventId,
      lastUpdatedBy
    });

    // If it's a global metrics document (has or should have global fields)
    if ('totalUploads' in doc || 'successfulUploads' in doc || 'failedUploads' in doc || !('uploads' in doc)) {
      normalized.totalUploads = typeof doc.totalUploads === 'number' ? doc.totalUploads : 0;
      normalized.successfulUploads = typeof doc.successfulUploads === 'number' ? doc.successfulUploads : 0;
      normalized.failedUploads = typeof doc.failedUploads === 'number' ? doc.failedUploads : 0;
      normalized.deletedFiles = typeof doc.deletedFiles === 'number' ? doc.deletedFiles : 0;
      normalized.downloadCount = typeof doc.downloadCount === 'number' ? doc.downloadCount : 0;
      normalized.loginCount = typeof doc.loginCount === 'number' ? doc.loginCount : 0;
      normalized.logoutCount = typeof doc.logoutCount === 'number' ? doc.logoutCount : 0;
      normalized.activeUsersToday = typeof doc.activeUsersToday === 'number' ? doc.activeUsersToday : 0;
      normalized.rateLimitEventsToday = typeof doc.rateLimitEventsToday === 'number' ? doc.rateLimitEventsToday : 0;
      normalized.driveFailures = typeof doc.driveFailures === 'number' ? doc.driveFailures : 0;
      normalized.securityIncidents = typeof doc.securityIncidents === 'number' ? doc.securityIncidents : 0;
      normalized.averageUploadSize = typeof doc.averageUploadSize === 'number' ? doc.averageUploadSize : 0;
      normalized.averageUploadDuration = typeof doc.averageUploadDuration === 'number' ? doc.averageUploadDuration : 0;
      normalized.totalUploadSizeSum = typeof doc.totalUploadSizeSum === 'number' ? doc.totalUploadSizeSum : 0;
      normalized.totalUploadDurationSum = typeof doc.totalUploadDurationSum === 'number' ? doc.totalUploadDurationSum : 0;
      normalized.lastUploadTime = doc.lastUploadTime || null;
      normalized.lastUpdated = doc.lastUpdated || null;
    }

    // If it's a daily metrics document (has daily fields)
    if ('uploads' in doc || 'failures' in doc || 'downloads' in doc) {
      normalized.uploads = typeof doc.uploads === 'number' ? doc.uploads : 0;
      normalized.failures = typeof doc.failures === 'number' ? doc.failures : 0;
      normalized.downloads = typeof doc.downloads === 'number' ? doc.downloads : 0;
      normalized.deleted = typeof doc.deleted === 'number' ? doc.deleted : 0;
      normalized.activeUsers = typeof doc.activeUsers === 'number' ? doc.activeUsers : 0;
      normalized.rateLimits = typeof doc.rateLimits === 'number' ? doc.rateLimits : 0;
      normalized.driveFailures = typeof doc.driveFailures === 'number' ? doc.driveFailures : 0;
      normalized.securityIncidents = typeof doc.securityIncidents === 'number' ? doc.securityIncidents : 0;
      normalized.lastUpdated = doc.lastUpdated || null;
    }

    return normalized;
  },

  /**
   * Safe helper to ensure unique active users tracking per day.
   * If the user's email is not in the daily's activeEmails, appends it and increments the counters.
   */
  async trackUserActivity(transaction, dailyRef, globalRef, email) {
    if (!email) return false;
    const emailLower = email.toLowerCase().trim();
    
    const dailySnap = await transaction.get(dailyRef);
    let activeEmails = [];
    if (dailySnap.exists) {
      activeEmails = dailySnap.data().activeEmails || [];
    }
    
    if (!activeEmails.includes(emailLower)) {
      activeEmails.push(emailLower);
      transaction.set(dailyRef, {
        activeEmails,
        activeUsers: activeEmails.length,
        lastUpdated: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
      
      transaction.set(globalRef, {
        activeUsersToday: admin.firestore.FieldValue.increment(1),
        lastUpdated: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
      
      return true;
    }
    return false;
  },

  /**
   * Log a successful upload event
   */
  async recordUpload({ fileSize = 0, durationSeconds = 0, email = '', requestId = '' }) {
    const db = admin.firestore();
    const globalRef = db.collection('systemMetrics').doc('global');
    const dailyDocId = getDailyDocId();
    const dailyRef = db.collection('systemMetrics').doc(dailyDocId);

    try {
      await db.runTransaction(async (transaction) => {
        // Track unique user daily activity
        await this.trackUserActivity(transaction, dailyRef, globalRef, email);

        // Fetch current global counts to compute rolling averages safely
        const globalSnap = await transaction.get(globalRef);
        let globalData = globalSnap.exists ? globalSnap.data() : {};
        
        // Normalize any missing or legacy properties first
        globalData = metricsService.normalizeMetrics(globalData);

        const successfulUploads = (globalData.successfulUploads || 0) + 1;
        const totalUploadSizeSum = (globalData.totalUploadSizeSum || 0) + fileSize;
        const totalUploadDurationSum = (globalData.totalUploadDurationSum || 0) + durationSeconds;

        const averageUploadSize = successfulUploads > 0 ? Math.round(totalUploadSizeSum / successfulUploads) : 0;
        const averageUploadDuration = successfulUploads > 0 ? parseFloat((totalUploadDurationSum / successfulUploads).toFixed(2)) : 0;

        // Atomic update globalMetrics with traceability, incremented metricsVersion, and default versioning
        transaction.set(globalRef, {
          version: 1,
          metricsVersion: admin.firestore.FieldValue.increment(1),
          lastEvent: 'UPLOAD_SUCCESS',
          lastEventId: requestId || '',
          lastUpdatedBy: 'MetricsService',
          totalUploads: admin.firestore.FieldValue.increment(1),
          successfulUploads: admin.firestore.FieldValue.increment(1),
          totalUploadSizeSum: admin.firestore.FieldValue.increment(fileSize),
          totalUploadDurationSum: admin.firestore.FieldValue.increment(durationSeconds),
          averageUploadSize,
          averageUploadDuration,
          lastUploadTime: admin.firestore.FieldValue.serverTimestamp(),
          lastUpdated: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        // Atomic update daily metrics with traceability and version tracking
        transaction.set(dailyRef, {
          version: 1,
          metricsVersion: admin.firestore.FieldValue.increment(1),
          lastEvent: 'UPLOAD_SUCCESS',
          lastEventId: requestId || '',
          lastUpdatedBy: 'MetricsService',
          uploads: admin.firestore.FieldValue.increment(1),
          lastUpdated: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
      });

      logInfo(LOG_CATEGORIES.SYSTEM, requestId, `Metrics updated successfully for successful UPLOAD.`);
    } catch (err) {
      logWarn(LOG_CATEGORIES.SYSTEM, requestId, `Failed to update metrics for UPLOAD: ${err.message}`);
    }
  },

  /**
   * Log a failed upload event
   */
  async recordFailedUpload({ email = '', requestId = '' }) {
    const db = admin.firestore();
    const globalRef = db.collection('systemMetrics').doc('global');
    const dailyDocId = getDailyDocId();
    const dailyRef = db.collection('systemMetrics').doc(dailyDocId);

    try {
      await db.runTransaction(async (transaction) => {
        await this.trackUserActivity(transaction, dailyRef, globalRef, email);

        transaction.set(globalRef, {
          version: 1,
          metricsVersion: admin.firestore.FieldValue.increment(1),
          lastEvent: 'UPLOAD_FAILED',
          lastEventId: requestId || '',
          lastUpdatedBy: 'MetricsService',
          totalUploads: admin.firestore.FieldValue.increment(1),
          failedUploads: admin.firestore.FieldValue.increment(1),
          lastUpdated: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        transaction.set(dailyRef, {
          version: 1,
          metricsVersion: admin.firestore.FieldValue.increment(1),
          lastEvent: 'UPLOAD_FAILED',
          lastEventId: requestId || '',
          lastUpdatedBy: 'MetricsService',
          failures: admin.firestore.FieldValue.increment(1),
          lastUpdated: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
      });
    } catch (err) {
      logWarn(LOG_CATEGORIES.SYSTEM, requestId, `Failed to update metrics for FAILED UPLOAD: ${err.message}`);
    }
  },

  /**
   * Log a file deletion
   */
  async recordDelete({ email = '', requestId = '' }) {
    const db = admin.firestore();
    const globalRef = db.collection('systemMetrics').doc('global');
    const dailyDocId = getDailyDocId();
    const dailyRef = db.collection('systemMetrics').doc(dailyDocId);

    try {
      await db.runTransaction(async (transaction) => {
        await this.trackUserActivity(transaction, dailyRef, globalRef, email);

        transaction.set(globalRef, {
          version: 1,
          metricsVersion: admin.firestore.FieldValue.increment(1),
          lastEvent: 'DELETE',
          lastEventId: requestId || '',
          lastUpdatedBy: 'MetricsService',
          deletedFiles: admin.firestore.FieldValue.increment(1),
          lastUpdated: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        transaction.set(dailyRef, {
          version: 1,
          metricsVersion: admin.firestore.FieldValue.increment(1),
          lastEvent: 'DELETE',
          lastEventId: requestId || '',
          lastUpdatedBy: 'MetricsService',
          deleted: admin.firestore.FieldValue.increment(1),
          lastUpdated: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
      });
    } catch (err) {
      logWarn(LOG_CATEGORIES.SYSTEM, requestId, `Failed to update metrics for DELETE: ${err.message}`);
    }
  },

  /**
   * Log a file download
   */
  async recordDownload({ email = '', requestId = '' }) {
    const db = admin.firestore();
    const globalRef = db.collection('systemMetrics').doc('global');
    const dailyDocId = getDailyDocId();
    const dailyRef = db.collection('systemMetrics').doc(dailyDocId);

    try {
      await db.runTransaction(async (transaction) => {
        await this.trackUserActivity(transaction, dailyRef, globalRef, email);

        transaction.set(globalRef, {
          version: 1,
          metricsVersion: admin.firestore.FieldValue.increment(1),
          lastEvent: 'DOWNLOAD',
          lastEventId: requestId || '',
          lastUpdatedBy: 'MetricsService',
          downloadCount: admin.firestore.FieldValue.increment(1),
          lastUpdated: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        transaction.set(dailyRef, {
          version: 1,
          metricsVersion: admin.firestore.FieldValue.increment(1),
          lastEvent: 'DOWNLOAD',
          lastEventId: requestId || '',
          lastUpdatedBy: 'MetricsService',
          downloads: admin.firestore.FieldValue.increment(1),
          lastUpdated: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
      });
    } catch (err) {
      logWarn(LOG_CATEGORIES.SYSTEM, requestId, `Failed to update metrics for DOWNLOAD: ${err.message}`);
    }
  },

  /**
   * Log a user login event
   */
  async recordLogin({ email = '', requestId = '' }) {
    const db = admin.firestore();
    const globalRef = db.collection('systemMetrics').doc('global');
    const dailyDocId = getDailyDocId();
    const dailyRef = db.collection('systemMetrics').doc(dailyDocId);

    try {
      await db.runTransaction(async (transaction) => {
        await this.trackUserActivity(transaction, dailyRef, globalRef, email);

        transaction.set(globalRef, {
          version: 1,
          metricsVersion: admin.firestore.FieldValue.increment(1),
          lastEvent: 'LOGIN',
          lastEventId: requestId || '',
          lastUpdatedBy: 'MetricsService',
          loginCount: admin.firestore.FieldValue.increment(1),
          lastUpdated: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
      });
    } catch (err) {
      logWarn(LOG_CATEGORIES.SYSTEM, requestId, `Failed to update metrics for LOGIN: ${err.message}`);
    }
  },

  /**
   * Log a user logout event
   */
  async recordLogout({ email = '', requestId = '' }) {
    const db = admin.firestore();
    const globalRef = db.collection('systemMetrics').doc('global');

    try {
      await globalRef.set({
        version: 1,
        metricsVersion: admin.firestore.FieldValue.increment(1),
        lastEvent: 'LOGOUT',
        lastEventId: requestId || '',
        lastUpdatedBy: 'MetricsService',
        logoutCount: admin.firestore.FieldValue.increment(1),
        lastUpdated: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
    } catch (err) {
      logWarn(LOG_CATEGORIES.SYSTEM, requestId, `Failed to update metrics for LOGOUT: ${err.message}`);
    }
  },

  /**
   * Log a rate limiting block event
   */
  async recordRateLimit({ email = '', requestId = '' }) {
    const db = admin.firestore();
    const globalRef = db.collection('systemMetrics').doc('global');
    const dailyDocId = getDailyDocId();
    const dailyRef = db.collection('systemMetrics').doc(dailyDocId);

    try {
      await db.runTransaction(async (transaction) => {
        await this.trackUserActivity(transaction, dailyRef, globalRef, email);

        transaction.set(globalRef, {
          version: 1,
          metricsVersion: admin.firestore.FieldValue.increment(1),
          lastEvent: 'RATE_LIMIT',
          lastEventId: requestId || '',
          lastUpdatedBy: 'MetricsService',
          rateLimitEventsToday: admin.firestore.FieldValue.increment(1),
          lastUpdated: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        transaction.set(dailyRef, {
          version: 1,
          metricsVersion: admin.firestore.FieldValue.increment(1),
          lastEvent: 'RATE_LIMIT',
          lastEventId: requestId || '',
          lastUpdatedBy: 'MetricsService',
          rateLimits: admin.firestore.FieldValue.increment(1),
          lastUpdated: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
      });
    } catch (err) {
      logWarn(LOG_CATEGORIES.SYSTEM, requestId, `Failed to update metrics for RATE_LIMIT: ${err.message}`);
    }
  },

  /**
   * Log a Google Drive operation failure event
   */
  async recordDriveFailure({ email = '', requestId = '' }) {
    const db = admin.firestore();
    const globalRef = db.collection('systemMetrics').doc('global');
    const dailyDocId = getDailyDocId();
    const dailyRef = db.collection('systemMetrics').doc(dailyDocId);

    try {
      await db.runTransaction(async (transaction) => {
        await this.trackUserActivity(transaction, dailyRef, globalRef, email);

        transaction.set(globalRef, {
          version: 1,
          metricsVersion: admin.firestore.FieldValue.increment(1),
          lastEvent: 'DRIVE_FAILURE',
          lastEventId: requestId || '',
          lastUpdatedBy: 'MetricsService',
          driveFailures: admin.firestore.FieldValue.increment(1),
          lastUpdated: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        transaction.set(dailyRef, {
          version: 1,
          metricsVersion: admin.firestore.FieldValue.increment(1),
          lastEvent: 'DRIVE_FAILURE',
          lastEventId: requestId || '',
          lastUpdatedBy: 'MetricsService',
          driveFailures: admin.firestore.FieldValue.increment(1),
          lastUpdated: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
      });
      logInfo(LOG_CATEGORIES.SYSTEM, requestId, 'Metrics updated successfully for DRIVE_FAILURE.');
    } catch (err) {
      logWarn(LOG_CATEGORIES.SYSTEM, requestId, `Failed to update metrics for DRIVE_FAILURE: ${err.message}`);
    }
  },

  /**
   * Log a security incident event (e.g., unauthorized access attempts, blocked requests)
   */
  async recordSecurityIncident({ email = '', requestId = '' }) {
    const db = admin.firestore();
    const globalRef = db.collection('systemMetrics').doc('global');
    const dailyDocId = getDailyDocId();
    const dailyRef = db.collection('systemMetrics').doc(dailyDocId);

    try {
      await db.runTransaction(async (transaction) => {
        await this.trackUserActivity(transaction, dailyRef, globalRef, email);

        transaction.set(globalRef, {
          version: 1,
          metricsVersion: admin.firestore.FieldValue.increment(1),
          lastEvent: 'SECURITY_INCIDENT',
          lastEventId: requestId || '',
          lastUpdatedBy: 'MetricsService',
          securityIncidents: admin.firestore.FieldValue.increment(1),
          lastUpdated: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        transaction.set(dailyRef, {
          version: 1,
          metricsVersion: admin.firestore.FieldValue.increment(1),
          lastEvent: 'SECURITY_INCIDENT',
          lastEventId: requestId || '',
          lastUpdatedBy: 'MetricsService',
          securityIncidents: admin.firestore.FieldValue.increment(1),
          lastUpdated: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
      });
      logInfo(LOG_CATEGORIES.SYSTEM, requestId, 'Metrics updated successfully for SECURITY_INCIDENT.');
    } catch (err) {
      logWarn(LOG_CATEGORIES.SYSTEM, requestId, `Failed to update metrics for SECURITY_INCIDENT: ${err.message}`);
    }
  }
};

module.exports = metricsService;
