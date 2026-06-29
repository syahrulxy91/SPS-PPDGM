/**
 * SPS Cloud Functions - Upload Configuration
 */

module.exports = {
  MAX_FILE_SIZE: 20 * 1024 * 1024, // 20MB
  MAX_FILENAME_LENGTH: 255,
  ALLOWED_EXTENSIONS: ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'jpg', 'jpeg', 'png'],
  REJECTED_EXTENSIONS: ['exe', 'bat', 'cmd', 'apk', 'js', 'jar', 'msi', 'dll', 'ps1', 'zip', 'rar', '7z', 'iso', 'mp4', 'avi', 'mov'],
  ALLOWED_MIME_TYPES: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'image/jpeg',
    'image/png',
    'image/pjpeg',
    'application/octet-stream'
  ],
  FILE_NAME_FORMAT: "YYYY-MM-DD_HHmmss_SSS_UNIT_FILENAME"
};
