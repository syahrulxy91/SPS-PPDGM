/**
 * Sektor Pengurusan Sekolah (SPS) Cloud Functions Backend
 * Sprint A Final — Hardened Upload Handler
 */

const admin = require('firebase-admin');
const Busboy = require('busboy');
const { LOG_CATEGORIES, HTTP_STATUS, ERROR_CODES } = require('../constants');
const { sendSuccess, sendError } = require('../utils');
const { driveService, auditService } = require('../services');
const {
  commonValidator,
  uploadValidator,
  driveValidator,
  AppError
} = require('../validators');
const middlewares = require('../middlewares');

/**
 * Normalizes an uploadRequest document across different schema versions (v1, v2, etc.).
 */
function normalizeUploadRequest(docData) {
  if (!docData) return null;

  const version = typeof docData.version === 'number' ? docData.version : 1;

  let requestMetadata = docData.requestMetadata;
  if (!requestMetadata) {
    requestMetadata = {
      clientIp: docData.createdByIP || '',
      forwardedFor: '',
      host: '',
      origin: '',
      userAgent: docData.userAgent || ''
    };
  } else {
    requestMetadata = {
      clientIp: requestMetadata.clientIp || docData.createdByIP || '',
      forwardedFor: requestMetadata.forwardedFor || '',
      host: requestMetadata.host || '',
      origin: requestMetadata.origin || '',
      userAgent: requestMetadata.userAgent || docData.userAgent || ''
    };
  }

  return {
    uploadToken: docData.uploadToken || '',
    uid: docData.uid || '',
    email: docData.email || '',
    status: docData.status || '',
    requestId: docData.requestId || '',
    version,
    lastAccessedAt: docData.lastAccessedAt || null,
    createdByIP: docData.createdByIP || requestMetadata.clientIp || '',
    userAgent: docData.userAgent || requestMetadata.userAgent || '',
    requestMetadata,
    createdAt: docData.createdAt || null,
    expiresAt: docData.expiresAt || null,
    completedAt: docData.completedAt || null,
    failedAt: docData.failedAt || null,
    errorMessage: docData.errorMessage || '',
    driveFileId: docData.driveFileId || '',
    driveFileUrl: docData.driveFileUrl || '',
    fileSize: docData.fileSize || 0,
    unit: docData.unit || ''
  };
}

/**
 * Orchestrator logic for uploadToGoogleDrive
 */
