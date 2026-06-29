/**
 * SPS Cloud Functions - Authentication Middleware
 * Sprint A Final — Enterprise Handler Layer Hardening & Middleware Foundation
 */

const { authenticateUser } = require('../utils');

/**
 * Middleware to authenticate Firebase token and set user in request context.
 */
async function authenticateMiddleware(req, res, next) {
  const ctx = req.ctx;
  if (!ctx) {
    return next(new Error('Request Context (ctx) is missing. Ensure correlationMiddleware runs first.'));
  }

  ctx.startTiming('Authentication');
  try {
    const user = await authenticateUser(req, res, ctx.requestId);
    ctx.endTiming('Authentication');

    if (!user) {
      // authenticateUser already responded with sendError
      return;
    }

    // Populate context and request info
    ctx.user = user;
    req.user = user;
    next();
  } catch (err) {
    ctx.endTiming('Authentication');
    next(err);
  }
}

module.exports = authenticateMiddleware;
