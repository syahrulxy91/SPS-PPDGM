/**
 * SPS Cloud Functions - Security Configuration
 */

module.exports = {
  SUPER_ADMIN_EMAIL: 'syahrulxy91@gmail.com',
  RATE_LIMITS: {
    USER: { upload: 20, delete: 10, manageUsers: 0 },
    ADMIN: { upload: 50, delete: 30, manageUsers: 0 },
    SUPER_ADMIN: { upload: 100, delete: 100, manageUsers: 30 }
  },
  CORS: {
    origin: true
  }
};
