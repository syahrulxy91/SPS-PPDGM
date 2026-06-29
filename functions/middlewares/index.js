/**
 * SPS Cloud Functions - Middlewares Entrypoint & Composition Pipeline
 * Sprint A Final — Enterprise Handler Layer Hardening & Middleware Foundation
 */

const correlation = require('./correlation');
const authenticate = require('./authenticate');
const { authorizeUser, authorizeSuperAdmin } = require('./authorize');
const rateLimit = require('./rateLimit');
const runtimeControl = require('./runtimeControl');

/**
 * Sequential middleware composition pipeline runner.
 * 
 * @param {Function[]} middlewares Array of standard Express/Cloud Functions middlewares
 * @returns {Function} Express-compatible middleware or request handler
 */
function compose(middlewares) {
  return (req, res, finalHandler) => {
    let index = 0;
    function next(err) {
      if (err) {
        const { sendError } = require('../utils');
        const requestId = req.ctx ? req.ctx.requestId : 'SYSTEM';
        const { LOG_CATEGORIES, HTTP_STATUS, ERROR_CODES } = require('../constants');
        return sendError(
          res,
          requestId,
          LOG_CATEGORIES.SYSTEM,
          HTTP_STATUS.INTERNAL_SERVER_ERROR,
          ERROR_CODES.INTERNAL_ERROR,
          `Middleware Exception: ${err.message}`
        );
      }

      if (index < middlewares.length) {
        const middleware = middlewares[index++];
        try {
          // Resolve promise or normal execution
          const result = middleware(req, res, next);
          if (result && typeof result.catch === 'function') {
            result.catch(next);
          }
        } catch (syncErr) {
          next(syncErr);
        }
      } else if (finalHandler) {
        try {
          const result = finalHandler(req, res);
          if (result && typeof result.catch === 'function') {
            result.catch(next);
          }
        } catch (handlerErr) {
          next(handlerErr);
        }
      }
    }
    next();
  };
}

module.exports = {
  correlation,
  authenticate,
  authorizeUser,
  authorizeSuperAdmin,
  rateLimit,
  runtimeControl,
  compose
};
