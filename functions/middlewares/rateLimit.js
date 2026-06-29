/**
 * SPS Cloud Functions - Rate Limiting Middleware
 * Sprint A Final — Enterprise Handler Layer Hardening & Middleware Foundation
 */

const { checkRateLimit } = require('../utils');

/**
 * Factory middleware to enforce rate limits based on function name.
 * 
 * @param {string} functionName Name of the function ('upload', 'delete', or 'manageUsers')
 */
function rateLimitMiddleware(functionName) {
  return async (req, res, next) => {
    const ctx = req.ctx;
    if (!ctx) {
      return next(new Error('Request Context (ctx) is missing.'));
    }

    ctx.startTiming('RateLimit');
    try {
      const rateLimitPassed = await checkRateLimit({
        req,
        res,
        user: ctx.user,
        functionName,
        requestId: ctx.requestId
      });
      ctx.endTiming('RateLimit');

      if (!rateLimitPassed) {
        // checkRateLimit already responded with sendError
        return;
      }

      next();
    } catch (err) {
      ctx.endTiming('RateLimit');
      next(err);
    }
  };
}

module.exports = rateLimitMiddleware;
