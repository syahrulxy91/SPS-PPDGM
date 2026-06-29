/**
 * SPS Cloud Functions - User & Role Management Validator Layer
 */

const { HTTP_STATUS } = require('../constants');
const { AppError } = require('./commonValidator');

/**
 * Validates target appRole value
 */
function validateRole(role) {
  if (!role || !['SUPER_ADMIN', 'ADMIN', 'USER'].includes(role)) {
    throw new AppError(
      HTTP_STATUS.BAD_REQUEST,
      'BAD_REQUEST',
      'Parameter role tidak sah.'
    );
  }
  return true;
}

/**
 * Validates target disabled status value
 */
function validateUserStatus(disabled) {
  if (disabled === undefined || disabled === null) {
    throw new AppError(
      HTTP_STATUS.BAD_REQUEST,
      'BAD_REQUEST',
      'Parameter disabled diperlukan.'
    );
  }
  return true;
}

/**
 * Validates custom user claims structure
 */
function validateCustomClaims(claims) {
  if (claims && claims.appRole) {
    validateRole(claims.appRole);
  }
  return true;
}

/**
 * Validates manageUsers requests payload and action integrity
 */
function validateManageUserRequest(body) {
  const { action, targetUid, role, disabled } = body;
  
  if (!targetUid) {
    throw new AppError(
      HTTP_STATUS.BAD_REQUEST,
      'BAD_REQUEST',
      'Parameter targetUid diperlukan.'
    );
  }

  if (action === 'changeRole') {
    validateRole(role);
  } else if (action === 'setDisabled') {
    validateUserStatus(disabled);
  } else {
    throw new AppError(
      HTTP_STATUS.BAD_REQUEST,
      'BAD_REQUEST',
      'Action tidak sah atau tidak disokong.'
    );
  }
  return true;
}

module.exports = {
  validateRole,
  validateUserStatus,
  validateCustomClaims,
  validateManageUserRequest
};
