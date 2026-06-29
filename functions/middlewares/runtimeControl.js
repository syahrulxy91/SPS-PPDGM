/**
 * SPS Cloud Functions - Runtime Control Middleware
 * Sprint B1 — Enterprise Runtime Configuration Foundation
 */

const { sendError } = require('../utils');
const { LOG_CATEGORIES, HTTP_STATUS } = require('../constants');
const runtimeConfigService = require('../services/runtimeConfigService');

/**
 * Middleware to check maintenance mode and read-only mode.
 */
async function runtimeControlMiddleware(req, res, next) {
  const ctx = req.ctx;
  const requestId = ctx ? ctx.requestId : 'SYSTEM';

  try {
    // 1. Fetch config (cached)
    const config = await runtimeConfigService.loadConfig();

    // 2. Check Maintenance Mode
    if (config && config.maintenanceMode) {
      if (ctx) {
        ctx.logger.warn(LOG_CATEGORIES.SYSTEM, 'Akses ditolak: Sistem sedang diselenggara (Maintenance Mode).');
      }
      return sendError(
        res,
        requestId,
        LOG_CATEGORIES.SYSTEM,
        503, // Service Unavailable
        'MAINTENANCE_MODE',
        'Sistem sedang diselenggara buat sementara waktu. Sila cuba lagi seketika nanti.'
      );
    }

    // 3. Check Read-Only Mode (for mutating write routes)
    if (config && config.readOnlyMode) {
      if (ctx) {
        ctx.logger.warn(LOG_CATEGORIES.SYSTEM, 'Operasi disekat: Sistem berada dalam mod baca sahaja (Read-Only Mode).');
      }
      return sendError(
        res,
        requestId,
        LOG_CATEGORIES.SYSTEM,
        HTTP_STATUS.FORBIDDEN,
        'READ_ONLY_MODE',
        'Sistem berada dalam mod baca sahaja. Semua operasi penulisan atau perubahan disekat buat sementara waktu.'
      );
    }

    next();
  } catch (err) {
    console.error('[RuntimeControlMiddleware] Error checking runtime configuration:', err);
    // Graceful degradation: allow request if configuration fails completely
    next();
  }
}

module.exports = runtimeControlMiddleware;
