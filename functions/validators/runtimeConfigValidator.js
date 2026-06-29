/**
 * SPS Cloud Functions - Runtime Configuration Validator
 * Sprint B2 — Enterprise Runtime Configuration Governance
 */

const LOG_CATEGORIES = { SYSTEM: 'SYSTEM' };

const VALID_LOG_LEVELS = ['debug', 'info', 'warn', 'error'];

/**
 * Validates any runtime configuration properties.
 * If validation fails, it logs a warning and falls back to safe defaults.
 */
class RuntimeConfigValidator {
  /**
   * Validates a full or partial config object against schema rules.
   * Returns a clean, validated object and details of any validation errors.
   * 
   * @param {Object} data - Raw configuration data to validate
   * @param {Object} fallback - Fallback configuration values to use in case of validation failure
   * @returns {Object} { validatedConfig, errors }
   */
  static validate(data, fallback = {}) {
    const errors = [];
    const validated = {};

    if (!data || typeof data !== 'object') {
      return {
        validatedConfig: { ...fallback },
        errors: [{ path: 'root', message: 'Config data must be a non-null object.' }]
      };
    }

    // 1. Boolean Validations
    const booleanKeys = [
      'maintenanceMode',
      'readOnlyMode',
      'enableMonitoring',
      'enableMetrics',
      'enableAudit',
      'enableCircuitBreaker',
      'enableRequestTiming'
    ];

    booleanKeys.forEach(key => {
      if (data[key] !== undefined) {
        if (typeof data[key] === 'boolean') {
          validated[key] = data[key];
        } else if (data[key] === 'true' || data[key] === 'false') {
          validated[key] = data[key] === 'true';
          errors.push({ path: key, message: `Type mismatch resolved: cast string '${data[key]}' to boolean.` });
        } else {
          validated[key] = fallback[key] !== undefined ? fallback[key] : false;
          errors.push({ path: key, message: `Expected boolean, received '${typeof data[key]}'. Fell back to default.` });
        }
      } else {
        validated[key] = fallback[key] !== undefined ? fallback[key] : false;
      }
    });

    // 2. Integer & Version Validation
    if (data.version !== undefined) {
      const parsed = parseInt(data.version, 10);
      if (!isNaN(parsed) && Number.isInteger(parsed) && parsed >= 0) {
        validated.version = parsed;
      } else {
        validated.version = fallback.version !== undefined ? fallback.version : 1;
        errors.push({ path: 'version', message: `Invalid version value '${data.version}'. Expected positive integer.` });
      }
    } else {
      validated.version = fallback.version !== undefined ? fallback.version : 1;
    }

    // 3. Range & Timeout Validation (e.g., requestTimeoutMs)
    if (data.requestTimeoutMs !== undefined) {
      const timeout = parseInt(data.requestTimeoutMs, 10);
      if (!isNaN(timeout) && Number.isInteger(timeout)) {
        if (timeout >= 1000 && timeout <= 120000) {
          validated.requestTimeoutMs = timeout;
        } else {
          validated.requestTimeoutMs = fallback.requestTimeoutMs !== undefined ? fallback.requestTimeoutMs : 30000;
          errors.push({ path: 'requestTimeoutMs', message: `Value ${timeout} out of bounds [1000, 120000]. Fell back to default.` });
        }
      } else {
        validated.requestTimeoutMs = fallback.requestTimeoutMs !== undefined ? fallback.requestTimeoutMs : 30000;
        errors.push({ path: 'requestTimeoutMs', message: `Invalid type for requestTimeoutMs. Expected integer.` });
      }
    } else {
      validated.requestTimeoutMs = fallback.requestTimeoutMs !== undefined ? fallback.requestTimeoutMs : 30000;
    }

    // 4. Cache TTL Validation (e.g., cacheTtlSeconds)
    if (data.cacheTtlSeconds !== undefined) {
      const ttl = parseInt(data.cacheTtlSeconds, 10);
      if (!isNaN(ttl) && Number.isInteger(ttl)) {
        if (ttl >= 5 && ttl <= 3600) {
          validated.cacheTtlSeconds = ttl;
        } else {
          validated.cacheTtlSeconds = fallback.cacheTtlSeconds !== undefined ? fallback.cacheTtlSeconds : 60;
          errors.push({ path: 'cacheTtlSeconds', message: `Value ${ttl} out of bounds [5, 3600]. Fell back to default.` });
        }
      } else {
        validated.cacheTtlSeconds = fallback.cacheTtlSeconds !== undefined ? fallback.cacheTtlSeconds : 60;
        errors.push({ path: 'cacheTtlSeconds', message: `Invalid type for cacheTtlSeconds. Expected integer.` });
      }
    } else {
      validated.cacheTtlSeconds = fallback.cacheTtlSeconds !== undefined ? fallback.cacheTtlSeconds : 60;
    }

    // 5. Enum Validation (e.g., logLevel)
    if (data.logLevel !== undefined) {
      const level = String(data.logLevel).toLowerCase();
      if (VALID_LOG_LEVELS.includes(level)) {
        validated.logLevel = level;
      } else {
        validated.logLevel = fallback.logLevel !== undefined ? fallback.logLevel : 'info';
        errors.push({ path: 'logLevel', message: `Invalid logLevel '${data.logLevel}'. Must be one of: ${VALID_LOG_LEVELS.join(', ')}.` });
      }
    } else {
      validated.logLevel = fallback.logLevel !== undefined ? fallback.logLevel : 'info';
    }

    // 6. Array Validation (e.g., allowedIpList)
    if (data.allowedIpList !== undefined) {
      if (Array.isArray(data.allowedIpList)) {
        const cleanIps = data.allowedIpList
          .map(ip => String(ip).trim())
          .filter(ip => ip.length > 0);
        validated.allowedIpList = cleanIps;
      } else {
        validated.allowedIpList = fallback.allowedIpList !== undefined ? fallback.allowedIpList : [];
        errors.push({ path: 'allowedIpList', message: `Invalid type for allowedIpList. Expected Array.` });
      }
    } else {
      validated.allowedIpList = fallback.allowedIpList !== undefined ? fallback.allowedIpList : [];
    }

    // Log validation warnings
    if (errors.length > 0) {
      console.warn(`[RuntimeConfigValidator] Validation Warnings:`, JSON.stringify(errors));
    }

    return {
      validatedConfig: validated,
      errors
    };
  }
}

module.exports = RuntimeConfigValidator;
