/**
 * Sektor Pengurusan Sekolah (SPS) Cloud Functions Backend
 * Sprint A Final — Hardened Manage Users Handler
 */

const { LOG_CATEGORIES, HTTP_STATUS, AUDIT_EVENT_TYPES, ERROR_CODES } = require('../constants');
const { sendSuccess, sendError } = require('../utils');
const { userService, auditService } = require('../services');
const {
  commonValidator,
  userValidator,
  AppError
} = require('../validators');
const middlewares = require('../middlewares');

/**
 * Orchestrator logic for manageUsers
 */
async function manageUsersHandler(req, res) {
  const ctx = req.ctx;
  ctx.logger.info(LOG_CATEGORIES.FUNCTION, 'Memulakan pemprosesan pengurusan pengguna (RBAC).');

  // Method Validation
  try {
    ctx.startTiming('Validation');
    commonValidator.validateRequestMethod(req, 'POST');
  } catch (err) {
    ctx.endTiming('Validation');
    ctx.endRequest();
    if (err instanceof AppError) {
      return sendError(res, ctx.requestId, LOG_CATEGORIES.SYSTEM, err.status, err.code, err.message);
    }
    return sendError(res, ctx.requestId, LOG_CATEGORIES.SYSTEM, HTTP_STATUS.INTERNAL_SERVER_ERROR, ERROR_CODES.INTERNAL_ERROR, err.message);
  }

  // Input Validation via Validator Layer
  try {
    userValidator.validateManageUserRequest(req.body);
    ctx.endTiming('Validation');
  } catch (err) {
    ctx.endTiming('Validation');
    ctx.endRequest();
    if (err instanceof AppError) {
      return sendError(res, ctx.requestId, LOG_CATEGORIES.SYSTEM, err.status, err.code, err.message);
    }
    return sendError(res, ctx.requestId, LOG_CATEGORIES.SYSTEM, HTTP_STATUS.INTERNAL_SERVER_ERROR, 'INTERNAL_SERVER_ERROR', err.message);
  }

  const { action, targetUid, role, disabled } = req.body;
  const callerEmail = ctx.user.email || '';

  try {
    if (action === 'changeRole') {
      ctx.logger.info(LOG_CATEGORIES.SECURITY, `Memulakan proses penukaran peranan untuk UID: ${targetUid} kepada ${role} oleh ${callerEmail}`);

      // Business Logic via userService
      const result = await userService.changeRole({ targetUid, role, callerEmail });

      // Audit Logging via auditService
      ctx.startTiming('Audit');
      try {
        await auditService.logSecurity({
          eventType: AUDIT_EVENT_TYPES.ROLE_CHANGED,
          performedBy: callerEmail,
          targetUser: result.targetEmail,
          oldRole: result.oldRole,
          newRole: role,
          status: "SUCCESS",
          requestId: ctx.requestId
        });
      } catch (auditErr) {
        ctx.logger.warn(LOG_CATEGORIES.SECURITY, 'Graceful Degradation: Gagal menyimpan rekod audit perubahan peranan.', auditErr);
      }
      ctx.endTiming('Audit');

      ctx.logger.info(LOG_CATEGORIES.FUNCTION, 'Perubahan peranan pengguna berjaya selesai.');
      
      ctx.startTiming('Response');
      ctx.endTiming('Response');
      ctx.endRequest();

      return sendSuccess(res, ctx.requestId, LOG_CATEGORIES.SECURITY, `Peranan bagi ${result.targetEmail} telah berjaya ditukar kepada ${role}.`, {
        targetUid,
        targetEmail: result.targetEmail,
        newRole: role
      });

    } else if (action === 'setDisabled') {
      const isDisabling = !!disabled;
      ctx.logger.info(LOG_CATEGORIES.SECURITY, `${isDisabling ? 'Menyahaktifkan' : 'Mengaktifkan'} pengguna UID: ${targetUid} oleh ${callerEmail}`);

      // Business Logic via userService
      const result = await userService.setDisabled({ targetUid, disabled: isDisabling, callerEmail });

      // Audit Logging via auditService
      ctx.startTiming('Audit');
      const eventType = isDisabling ? AUDIT_EVENT_TYPES.USER_DISABLED : AUDIT_EVENT_TYPES.USER_ENABLED;
      try {
        await auditService.logSecurity({
          eventType: eventType,
          performedBy: callerEmail,
          targetUser: result.targetEmail,
          status: "SUCCESS",
          requestId: ctx.requestId
        });
      } catch (auditErr) {
        ctx.logger.warn(LOG_CATEGORIES.SECURITY, 'Graceful Degradation: Gagal menyimpan rekod audit perubahan status akaun.', auditErr);
      }
      ctx.endTiming('Audit');

      ctx.logger.info(LOG_CATEGORIES.FUNCTION, 'Perubahan status aktif pengguna berjaya selesai.');
      
      ctx.startTiming('Response');
      ctx.endTiming('Response');
      ctx.endRequest();

      return sendSuccess(res, ctx.requestId, LOG_CATEGORIES.SECURITY, `Status pengguna ${result.targetEmail} telah berjaya dikemas kini.`, {
        targetUid,
        targetEmail: result.targetEmail,
        disabled: isDisabling
      });
    }

  } catch (err) {
    ctx.endTiming('Audit');
    ctx.endRequest();

    ctx.logger.error(LOG_CATEGORIES.SECURITY, 'Gagal menguruskan peranan/status pengguna', err);
    return sendError(res, ctx.requestId, LOG_CATEGORIES.SECURITY, HTTP_STATUS.INTERNAL_SERVER_ERROR, ERROR_CODES.INTERNAL_ERROR, `Gagal memproses pengurusan pengguna: ${err.message}`);
  }
}

// Composite execution pipeline for this endpoint
const pipeline = middlewares.compose([
  middlewares.correlation,
  middlewares.runtimeControl,
  middlewares.authenticate,
  middlewares.authorizeSuperAdmin,
  middlewares.rateLimit('manageUsers')
]);

module.exports = {
  handler: manageUsersHandler,
  pipeline: (req, res) => pipeline(req, res, manageUsersHandler)
};
