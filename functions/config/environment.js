/**
 * SPS Cloud Functions - Environment Helper
 */

const getEnvironment = () => {
  if (process.env.FUNCTIONS_EMULATOR === 'true') {
    return 'EMULATOR';
  }
  if (process.env.AIS_STUDIO === 'true' || process.env.NODE_ENV === 'development') {
    return 'DEVELOPMENT';
  }
  return 'PRODUCTION';
};

module.exports = {
  current: getEnvironment(),
  isEmulator: getEnvironment() === 'EMULATOR',
  isDevelopment: getEnvironment() === 'DEVELOPMENT',
  isProduction: getEnvironment() === 'PRODUCTION'
};
