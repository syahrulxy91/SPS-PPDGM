/**
 * SPS Cloud Functions - Runtime Configuration Layer (Firestore-backed)
 * Sprint B2.1 — Cloud Native Runtime Configuration Hardening
 */

const admin = require('firebase-admin');
const CONFIG = require('../config');
const RuntimeConfigValidator = require('../validators/runtimeConfigValidator');

let cachedConfig = null;
let cachedVersion = 0;
let lastFetchedAt = 0;
let validationStatus = 'VALID';

// Runtime memory-only cache metrics
const metrics = {
  cacheHits: 0,
  cacheMisses: 0,
  refreshCount: 0,
  fallbackCount: 0,
  validationWarnings: 0,
  lastRefreshDuration: 0
};

// Internal drift configuration details storage
let driftFlag = false;
let driftDetails = {};

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

// Helper function to detect configuration drift
function detectDrift(rawDbData, validatedConfig) {
  const drift = {};
  let drifted = false;
  
  // We compare core keys (booleans, numbers, arrays, strings)
  const keysToCompare = [
    'maintenanceMode',
    'readOnlyMode',
    'enableMonitoring',
    'enableMetrics',
    'enableAudit',
    'enableCircuitBreaker',
    'enableRequestTiming',
    'requestTimeoutMs',
    'cacheTtlSeconds',
    'logLevel',
    'allowedIpList'
  ];

  keysToCompare.forEach(key => {
    const rawVal = rawDbData[key];
    const valVal = validatedConfig[key];

    if (rawVal !== undefined) {
      if (JSON.stringify(rawVal) !== JSON.stringify(valVal)) {
        drift[key] = {
          firestore: rawVal,
          validated: valVal
        };
        drifted = true;
      }
    }
  });

  return { drifted, drift };
}

