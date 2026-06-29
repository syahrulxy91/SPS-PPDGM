/**
 * Sektor Pengurusan Sekolah (SPS) Cloud Functions Backend
 * Sprint A — Entry Point & Delegation Layer
 * 
 * Sila laksanakan arahan berikut untuk men-deploy fungsi ini:
 * 1. Pasang Firebase CLI secara global: npm install -g firebase-tools
 * 2. Log masuk ke akaun Firebase: firebase login
 * 3. Pilih projek aktif: firebase use spsppdgm
 * 4. Jalankan perintah deploy: firebase deploy --only functions
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const cors = require('cors')({ origin: true });

// Initialize Firebase Admin SDK if not already done
if (!admin.apps.length) {
  admin.initializeApp();
}

// Import Dedicated Request Handlers
const uploadHandler = require('./handlers/uploadHandler');
const deleteHandler = require('./handlers/deleteHandler');
const manageUsersHandler = require('./handlers/manageUsersHandler');

/**
 * 1. Cloud Function: uploadToGoogleDrive
 * Handles secure file uploads directly to Google Drive.
 * Delegates orchestration and request validation to uploadHandler pipeline.
 */
exports.uploadToGoogleDrive = functions.https.onRequest((req, res) => {
  return cors(req, res, () => uploadHandler.pipeline(req, res));
});

/**
 * 2. Cloud Function: deleteFromGoogleDrive
 * Handles secure file deletions from Google Drive.
 * Delegates orchestration and request validation to deleteHandler pipeline.
 */
exports.deleteFromGoogleDrive = functions.https.onRequest((req, res) => {
  return cors(req, res, () => deleteHandler.pipeline(req, res));
});

/**
 * 3. Cloud Function: manageUsers
 * Handles Role-Based Access Control changes, enabling/disabling users, and security logging.
 * Delegates orchestration and request validation to manageUsersHandler pipeline.
 */
exports.manageUsers = functions.https.onRequest((req, res) => {
  return cors(req, res, () => manageUsersHandler.pipeline(req, res));
});

/**
 * 4. Firestore Trigger: onRuntimeConfigUpdate
 * Intercepts write events to systemSettings/runtime.
 * Ensures the configuration is strictly validated, increments the version,
 * populates audit metadata, and appends a record to the configurationHistory collection.
 */
exports.onRuntimeConfigUpdate = functions.firestore
  .document('systemSettings/runtime')
  .onUpdate(async (change, context) => {
    const beforeData = change.before.data() || {};
    const afterData = change.after.data() || {};

    // Prevent infinite recursive trigger loops
    if (afterData._triggerProcessed) {
      // Clear the trigger lock flag silently to keep Firestore document clean, but do not trigger again
      await change.after.ref.update({ _triggerProcessed: admin.firestore.FieldValue.delete() });
      return null;
    }

    const validator = require('./validators/runtimeConfigValidator');
    const DEFAULT_CONFIG = {
      maintenanceMode: false,
      readOnlyMode: false,
      enableMonitoring: true,
      enableMetrics: true,
      enableAudit: true,
      enableCircuitBreaker: true,
      enableRequestTiming: true,
      requestTimeoutMs: 30000,
      cacheTtlSeconds: 60,
      logLevel: 'info',
      allowedIpList: []
    };

    const CONFIG = require('./config');
    const fallbackSource = CONFIG.features ? { ...DEFAULT_CONFIG, ...CONFIG.features } : DEFAULT_CONFIG;
    
    // Validate the incoming manual updates
    const { validatedConfig, errors } = validator.validate(afterData, fallbackSource);
    
    // Auto-increment version governance
    const previousVersion = beforeData.version || 0;
    const newVersion = previousVersion + 1;
    validatedConfig.version = newVersion;

    // Automatic metadata generation (No reliance on frontend input)
    const nowStr = new Date().toISOString();
    validatedConfig.updatedAt = nowStr;
    validatedConfig.updatedBy = afterData.updatedBy || 'Console Admin';
    validatedConfig.createdAt = beforeData.createdAt || nowStr;
    validatedConfig.createdBy = beforeData.createdBy || afterData.updatedBy || 'Console Admin';

    // Calculate exact changed fields
    const changes = {};
    const keys = new Set([...Object.keys(beforeData), ...Object.keys(validatedConfig)]);
    keys.forEach(key => {
      if (['updatedAt', 'lastRefresh', 'cacheAge', '_triggerProcessed'].includes(key)) return;
      if (JSON.stringify(beforeData[key]) !== JSON.stringify(validatedConfig[key])) {
        changes[key] = {
          old: beforeData[key],
          new: validatedConfig[key]
        };
      }
    });

    const db = admin.firestore();

    // Write back with loop-prevention flag
    await change.after.ref.set({
      ...validatedConfig,
      _triggerProcessed: true
    });

    // Save record to configurationHistory
    await db.collection('configurationHistory').add({
      eventType: 'CONFIG_UPDATED',
      performedBy: afterData.updatedBy || 'Console Admin',
      changes,
      previousVersion,
      newVersion,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      requestId: context.eventId || 'TRIGGER_SYSTEM'
    });

    console.log(`[RuntimeConfigTrigger] Governance applied to systemSettings/runtime. Version bumped to ${newVersion}.`);
    return null;
  });

