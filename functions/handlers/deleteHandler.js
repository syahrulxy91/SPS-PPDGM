/**
 * Sektor Pengurusan Sekolah (SPS) Cloud Functions Backend
 * Sprint A Final — Hardened Delete Handler
 */

const { LOG_CATEGORIES, HTTP_STATUS, ERROR_CODES } = require('../constants');
const { sendSuccess, sendError } = require('../utils');
const { driveService, auditService } = require('../services');
const {
  commonValidator,
  driveValidator,
  AppError
} = require('../validators');
const middlewares = require('../middlewares');

/**
 * Orchestrator logic for deleteFromGoogleDrive
 */
async function deleteHandler(req, res) {
  const ctx = req.ctx;
  ctx.logger.info(LOG_CATEGORIES.FUNCTION, 'Memulakan pemprosesan padam fail dari Google Drive.');

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
  const { fileId } = req.body;
  try {
    driveValidator.validateDriveDeleteRequest(fileId);
    ctx.endTiming('Validation');
  } catch (err) {
    ctx.endTiming('Validation');
    ctx.endRequest();
    if (err instanceof AppError) {
      return sendError(res, ctx.requestId, LOG_CATEGORIES.DRIVE, err.status, err.code, err.message);
    }
    return sendError(res, ctx.requestId, LOG_CATEGORIES.DRIVE, HTTP_STATUS.INTERNAL_SERVER_ERROR, 'INTERNAL_SERVER_ERROR', err.message);
  }

  try {
    ctx.startTiming('GoogleDrive');
    ctx.logger.info(LOG_CATEGORIES.DRIVE, `Memadam fail ID "${fileId}" daripada Google Drive...`);
    await driveService.deleteFile({ driveFileId: fileId });
    ctx.endTiming('GoogleDrive');

    ctx.startTiming('Audit');
    ctx.logger.info(LOG_CATEGORIES.AUDIT, `Fail ID "${fileId}" berjaya dipadam dari Google Drive oleh ${ctx.user.email}.`);
    try {
      await auditService.logUserAction({
        eventType: 'DELETE',
        performedBy: ctx.user.email || '',
        targetUser: ctx.user.email || '',
        details: { fileId: fileId },
        status: 'SUCCESS',
        requestId: ctx.requestId
      });
    } catch (auditErr) {
      ctx.logger.warn(LOG_CATEGORIES.DRIVE, 'Graceful Degradation: Gagal menyimpan rekod audit pemadaman.', auditErr);
    }
    ctx.endTiming('Audit');

    ctx.logger.info(LOG_CATEGORIES.FUNCTION, 'Permintaan padam fail selesai.');
    
    ctx.startTiming('Response');
    ctx.endTiming('Response');
    ctx.endRequest();

    return sendSuccess(res, ctx.requestId, LOG_CATEGORIES.DRIVE, `Fail ID "${fileId}" telah berjaya dipadam dari Google Drive.`, {
      fileId: fileId
    });

  } catch (deleteError) {
    ctx.endTiming('GoogleDrive');
    ctx.endTiming('Audit');
    ctx.endRequest();

    ctx.logger.error(LOG_CATEGORIES.DRIVE, 'Gagal memadam fail dari Google Drive', deleteError);
    return sendError(res, ctx.requestId, LOG_CATEGORIES.DRIVE, HTTP_STATUS.INTERNAL_SERVER_ERROR, ERROR_CODES.INTERNAL_ERROR, `Gagal memadam fail dari Google Drive: ${deleteError.message}`);
  }
}

// Composite execution pipeline for this endpoint
const pipeline = middlewares.compose([
  middlewares.correlation,
  middlewares.runtimeControl,
  middlewares.authenticate,
  middlewares.authorizeUser,
  middlewares.rateLimit('delete')
]);

module.exports = {
  handler: deleteHandler,
  pipeline: (req, res) => pipeline(req, res, deleteHandler)
};