const RuntimeConfigService = {
  /**
   * Loads the runtime configuration from Firestore (systemSettings/runtime).
   * Uses lazy revalidation cache strategy suitable for stateless Cloud Functions.
   */
  async loadConfig() {
    const now = Date.now();
    const ttlMs = (cachedConfig && cachedConfig.cacheTtlSeconds ? cachedConfig.cacheTtlSeconds : 60) * 1000;

    // 1. Memory Cache HIT check
    if (cachedConfig && (now - lastFetchedAt < ttlMs)) {
      metrics.cacheHits++;
      cachedConfig.cacheAge = Math.floor((now - lastFetchedAt) / 1000);
      cachedConfig.cacheStatus = 'HIT';
      
      // Update real-time metrics inside the returned configuration object
      cachedConfig.cacheHits = metrics.cacheHits;
      cachedConfig.cacheMisses = metrics.cacheMisses;
      cachedConfig.refreshCount = metrics.refreshCount;
      cachedConfig.fallbackCount = metrics.fallbackCount;
      cachedConfig.validationWarningCount = metrics.validationWarnings;
      cachedConfig.lastRefreshDuration = metrics.lastRefreshDuration;
      cachedConfig.configDrift = driftFlag;
      cachedConfig.driftDetails = driftDetails;

      return cachedConfig;
    }

    // 2. Cache MISS / TTL Expired - Perform read
    metrics.cacheMisses++;
    const startTime = Date.now();
    let refreshReason = cachedConfig ? 'TTL_EXPIRED' : 'CACHE_EMPTY';

    try {
      const db = admin.firestore();
      const docRef = db.collection('systemSettings').doc('runtime');
      const docSnap = await docRef.get();

      let dbData = null;
      if (docSnap.exists) {
        dbData = docSnap.data();
      }

      const fallbackSource = CONFIG.features ? { ...DEFAULT_CONFIG, ...CONFIG.features } : DEFAULT_CONFIG;
      metrics.lastRefreshDuration = Date.now() - startTime;

      if (dbData) {
        const incomingVersion = dbData.version || 1;

        // 3. Version-aware check
        if (cachedConfig && cachedVersion === incomingVersion) {
          // Version unchanged: Reuse existing validated cache and extend TTL
          lastFetchedAt = now;
          metrics.refreshCount++;
          
          cachedConfig.cacheAge = 0;
          cachedConfig.cacheStatus = 'HIT';
          cachedConfig.lastRefreshReason = 'TTL_EXPIRED';
          cachedConfig.lastRefresh = new Date(now).toISOString();
          
          // Update stats
          cachedConfig.cacheHits = metrics.cacheHits;
          cachedConfig.cacheMisses = metrics.cacheMisses;
          cachedConfig.refreshCount = metrics.refreshCount;
          cachedConfig.fallbackCount = metrics.fallbackCount;
          cachedConfig.validationWarningCount = metrics.validationWarnings;
          cachedConfig.lastRefreshDuration = metrics.lastRefreshDuration;
          cachedConfig.configDrift = driftFlag;
          cachedConfig.driftDetails = driftDetails;

          return cachedConfig;
        }

        // Version changed or Cache empty: Rebuild configuration
        if (cachedConfig && cachedVersion !== incomingVersion) {
          refreshReason = 'VERSION_CHANGED';
        }

        const { validatedConfig, errors } = RuntimeConfigValidator.validate(dbData, fallbackSource);
        
        // Configuration Drift Detection
        const driftCheck = detectDrift(dbData, validatedConfig);
        driftFlag = driftCheck.drifted;
        driftDetails = driftCheck.drift;

        lastFetchedAt = now;
        cachedVersion = incomingVersion;
        validationStatus = errors.length === 0 ? 'VALID' : 'INVALID_WARNINGS';
        metrics.refreshCount++;
        metrics.validationWarnings += errors.length;

        cachedConfig = {
          ...DEFAULT_CONFIG,
          ...fallbackSource,
          ...validatedConfig,
          version: cachedVersion,
          source: 'FIRESTORE',
          cacheStatus: 'HIT',
          cacheAge: 0,
          lastRefreshReason: refreshReason,
          lastRefresh: new Date(lastFetchedAt).toISOString(),
          lastUpdated: dbData.updatedAt || new Date().toISOString(),
          updatedBy: dbData.updatedBy || 'SYSTEM',
          validationStatus,
          validationErrors: errors,
          createdAt: dbData.createdAt || new Date().toISOString(),
          createdBy: dbData.createdBy || 'SYSTEM',
          
          // Metrics integration
          cacheHits: metrics.cacheHits,
          cacheMisses: metrics.cacheMisses,
          refreshCount: metrics.refreshCount,
          fallbackCount: metrics.fallbackCount,
          validationWarningCount: metrics.validationWarnings,
          lastRefreshDuration: metrics.lastRefreshDuration,
          configDrift: driftFlag,
          driftDetails: driftDetails
        };
      } else {
        // Missing Firestore document
        console.warn('[RuntimeConfigService] Firestore document systemSettings/runtime does not exist. Using defaults.');
        lastFetchedAt = now;
        cachedVersion = 1;
        validationStatus = 'VALID';
        metrics.refreshCount++;

        const driftCheck = detectDrift({}, DEFAULT_CONFIG);
        driftFlag = driftCheck.drifted;
        driftDetails = driftCheck.drift;

        cachedConfig = {
          ...DEFAULT_CONFIG,
          ...fallbackSource,
          version: 1,
          source: 'DEFAULT',
          cacheStatus: 'HIT',
          cacheAge: 0,
          lastRefreshReason: 'CACHE_EMPTY',
          lastRefresh: new Date(lastFetchedAt).toISOString(),
          lastUpdated: new Date().toISOString(),
          updatedBy: 'SYSTEM',
          validationStatus,
          validationErrors: [],
          createdAt: new Date().toISOString(),
          createdBy: 'SYSTEM',

          // Metrics integration
          cacheHits: metrics.cacheHits,
          cacheMisses: metrics.cacheMisses,
          refreshCount: metrics.refreshCount,
          fallbackCount: metrics.fallbackCount,
          validationWarningCount: metrics.validationWarnings,
          lastRefreshDuration: metrics.lastRefreshDuration,
          configDrift: driftFlag,
          driftDetails: driftDetails
        };
      }

      return cachedConfig;
    } catch (err) {
      console.error('[RuntimeConfigService] Failed to load config from Firestore, activating failover strategy:', err);
      metrics.fallbackCount++;
      metrics.lastRefreshDuration = Date.now() - startTime;

      // FAILURE STRATEGY (Requirement 9):
      // - If Firestore becomes unavailable -> Use cached configuration.
      // - If cache unavailable -> Use static CONFIG defaults.
      if (cachedConfig) {
        cachedConfig.cacheStatus = 'FAILOVER_HIT';
        cachedConfig.source = 'CACHE';
        cachedConfig.lastRefreshReason = 'FALLBACK';
        cachedConfig.cacheAge = Math.floor((now - lastFetchedAt) / 1000);
        
        cachedConfig.cacheHits = metrics.cacheHits;
        cachedConfig.cacheMisses = metrics.cacheMisses;
        cachedConfig.refreshCount = metrics.refreshCount;
        cachedConfig.fallbackCount = metrics.fallbackCount;
        cachedConfig.validationWarningCount = metrics.validationWarnings;
        cachedConfig.lastRefreshDuration = metrics.lastRefreshDuration;
        cachedConfig.configDrift = driftFlag;
        cachedConfig.driftDetails = driftDetails;

        return cachedConfig;
      }

      const fallbackSource = CONFIG.features ? { ...DEFAULT_CONFIG, ...CONFIG.features } : DEFAULT_CONFIG;
      lastFetchedAt = now;
      cachedVersion = 1;
      validationStatus = 'VALID';

      const driftCheck = detectDrift({}, fallbackSource);
      driftFlag = driftCheck.drifted;
      driftDetails = driftCheck.drift;

      cachedConfig = {
        ...DEFAULT_CONFIG,
        ...fallbackSource,
        version: 1,
        source: 'DEFAULT',
        cacheStatus: 'MISS',
        cacheAge: 0,
        lastRefreshReason: 'FALLBACK',
        lastRefresh: new Date(lastFetchedAt).toISOString(),
        lastUpdated: new Date().toISOString(),
        updatedBy: 'SYSTEM',
        validationStatus,
        validationErrors: [],
        createdAt: new Date().toISOString(),
        createdBy: 'SYSTEM',

        // Metrics integration
        cacheHits: metrics.cacheHits,
        cacheMisses: metrics.cacheMisses,
        refreshCount: metrics.refreshCount,
        fallbackCount: metrics.fallbackCount,
        validationWarningCount: metrics.validationWarnings,
        lastRefreshDuration: metrics.lastRefreshDuration,
        configDrift: driftFlag,
        driftDetails: driftDetails
      };

      return cachedConfig;
    }
  },

  /**
   * Synchronously retrieves the cached configuration.
   */
  getCachedConfig() {
    if (cachedConfig) {
      cachedConfig.cacheAge = Math.floor((Date.now() - lastFetchedAt) / 1000);
      
      cachedConfig.cacheHits = metrics.cacheHits;
      cachedConfig.cacheMisses = metrics.cacheMisses;
      cachedConfig.refreshCount = metrics.refreshCount;
      cachedConfig.fallbackCount = metrics.fallbackCount;
      cachedConfig.validationWarningCount = metrics.validationWarnings;
      cachedConfig.lastRefreshDuration = metrics.lastRefreshDuration;
      cachedConfig.configDrift = driftFlag;
      cachedConfig.driftDetails = driftDetails;

      return cachedConfig;
    }
    
    const fallbackSource = CONFIG.features ? { ...DEFAULT_CONFIG, ...CONFIG.features } : DEFAULT_CONFIG;
    return {
      ...DEFAULT_CONFIG,
      ...fallbackSource,
      version: 1,
      source: 'DEFAULT',
      cacheStatus: 'MISS',
      cacheAge: 0,
      lastRefreshReason: 'CACHE_EMPTY',
      lastRefresh: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
      updatedBy: 'SYSTEM',
      validationStatus: 'VALID',
      validationErrors: [],
      createdAt: new Date().toISOString(),
      createdBy: 'SYSTEM',

      // Metrics integration
      cacheHits: metrics.cacheHits,
      cacheMisses: metrics.cacheMisses,
      refreshCount: metrics.refreshCount,
      fallbackCount: metrics.fallbackCount,
      validationWarningCount: metrics.validationWarnings,
      lastRefreshDuration: metrics.lastRefreshDuration,
      configDrift: driftFlag,
      driftDetails: driftDetails
    };
  },

  getEffectiveConfig() {
    return this.getCachedConfig();
  },

  async saveAndAuditConfig(newConfig, updatedByEmail, requestId = 'SYSTEM') {
    const db = admin.firestore();
    const docRef = db.collection('systemSettings').doc('runtime');
    
    let previousConfig = {};
    let previousVersion = 0;
    try {
      const snap = await docRef.get();
      if (snap.exists) {
        previousConfig = snap.data();
        previousVersion = previousConfig.version || 0;
      }
    } catch (err) {
      console.warn('[RuntimeConfigService] Could not read previous configuration for audit log:', err);
    }

    const fallbackSource = CONFIG.features ? { ...DEFAULT_CONFIG, ...CONFIG.features } : DEFAULT_CONFIG;
    const { validatedConfig, errors } = RuntimeConfigValidator.validate(newConfig, fallbackSource);
    
    const newVersion = previousVersion + 1;
    validatedConfig.version = newVersion;
    
    const nowStr = new Date().toISOString();
    validatedConfig.updatedAt = nowStr;
    validatedConfig.updatedBy = updatedByEmail || 'SYSTEM';
    validatedConfig.createdAt = previousConfig.createdAt || nowStr;
    validatedConfig.createdBy = previousConfig.createdBy || updatedByEmail || 'SYSTEM';

    const changes = {};
    const allKeys = new Set([...Object.keys(previousConfig), ...Object.keys(validatedConfig)]);
    allKeys.forEach(key => {
      if (['updatedAt', 'lastRefresh', 'cacheAge', '_triggerProcessed'].includes(key)) return;
      if (JSON.stringify(previousConfig[key]) !== JSON.stringify(validatedConfig[key])) {
        changes[key] = {
          old: previousConfig[key],
          new: validatedConfig[key]
        };
      }
    });

    await docRef.set({
      ...validatedConfig,
      _triggerProcessed: true
    });

    const historyRef = db.collection('configurationHistory');
    await historyRef.add({
      eventType: 'CONFIG_UPDATED',
      performedBy: updatedByEmail || 'SYSTEM',
      changes,
      previousVersion,
      newVersion,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      requestId
    });

    lastFetchedAt = Date.now();
    cachedVersion = newVersion;
    validationStatus = errors.length === 0 ? 'VALID' : 'INVALID_WARNINGS';
    metrics.refreshCount++;
    metrics.validationWarnings += errors.length;

    const driftCheck = detectDrift(validatedConfig, validatedConfig);
    driftFlag = driftCheck.drifted;
    driftDetails = driftCheck.drift;

    cachedConfig = {
      ...DEFAULT_CONFIG,
      ...fallbackSource,
      ...validatedConfig,
      version: newVersion,
      source: 'FIRESTORE',
      cacheStatus: 'HIT',
      cacheAge: 0,
      lastRefreshReason: 'VERSION_CHANGED',
      lastRefresh: new Date(lastFetchedAt).toISOString(),
      lastUpdated: nowStr,
      updatedBy: updatedByEmail || 'SYSTEM',
      validationStatus,
      validationErrors: errors,
      createdAt: validatedConfig.createdAt,
      createdBy: validatedConfig.createdBy,

      // Metrics integration
      cacheHits: metrics.cacheHits,
      cacheMisses: metrics.cacheMisses,
      refreshCount: metrics.refreshCount,
      fallbackCount: metrics.fallbackCount,
      validationWarningCount: metrics.validationWarnings,
      lastRefreshDuration: metrics.lastRefreshDuration,
      configDrift: driftFlag,
      driftDetails: driftDetails
    };

    return cachedConfig;
  },

  async getFeature(key) {
    const config = await this.loadConfig();
    return config[key];
  },

  async isReadOnlyMode() {
    return this.getFeature('readOnlyMode');
  },

  async isMaintenanceMode() {
    return this.getFeature('maintenanceMode');
  }
};

module.exports = RuntimeConfigService;
