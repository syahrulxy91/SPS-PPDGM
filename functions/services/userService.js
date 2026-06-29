/**
 * SPS Cloud Functions - User Management Service Layer
 */

const admin = require('firebase-admin');
const { logInfo, logWarn } = require('../utils');
const { LOG_CATEGORIES } = require('../constants');

const userService = {
  /**
   * Retrieves a user from Firebase Authentication
   * 
   * @param {string} uid The Firebase UID of the target user
   * @returns {Promise<admin.auth.UserRecord>} Firebase user record
   */
  async getUser(uid) {
    return await admin.auth().getUser(uid);
  },

  /**
   * Retrieves the role of a user from their custom claims
   * 
   * @param {string} uid The Firebase UID of the target user
   * @returns {Promise<string>} The user's role (defaults to 'USER')
   */
  async getUserRole(uid) {
    const user = await this.getUser(uid);
    return user.customClaims && user.customClaims.appRole ? user.customClaims.appRole : 'USER';
  },

  /**
   * Changes the custom appRole of a user in Firebase Auth and updates Firestore.
   * This is backward compatible with the changeRole endpoint.
   * 
   * @param {object} params Parameter object
   * @param {string} params.targetUid Target user's UID
   * @param {string} params.role Target new role
   * @param {string} params.callerEmail Caller's email for audit metadata
   * @returns {Promise<object>} Result metadata (targetEmail, oldRole)
   */
  async changeUserRole({ targetUid, role, callerEmail }) {
    const targetUser = await this.getUser(targetUid);
    const targetEmail = targetUser.email || '';
    const oldRole = targetUser.customClaims && targetUser.customClaims.appRole ? targetUser.customClaims.appRole : 'USER';

    // Set Firebase Custom Claims
    await admin.auth().setCustomUserClaims(targetUid, { appRole: role });

    // Update target user document in Firestore users collection
    await admin.firestore().collection('users').doc(targetUid).set({
      role: role,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedBy: callerEmail
    }, { merge: true });

    return {
      targetEmail,
      oldRole
    };
  },

  // Alias for backward compatibility
  async changeRole(params) {
    return this.changeUserRole(params);
  },

  /**
   * Disables or enables a user account in Firebase Auth and updates Firestore
   * 
   * @param {object} params Parameter object
   * @param {string} params.targetUid Target user's UID
   * @param {boolean} params.disabled Whether to disable the user account
   * @param {string} params.callerEmail Caller's email for audit metadata
   * @returns {Promise<object>} Result metadata (targetEmail)
   */
  async setDisabled({ targetUid, disabled, callerEmail }) {
    const targetUser = await this.getUser(targetUid);
    const targetEmail = targetUser.email || '';

    // Update target user status in Firebase Auth
    await admin.auth().updateUser(targetUid, { disabled });

    // Update target user document in Firestore users collection
    await admin.firestore().collection('users').doc(targetUid).set({
      disabled,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedBy: callerEmail
    }, { merge: true });

    return {
      targetEmail
    };
  },

  /**
   * Explicit method to enable a user
   */
  async enableUser({ targetUid, callerEmail }) {
    return this.setDisabled({ targetUid, disabled: false, callerEmail });
  },

  /**
   * Explicit method to disable a user
   */
  async disableUser({ targetUid, callerEmail }) {
    return this.setDisabled({ targetUid, disabled: true, callerEmail });
  },

  /**
   * Updates user profile data in Auth and/or Firestore
   */
  async updateUserProfile({ targetUid, profileData, callerEmail }) {
    const updateData = {
      ...profileData,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedBy: callerEmail
    };
    
    await admin.firestore().collection('users').doc(targetUid).set(updateData, { merge: true });
    
    // If display name or email are included, update Firebase Auth too
    const authUpdate = {};
    if (profileData.displayName) authUpdate.displayName = profileData.displayName;
    if (profileData.email) authUpdate.email = profileData.email;
    
    if (Object.keys(authUpdate).length > 0) {
      await admin.auth().updateUser(targetUid, authUpdate);
    }
    
    return { success: true };
  },

  /**
   * Synchronizes user profile information between Auth and Firestore
   */
  async syncUser({ targetUid, profileData, callerEmail }) {
    const user = await this.getUser(targetUid);
    const dbData = {
      email: user.email,
      displayName: user.displayName || '',
      photoURL: user.photoURL || '',
      disabled: user.disabled || false,
      role: (user.customClaims && user.customClaims.appRole) || 'USER',
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedBy: callerEmail || 'system_sync'
    };
    
    await admin.firestore().collection('users').doc(targetUid).set(dbData, { merge: true });
    return dbData;
  }
};

module.exports = userService;
