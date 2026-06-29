/**
 * SPS Cloud Functions - Centralized Configuration Entrypoint
 */

const app = require('./app');
const upload = require('./upload');
const drive = require('./drive');
const security = require('./security');
const environment = require('./environment');
const features = require('./features');

module.exports = {
  app,
  upload,
  drive,
  security,
  environment,
  features,
  
  // Backward compatibility re-exports
  MAX_FILE_SIZE: upload.MAX_FILE_SIZE,
  ALLOWED_EXTENSIONS: upload.ALLOWED_EXTENSIONS,
  REJECTED_EXTENSIONS: upload.REJECTED_EXTENSIONS,
  ALLOWED_MIME_TYPES: upload.ALLOWED_MIME_TYPES,
  SUPER_ADMIN_EMAIL: security.SUPER_ADMIN_EMAIL,
  REQUEST_TIMEOUT: app.REQUEST_TIMEOUT,
  MAX_FILENAME_LENGTH: upload.MAX_FILENAME_LENGTH,
  DRIVE_FOLDERS: drive.DRIVE_FOLDERS
};