async function uploadHandler(req, res) {
  const ctx = req.ctx;
  ctx.logger.info(LOG_CATEGORIES.FUNCTION, 'Memulakan pemprosesan muat naik fail ke Google Drive.');

  // Method Validation
  try {
    ctx.startTiming('Validation');
    commonValidator.validateRequestMethod(req, 'POST');
    ctx.endTiming('Validation');
  } catch (err) {
    ctx.endTiming('Validation');
    ctx.endRequest();
    if (err instanceof AppError) {
      return sendError(res, ctx.requestId, LOG_CATEGORIES.SYSTEM, err.status, err.code, err.message);
    }
    return sendError(res, ctx.requestId, LOG_CATEGORIES.SYSTEM, HTTP_STATUS.INTERNAL_SERVER_ERROR, ERROR_CODES.INTERNAL_ERROR, err.message);
  }

  // Read X-Upload-Token
  const uploadToken = req.headers['x-upload-token'] || req.headers['X-Upload-Token'];
  if (!uploadToken) {
    ctx.endRequest();
    return sendError(res, ctx.requestId, LOG_CATEGORIES.UPLOAD, HTTP_STATUS.BAD_REQUEST, ERROR_CODES.INVALID_REQUEST, 'Token muat naik ("X-Upload-Token") diperlukan dalam pengepala HTTP.');
  }

  // Reject empty upload tokens or malformed UUID values
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(uploadToken)) {
    ctx.endRequest();
    return sendError(res, ctx.requestId, LOG_CATEGORIES.UPLOAD, HTTP_STATUS.BAD_REQUEST, ERROR_CODES.INVALID_REQUEST, 'Format token muat naik ("X-Upload-Token") tidak sah. Sila gunakan format UUID v4.');
  }

  // Atomic Check & Create uploadRequests with doc(uploadToken)
  const uploadRequestRef = admin.firestore().collection('uploadRequests').doc(uploadToken);
  
  try {
    const expiresAtDate = new Date();
    expiresAtDate.setHours(expiresAtDate.getHours() + 24); // Expires in 24 hours

    await uploadRequestRef.create({
      uploadToken,
      uid: ctx.user.uid,
      email: ctx.user.email || '',
      status: 'PENDING',
      requestId: ctx.requestId,
      version: 2,
      lastAccessedAt: admin.firestore.FieldValue.serverTimestamp(),
      createdByIP: ctx.requestMetadata.clientIp, // backward compatibility
      userAgent: ctx.requestMetadata.userAgent,
      requestMetadata: ctx.requestMetadata,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      expiresAt: admin.firestore.Timestamp.fromDate(expiresAtDate)
    });

    ctx.logger.info(LOG_CATEGORIES.UPLOAD, `Token muat naik ${uploadToken} berjaya didaftarkan secara atomik.`);

  } catch (err) {
    if (err.code === 6 || err.message.includes('ALREADY_EXISTS')) {
      const docSnap = await uploadRequestRef.get();
      if (docSnap.exists) {
        await uploadRequestRef.update({
          lastAccessedAt: admin.firestore.FieldValue.serverTimestamp()
        }).catch(dbErr => {
          ctx.logger.warn(LOG_CATEGORIES.UPLOAD, 'Gagal mengemaskini lastAccessedAt bagi permintaan pendua', dbErr);
        });

        const docData = docSnap.data();
        const normalizedDoc = normalizeUploadRequest(docData);

        if (normalizedDoc.status === 'SUCCESS') {
          ctx.logger.info(LOG_CATEGORIES.UPLOAD, `Permintaan pendua dikesan bagi token ${uploadToken}. Mengembalikan data sedia ada dari Google Drive.`);
          ctx.startTiming('Response');
          ctx.endTiming('Response');
          ctx.endRequest();
          return sendSuccess(res, ctx.requestId, LOG_CATEGORIES.UPLOAD, 'Fail telah berjaya dimuat naik ke Google Drive (Pendua / Diperoleh semula).', {
            id: normalizedDoc.driveFileId,
            url: normalizedDoc.driveFileUrl,
            size: normalizedDoc.fileSize || 0
          });
        } else if (normalizedDoc.status === 'PENDING') {
          ctx.logger.warn(LOG_CATEGORIES.UPLOAD, `Permintaan muat naik bagi token ${uploadToken} sedang diproses.`);
          ctx.endRequest();
          return sendError(res, ctx.requestId, LOG_CATEGORIES.UPLOAD, HTTP_STATUS.CONFLICT, 'UPLOAD_IN_PROGRESS', 'Muat naik fail sedang diproses.');
        } else if (normalizedDoc.status === 'FAILED') {
          const referenceTimestamp = normalizedDoc.failedAt || normalizedDoc.completedAt || normalizedDoc.createdAt;
          const referenceTime = referenceTimestamp ? referenceTimestamp.toDate().getTime() : Date.now();
          const diffMs = Date.now() - referenceTime;
          const fiveMinutesMs = 5 * 60 * 1000;

          if (diffMs < fiveMinutesMs) {
            ctx.logger.warn(LOG_CATEGORIES.UPLOAD, `Permintaan muat naik bagi token ${uploadToken} telah gagal kurang daripada 5 minit yang lalu.`);
            ctx.endRequest();
            return sendError(res, ctx.requestId, LOG_CATEGORIES.UPLOAD, HTTP_STATUS.CONFLICT, 'UPLOAD_FAILED_RECENTLY', 'Muat naik fail baru-baru ini gagal. Sila cuba lagi selepas 5 minit atau gunakan token yang baharu.');
          } else {
            ctx.logger.info(LOG_CATEGORIES.UPLOAD, `Permintaan muat naik bagi token ${uploadToken} yang gagal melebihi 5 minit dikesan. Memulakan self-healing.`);
            
            await uploadRequestRef.delete().catch(deleteErr => {
              ctx.logger.warn(LOG_CATEGORIES.UPLOAD, 'Gagal memadam fail/token uploadRequests bertaraf FAILED yang melebihi 5 minit', deleteErr);
            });

            try {
              const expiresAtDate = new Date();
              expiresAtDate.setHours(expiresAtDate.getHours() + 24);

              await uploadRequestRef.create({
                uploadToken,
                uid: ctx.user.uid,
                email: ctx.user.email || '',
                status: 'PENDING',
                requestId: ctx.requestId,
                version: 2,
                lastAccessedAt: admin.firestore.FieldValue.serverTimestamp(),
                createdByIP: ctx.requestMetadata.clientIp,
                userAgent: ctx.requestMetadata.userAgent,
                requestMetadata: ctx.requestMetadata,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                expiresAt: admin.firestore.Timestamp.fromDate(expiresAtDate)
              });
              ctx.logger.info(LOG_CATEGORIES.UPLOAD, `Token muat naik ${uploadToken} berjaya didaftarkan semula secara atomik selepas self-healing.`);
            } catch (recreateErr) {
              ctx.logger.error(LOG_CATEGORIES.UPLOAD, 'Ralat pendaftaran semula muat naik selepas self-healing', recreateErr);
              ctx.endRequest();
              return sendError(res, ctx.requestId, LOG_CATEGORIES.UPLOAD, HTTP_STATUS.INTERNAL_SERVER_ERROR, ERROR_CODES.INTERNAL_ERROR, `Ralat pendaftaran semula token muat naik: ${recreateErr.message}`);
            }
          }
        }
      } else {
        ctx.logger.error(LOG_CATEGORIES.UPLOAD, 'Ralat pendaftaran muat naik atau ralat sistem', err);
        ctx.endRequest();
        return sendError(res, ctx.requestId, LOG_CATEGORIES.UPLOAD, HTTP_STATUS.INTERNAL_SERVER_ERROR, ERROR_CODES.INTERNAL_ERROR, `Ralat pemprosesan token muat naik: ${err.message}`);
      }
    } else {
      ctx.logger.error(LOG_CATEGORIES.UPLOAD, 'Ralat pendaftaran muat naik atau ralat sistem', err);
      ctx.endRequest();
      return sendError(res, ctx.requestId, LOG_CATEGORIES.UPLOAD, HTTP_STATUS.INTERNAL_SERVER_ERROR, ERROR_CODES.INTERNAL_ERROR, `Ralat pemprosesan token muat naik: ${err.message}`);
    }
  }

  try {
    ctx.logger.info(LOG_CATEGORIES.UPLOAD, 'Memulakan pemprosesan borang multipart (Busboy)...');
    const busboy = Busboy({ headers: req.headers });
    let fileBuffer = null;
    let fileName = '';
    let mimeType = '';
    let unit = '';

    busboy.on('file', (fieldname, file, info) => {
      const { filename, mimeType: fileMimeType } = info;
      fileName = filename;
      mimeType = fileMimeType;
      const chunks = [];

      file.on('data', (data) => {
        chunks.push(data);
      });

      file.on('end', () => {
        fileBuffer = Buffer.concat(chunks);
      });
    });

    busboy.on('field', (fieldname, val) => {
      if (fieldname === 'unit') {
        unit = val;
      }
    });

    busboy.on('finish', async () => {
      try {
        ctx.startTiming('Validation');
        uploadValidator.validateUploadRequest(unit);
        driveValidator.validateDriveFolder(unit);
        uploadValidator.validateUploadFile(fileName, mimeType, fileBuffer ? fileBuffer.length : 0);
        ctx.endTiming('Validation');

        ctx.logger.info(LOG_CATEGORIES.DRIVE, `Memproses muat naik fail "${fileName}" ke Google Drive untuk unit: ${unit}`);

        const uploadStart = Date.now();
        ctx.startTiming('GoogleDrive');
        const driveFile = await driveService.uploadFile({
          fileBuffer,
          mimeType,
          originalFileName: fileName,
          unit
        });
        ctx.endTiming('GoogleDrive');
        const durationSeconds = (Date.now() - uploadStart) / 1000;

        ctx.logger.info(LOG_CATEGORIES.DRIVE, `Fail berjaya dicipta di Google Drive. ID: ${driveFile.id}`);

        ctx.startTiming('Audit');
        try {
          await auditService.logUpload({
            user: ctx.user,
            unit: unit,
            fileName: driveFile.generatedFileName,
            fileSize: driveFile.size,
            mimeType: mimeType,
            driveFileId: driveFile.id,
            driveFileUrl: driveFile.url,
            originalFileName: fileName,
            requestId: ctx.requestId,
            durationSeconds
          });
        } catch (auditErr) {
          ctx.logger.warn(LOG_CATEGORIES.UPLOAD, 'Graceful Degradation: Gagal menyimpan rekod audit muat naik.', auditErr);
        }
        ctx.endTiming('Audit');

        await uploadRequestRef.update({
          status: 'SUCCESS',
          unit,
          driveFileId: driveFile.id,
          driveFileUrl: driveFile.url,
          fileSize: driveFile.size,
          completedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        ctx.logger.info(LOG_CATEGORIES.FUNCTION, 'Permintaan muat naik selesai.');
        
        ctx.startTiming('Response');
        ctx.endTiming('Response');
        ctx.endRequest();

        return sendSuccess(res, ctx.requestId, LOG_CATEGORIES.UPLOAD, 'Fail telah berjaya dimuat naik ke Google Drive.', {
          id: driveFile.id,
          url: driveFile.url,
          size: driveFile.size
        });

      } catch (uploadError) {
        ctx.endTiming('Validation');
        ctx.endTiming('GoogleDrive');
        ctx.endTiming('Audit');

        const errorMessage = uploadError.message || 'Ralat muat naik tidak diketahui';
        
        ctx.startTiming('Audit');
        await auditService.logUpload({
          user: ctx.user,
          unit: unit,
          fileName: fileName,
          fileSize: fileBuffer ? fileBuffer.length : 0,
          mimeType: mimeType,
          originalFileName: fileName,
          requestId: ctx.requestId,
          uploadStatus: "FAILED"
        }).catch(auditErr => {
          ctx.logger.error(LOG_CATEGORIES.UPLOAD, 'Gagal merekod audit muat naik gagal', auditErr);
        });
        ctx.endTiming('Audit');

        await uploadRequestRef.update({
          status: 'FAILED',
          errorMessage,
          failedAt: admin.firestore.FieldValue.serverTimestamp()
        }).catch(dbErr => {
          ctx.logger.error(LOG_CATEGORIES.UPLOAD, 'Gagal mengemas kini status ke FAILED', dbErr);
        });

        ctx.endRequest();

        if (uploadError instanceof AppError) {
          return sendError(res, ctx.requestId, LOG_CATEGORIES.UPLOAD, uploadError.status, uploadError.code, uploadError.message);
        }
        ctx.logger.error(LOG_CATEGORIES.DRIVE, 'Ralat semasa memproses muat naik fail ke Drive API', uploadError);
        return sendError(res, ctx.requestId, LOG_CATEGORIES.DRIVE, HTTP_STATUS.INTERNAL_SERVER_ERROR, ERROR_CODES.UPLOAD_FAILED, `Gagal menulis ke Google Drive: ${uploadError.message}`);
      }
    });

    if (req.rawBody) {
      busboy.end(req.rawBody);
    } else {
      req.pipe(busboy);
    }

  } catch (err) {
    const errorMessage = err.message || 'Ralat permulaan tidak diketahui';
    await admin.firestore().collection('uploadRequests').doc(uploadToken).update({
      status: 'FAILED',
      errorMessage,
      failedAt: admin.firestore.FieldValue.serverTimestamp()
    }).catch(() => {});

    ctx.logger.error(LOG_CATEGORIES.UPLOAD, 'Ralat pemprosesan parser Busboy', err);
    ctx.endRequest();
    return sendError(res, ctx.requestId, LOG_CATEGORIES.UPLOAD, HTTP_STATUS.INTERNAL_SERVER_ERROR, ERROR_CODES.INTERNAL_ERROR, `Ralat pemprosesan borang: ${err.message}`);
  }
}

// Composite execution pipeline for this endpoint
const pipeline = middlewares.compose([
  middlewares.correlation,
  middlewares.runtimeControl,
  middlewares.authenticate,
  middlewares.authorizeUser,
  middlewares.rateLimit('upload')
]);

module.exports = {
  handler: uploadHandler,
  pipeline: (req, res) => pipeline(req, res, uploadHandler)
};
