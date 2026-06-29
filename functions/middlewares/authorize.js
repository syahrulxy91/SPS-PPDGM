/**
 * SPS Cloud Functions - Authorization Middleware
 * Sprint A Final — Enterprise Handler Layer Hardening & Middleware Foundation
 */

const { authorizeUser, authorizeSuperAdmin } = require('../utils');

/**
 * Middleware for general user authorization (RBAC)
 */
async function authorizeUserMiddleware(req, res, next) {
  const ctx = req.ctx;
  if (!ctx) {
    return next(new Error('Request Context (ctx) is missing.'));
  }

  ctx.startTiming('Authorization');
  const authorized = authorizeUser(ctx.user, res, ctx.requestId);
  ctx.endTiming('Authorization');

  if (!authorized) {
    // authorizeUser already responded with sendError
    return;
  }

  next();
}

/**
 * Middleware for Super Admin authorization (RBAC)
 */
async function authorizeSuperAdminMiddleware(req, res, next) {
  const ctx = req.ctx;
  if (!ctx) {
    return next(new Error('Request Context (ctx) is missing.'));
  }

  ctx.startTiming('Authorization');
  const authorized = authorizeSuperAdmin(ctx.user, res, ctx.requestId);
  ctx.endTiming('Authorization');

  if (!authorized) {
    // authorizeSuperAdmin already responded with sendError
    return;
  }

  next();
}

module.exports = {
  authorizeUser: authorizeUserMiddleware,
  authorizeSuperAdmin: authorizeSuperAdminMiddleware
};
