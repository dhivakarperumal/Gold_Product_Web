const {
  createAccessToken,
  createSubscriptionAccessToken,
  createUser,
  deleteUser,
  findUserForLogin,
  getOwnProfile,
  getPasswordHash,
  hashPassword,
  listUsers,
  updateNotificationPreferences,
  updateOwnProfile,
  updateOwnProfileImage,
  updatePasswordHash,
  updateUser,
  verifyPassword
} = require('../modules/authModule');
const { getAccountPlanForOwner } = require('../modules/shopSubscriptionModule');
const { isValidProfileImage, removeProfileImage } = require('../middleware/profileImageUpload');
const { parseDateRange } = require('../utils/dateRange');

async function login(req, res, next) {
  const identifier = String(req.body.identifier || '').trim();
  const password = req.body.password;
  if (!identifier || typeof password !== 'string') {
    return res.status(400).json({ message: 'Email, phone, or username and password are required' });
  }

  try {
    const user = await findUserForLogin(identifier);
    if (!user || !(await verifyPassword(password, user.password_hash))) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    if (!['admin', 'superadmin'].includes(String(user.role || '').toLowerCase())) {
      return res.status(403).json({ message: 'Only admin and super admin accounts can sign in here' });
    }
    let accountPlan = null;
    if (user.role === 'admin') {
      accountPlan = await getAccountPlanForOwner(user.user_id);
      if (['expired', 'pending'].includes(accountPlan?.account_plan_type)) {
        const expiredTrial = accountPlan.account_plan_type === 'expired';
        return res.status(403).json({
          code: expiredTrial ? 'TRIAL_EXPIRED' : 'SUBSCRIPTION_REQUIRED',
          message: expiredTrial
            ? 'Your free trial has ended. Subscribe to continue using this shop account.'
            : 'A paid subscription is required to use this shop account.',
          accountPlan
        });
      }
    }
    if (user.status !== 'Active') {
      return res.status(403).json({ message: 'This account is inactive' });
    }

    const { password_hash: passwordHash, ...publicUser } = user;
    return res.json({ user: publicUser, token: createAccessToken(user) });
  } catch (error) {
    return next(error);
  }
}

async function createSubscriptionAccess(req, res, next) {
  const identifier = String(req.body.identifier || '').trim();
  const password = req.body.password;
  if (!identifier || typeof password !== 'string') {
    return res.status(400).json({ message: 'Email, phone, or username and password are required' });
  }
  try {
    const user = await findUserForLogin(identifier);
    if (!user || !(await verifyPassword(password, user.password_hash))) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    if (user.role !== 'admin') {
      return res.status(403).json({ message: 'Subscription checkout is only available to active shop admin accounts.' });
    }
    const accountPlan = await getAccountPlanForOwner(user.user_id);
    if (!['expired', 'pending'].includes(accountPlan?.account_plan_type)) {
      return res.status(409).json({ message: 'This account does not require subscription checkout access.' });
    }
    if (user.status !== 'Active' && user.status !== 'Inactive') {
      return res.status(403).json({ message: 'Subscription checkout is only available to active shop admin accounts.' });
    }
    return res.json({
      checkoutToken: createSubscriptionAccessToken(user),
      accountPlan
    });
  } catch (error) {
    return next(error);
  }
}

async function getMyProfile(req, res, next) {
  try {
    const user = await getOwnProfile(req.storeUser.user_id);
    if (!user) return res.status(404).json({ message: 'Profile not found' });
    return res.json({ user });
  } catch (error) {
    return next(error);
  }
}

async function updateMyProfile(req, res, next) {
  const body = req.body || {};
  const username = String(body.username || '').trim();
  const name = String(body.name || '').trim();
  const email = String(body.email || '').trim().toLowerCase();
  const phone = String(body.phone || '').trim();
  const address = String(body.address || '').trim();
  if (!username || !name || !email) {
    return res.status(400).json({ message: 'Username, full name, and email are required' });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ message: 'Enter a valid email address' });
  }
  if (username.length > 150 || name.length > 150 || email.length > 255 || phone.length > 20 || address.length > 5000) {
    return res.status(400).json({ message: 'One or more profile fields exceed the allowed length' });
  }

  try {
    const user = await updateOwnProfile(req.storeUser.user_id, {
      username, name, email, phone, address
    });
    if (!user) return res.status(404).json({ message: 'Profile not found' });
    return res.json({ message: 'Profile updated successfully', user });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: 'Email or phone number is already registered' });
    }
    return next(error);
  }
}

async function changeMyPassword(req, res, next) {
  const currentPassword = req.body.currentPassword;
  const newPassword = req.body.newPassword;
  if (typeof currentPassword !== 'string' || !currentPassword
    || typeof newPassword !== 'string' || newPassword.length < 8) {
    return res.status(400).json({ message: 'Current password and a new password of at least 8 characters are required' });
  }

  try {
    const passwordHash = await getPasswordHash(req.storeUser.user_id);
    if (!passwordHash || !(await verifyPassword(currentPassword, passwordHash))) {
      return res.status(400).json({ message: 'Current password is incorrect' });
    }
    await updatePasswordHash(req.storeUser.user_id, await hashPassword(newPassword));
    return res.json({ message: 'Password changed successfully' });
  } catch (error) {
    return next(error);
  }
}

async function saveMyNotificationPreferences(req, res, next) {
  const { email, orders } = req.body || {};
  if (typeof email !== 'boolean' || typeof orders !== 'boolean') {
    return res.status(400).json({ message: 'Email and order notification preferences must be boolean values' });
  }
  try {
    const user = await updateNotificationPreferences(req.storeUser.user_id, { email, orders });
    if (!user) return res.status(404).json({ message: 'Profile not found' });
    return res.json({ message: 'Notification preferences saved', user });
  } catch (error) {
    return next(error);
  }
}

