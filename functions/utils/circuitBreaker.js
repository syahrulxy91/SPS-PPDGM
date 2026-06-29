/**
 * SPS Cloud Functions - Google Drive Circuit Breaker
 * Sprint P2 — Enterprise Resilience Layer
 */

const admin = require('firebase-admin');
const { LOG_CATEGORIES } = require('../constants');

// Constants for Circuit Breaker configuration
const FAILURE_THRESHOLD = 3;
const COOLDOWN_PERIOD_MS = 30000; // 30 seconds

// In-memory state
let cbState = {
  state: 'CLOSED', // 'CLOSED', 'OPEN', 'HALF_OPEN'
  consecutiveFailures: 0,
  lastFailureTime: null,
  nextRetryTime: null,
};

// Log functions locally or require them dynamically to avoid circular dependencies
function getLoggers() {
  try {
    return require('./index');
  } catch (err) {
    return {
      logInfo: (cat, req, msg) => console.log(`${cat} ${msg}`),
      logWarn: (cat, req, msg) => console.warn(`${cat} ${msg}`),
      logError: (cat, req, msg) => console.error(`${cat} ${msg}`)
    };
  }
}

/**
 * Synchronize the current circuit breaker state to Firestore for Monitoring Integration.
 * Wrapped in a try-catch to ensure graceful degradation: if Firestore updates fail,
 * the business operations are unaffected.
 */
async function syncToFirestore(requestId = '') {
  const loggers = getLoggers();
  try {
    const db = admin.firestore();
    const docRef = db.collection('systemStatus').doc('circuitBreaker');
    
    await docRef.set({
      state: cbState.state,
      failureCount: cbState.consecutiveFailures,
      lastFailureTime: cbState.lastFailureTime ? admin.firestore.Timestamp.fromDate(new Date(cbState.lastFailureTime)) : null,
      nextRetryTime: cbState.nextRetryTime ? admin.firestore.Timestamp.fromDate(new Date(cbState.nextRetryTime)) : null,
      lastCheckedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedBy: 'CircuitBreakerService'
    }, { merge: true });

    loggers.logInfo(LOG_CATEGORIES.SYSTEM, requestId, `Circuit Breaker state synced to Firestore: ${cbState.state}`);
  } catch (err) {
    // Graceful degradation: log warning, never throw or abort the request
    loggers.logWarn(
      LOG_CATEGORIES.SYSTEM,
      requestId,
      `Graceful Degradation: Gagal mengemas kini status Circuit Breaker di Firestore: ${err.message}`
    );
  }
}

const circuitBreaker = {
  /**
   * Checks if Google Drive operations can execute.
   * Handles state transitions to HALF_OPEN if cooldown has expired.
   */
  canExecute(requestId = '') {
    const runtimeConfigService = require('../services/runtimeConfigService');
    const runtimeConfig = runtimeConfigService.getCachedConfig();
    if (runtimeConfig && runtimeConfig.enableCircuitBreaker === false) {
      return true;
    }

    const loggers = getLoggers();
    const now = Date.now();

    if (cbState.state === 'CLOSED') {
      return true;
    }

    if (cbState.state === 'OPEN') {
      if (now >= cbState.nextRetryTime) {
        cbState.state = 'HALF_OPEN';
        loggers.logInfo(
          LOG_CATEGORIES.SYSTEM,
          requestId,
          `Circuit Breaker transition: OPEN -> HALF_OPEN (Cooldown expired. Testing service...)`
        );
        // Async update to Firestore, do not block the request
        syncToFirestore(requestId).catch(() => {});
        return true;
      }
      
      loggers.logWarn(
        LOG_CATEGORIES.SYSTEM,
        requestId,
        `Circuit Breaker is OPEN. Request rejected immediately. Time remaining: ${Math.round((cbState.nextRetryTime - now) / 1000)}s`
      );
      return false;
    }

    if (cbState.state === 'HALF_OPEN') {
      // In HALF_OPEN state we allow requests to test the downstream dependency.
      return true;
    }

    return true;
  },

  /**
   * Record a successful Google Drive operation.
   * If state was OPEN or HALF_OPEN, it closes the circuit.
   */
  async recordSuccess(requestId = '') {
    const loggers = getLoggers();
    const previousState = cbState.state;

    cbState.consecutiveFailures = 0;
    cbState.lastFailureTime = null;
    cbState.nextRetryTime = null;
    cbState.state = 'CLOSED';

    if (previousState !== 'CLOSED') {
      loggers.logInfo(
        LOG_CATEGORIES.SYSTEM,
        requestId,
        `Circuit Breaker transition: ${previousState} -> CLOSED. Google Drive is healthy.`
      );
    }
    
    await syncToFirestore(requestId);
  },

  /**
   * Record a failed Google Drive operation.
   * If threshold is reached, it opens the circuit.
   */
  async recordFailure(requestId = '') {
    const loggers = getLoggers();
    const now = Date.now();

    cbState.consecutiveFailures += 1;
    cbState.lastFailureTime = now;

    loggers.logWarn(
      LOG_CATEGORIES.SYSTEM,
      requestId,
      `Google Drive failure recorded by Circuit Breaker. Consecutive failures: ${cbState.consecutiveFailures}/${FAILURE_THRESHOLD}`
    );

    if (cbState.state === 'CLOSED' && cbState.consecutiveFailures >= FAILURE_THRESHOLD) {
      cbState.state = 'OPEN';
      cbState.nextRetryTime = now + COOLDOWN_PERIOD_MS;
      loggers.logError(
        LOG_CATEGORIES.SYSTEM,
        requestId,
        `Circuit Breaker transition: CLOSED -> OPEN. Google Drive offline. Cooldown period: ${COOLDOWN_PERIOD_MS / 1000}s`
      );
      await syncToFirestore(requestId);
    } else if (cbState.state === 'HALF_OPEN') {
      cbState.state = 'OPEN';
      cbState.nextRetryTime = now + COOLDOWN_PERIOD_MS;
      loggers.logError(
        LOG_CATEGORIES.SYSTEM,
        requestId,
        `Circuit Breaker transition: HALF_OPEN -> OPEN. Test request failed. Cooldown restarted.`
      );
      await syncToFirestore(requestId);
    } else {
      // Still CLOSED but failure count incremented, update status in Firestore asynchronously
      syncToFirestore(requestId).catch(() => {});
    }
  },

  /**
   * Return current circuit breaker status for Monitoring
   */
  getStatus() {
    return {
      state: cbState.state,
      failureCount: cbState.consecutiveFailures,
      lastFailureTime: cbState.lastFailureTime,
      nextRetryTime: cbState.nextRetryTime,
      failureThreshold: FAILURE_THRESHOLD,
      cooldownPeriodMs: COOLDOWN_PERIOD_MS
    };
  }
};

module.exports = circuitBreaker;
