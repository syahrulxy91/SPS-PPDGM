/**
 * SPS Cloud Functions - Correlation & Context Middleware
 * Sprint A Final — Enterprise Handler Layer Hardening & Middleware Foundation
 */

const {
  generateRequestId,
  generateCorrelationId,
  runWithRequestContext,
  logInfo,
  logWarn,
  logError
} = require('../utils');
const runtimeConfigService = require('../services/runtimeConfigService');

/**
 * Middleware to initialize request context, metadata, and stage timings.
 */
function correlationMiddleware(req, res, next) {
  const requestId = generateRequestId();
  const correlationId = generateCorrelationId();

  // Parse IP metadata safely
  const forwardedFor = req.headers['x-forwarded-for'] || '';
  let clientIp = '';
  if (forwardedFor) {
    const ips = forwardedFor.split(',');
    clientIp = ips[0].trim();
  } else {
    clientIp = req.ip || '';
  }
  const host = req.headers['host'] || '';
  const origin = req.headers['origin'] || req.headers['Origin'] || '';
  const userAgent = req.headers['user-agent'] || '';

  // Initialize unified Request Context
  const ctx = {
    requestId,
    correlationId,
    user: null,
    startTime: Date.now(),
    requestMetadata: {
      clientIp,
      forwardedFor,
      host,
      origin,
      userAgent
    },
    stageStarts: {},
    timings: {},
    logger: {
      info: (cat, msg, details) => logInfo(cat, requestId, msg, details),
      warn: (cat, msg, details) => logWarn(cat, requestId, msg, details),
      error: (cat, msg, details) => logError(cat, requestId, msg, details)
    },
    startTiming(stage) {
      this.stageStarts[stage] = Date.now();
    },
    endTiming(stage) {
      if (this.stageStarts[stage]) {
        const duration = Date.now() - this.stageStarts[stage];
        this.timings[stage] = duration;
        const config = runtimeConfigService.getCachedConfig();
        if (config && config.enableRequestTiming) {
          logInfo('[SYSTEM]', requestId, `Stage [${stage}] completed in ${duration}ms`);
        }
      }
    },
    endRequest() {
      const duration = Date.now() - this.startTime;
      this.timings['Total'] = duration;
      const config = runtimeConfigService.getCachedConfig();
      if (config && config.enableRequestTiming) {
        logInfo('[SYSTEM]', requestId, `Total request execution completed in ${duration}ms`, { timings: this.timings });
      }
    }
  };

  // Attach context to the request object for easy downstream access
  req.ctx = ctx;

  // Execute within AsyncLocalStorage context for end-to-end tracing backward compatibility
  return runWithRequestContext(requestId, correlationId, () => {
    next();
  });
}

module.exports = correlationMiddleware;