async function saveMyProfileImage(req, res, next) {
  if (!req.file) return res.status(400).json({ message: 'Choose an image to upload' });
  const imageUrl = `/uploads/profiles/${req.file.filename}`;
  let currentProfile;
  let user;
  try {
    if (!isValidProfileImage(req.file.path, req.file.mimetype)) {
      await removeProfileImage(imageUrl);
      return res.status(400).json({ message: 'The uploaded file is not a valid image' });
    }
    currentProfile = await getOwnProfile(req.storeUser.user_id);
    if (!currentProfile) {
      await removeProfileImage(imageUrl);
      return res.status(404).json({ message: 'Profile not found' });
    }
    user = await updateOwnProfileImage(req.storeUser.user_id, imageUrl);
  } catch (error) {
    await removeProfileImage(imageUrl);
    return next(error);
  }
  await removeProfileImage(currentProfile.profile_image);
  return res.json({ message: 'Profile photo updated', user });
}

async function removeMyProfileImage(req, res, next) {
  try {
    const currentProfile = await getOwnProfile(req.storeUser.user_id);
    if (!currentProfile) return res.status(404).json({ message: 'Profile not found' });
    const user = await updateOwnProfileImage(req.storeUser.user_id, null);
    await removeProfileImage(currentProfile.profile_image);
    return res.json({ message: 'Profile photo removed', user });
  } catch (error) {
    return next(error);
  }
}

async function getUsers(req, res, next) {
  const dateRange = parseDateRange(req.query);
  if (dateRange.error) return res.status(400).json({ message: dateRange.error });
  try {
    return res.json(await listUsers(dateRange));
  } catch (error) {
    return next(error);
  }
}

async function createManagedUser(req, res, next) {
  const username = String(req.body.username || req.body.name || '').trim();
  const name = String(req.body.name || username).trim();
  const email = String(req.body.email || '').trim().toLowerCase();
  const phone = String(req.body.phone || '').trim();
  const password = req.body.password;
  const role = String(req.body.role || 'user').trim().toLowerCase();

  if (!username || !name || !email || typeof password !== 'string' || password.length < 8) {
    return res.status(400).json({
      message: 'Username, name, email, and a password of at least 8 characters are required'
    });
  }
  if (username.length > 150 || name.length > 150 || email.length > 255 || phone.length > 20) {
    return res.status(400).json({ message: 'Username, name, email, or phone exceeds the allowed length' });
  }
  if (!['admin', 'manager', 'dealer', 'user'].includes(role)) {
    return res.status(400).json({ message: 'Role must be admin, manager, dealer, or user' });
  }

  try {
    const user = await createUser({ username, email, phone, password, status: 'Active', role });
    return res.status(201).json({ message: 'Customer created successfully', user });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: 'Email or phone number is already registered' });
    }
    return next(error);
  }
}

async function updateManagedUser(req, res, next) {
  const userId = Number(req.params.id);
  const username = String(req.body.username || '').trim();
  const name = String(req.body.name || username).trim();
  const email = String(req.body.email || '').trim().toLowerCase();
  const phone = String(req.body.phone || '').trim();
  const role = String(req.body.role || 'user').trim().toLowerCase();
  const hasStatus = Object.prototype.hasOwnProperty.call(req.body, 'status');
  const status = hasStatus ? String(req.body.status).trim().toLowerCase() : undefined;

  if (!Number.isSafeInteger(userId) || userId < 1) {
    return res.status(400).json({ message: 'Customer ID is invalid' });
  }
  if (!username || !name || !email) {
    return res.status(400).json({ message: 'Username, name, and email are required' });
  }
  if (username.length > 150 || name.length > 150 || email.length > 255 || phone.length > 20) {
    return res.status(400).json({ message: 'Username, name, email, or phone exceeds the allowed length' });
  }
  if (!['admin', 'manager', 'dealer', 'user'].includes(role)) {
    return res.status(400).json({ message: 'Role must be admin, manager, dealer, or user' });
  }
  if (hasStatus && !['active', 'inactive'].includes(status)) {
    return res.status(400).json({ message: 'Status must be active or inactive' });
  }
  if (userId === req.adminUser.id && role !== req.adminUser.role) {
    return res.status(400).json({ message: 'You cannot change your own administrator role' });
  }
  if (userId === req.adminUser.id && status === 'inactive') {
    return res.status(400).json({ message: 'You cannot deactivate your own account' });
  }

  try {
    const user = await updateUser(userId, { username, name, email, phone, role, status });
    if (!user) return res.status(404).json({ message: 'Customer not found' });
    return res.json({ message: 'Customer updated successfully', user });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: 'Email or phone number is already registered' });
    }
    return next(error);
  }
}

async function removeManagedUser(req, res, next) {
  const userId = Number(req.params.id);
  if (!Number.isSafeInteger(userId) || userId < 1) {
    return res.status(400).json({ message: 'Customer ID is invalid' });
  }
  if (userId === req.adminUser.id) {
    return res.status(400).json({ message: 'You cannot delete your own administrator account' });
  }

  try {
    const deleted = await deleteUser(userId);
    if (!deleted) return res.status(404).json({ message: 'Customer not found' });
    return res.json({ message: 'Customer deleted successfully' });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  createManagedUser,
  changeMyPassword,
  createSubscriptionAccess,
  getUsers,
  getMyProfile,
  login,

  removeManagedUser,
  removeMyProfileImage,
  saveMyProfileImage,
  saveMyNotificationPreferences,
  updateMyProfile,
  updateManagedUser
};
