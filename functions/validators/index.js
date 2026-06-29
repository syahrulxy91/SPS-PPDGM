/**
 * SPS Cloud Functions - Centralized Validator Layer
 */

const commonValidator = require('./commonValidator');
const uploadValidator = require('./uploadValidator');
const driveValidator = require('./driveValidator');
const userValidator = require('./userValidator');
const runtimeConfigValidator = require('./runtimeConfigValidator');

module.exports = {
  commonValidator,
  uploadValidator,
  driveValidator,
  userValidator,
  runtimeConfigValidator,
  
  // Directly export AppError for ease of access
  AppError: commonValidator.AppError
};
