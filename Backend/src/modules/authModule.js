const bcrypt = require('bcryptjs');
const crypto = require('node:crypto');
const jwt = require('jsonwebtoken');
const { pool } = require('../config/db');
const { addDateRangeCondition } = require('../utils/dateRange');

const USER_COLUMNS = `
  id,
  user_id,
  username,
  name,
  email,
  phone,
  role,
  CASE WHEN status = 'active' THEN 'Active' ELSE 'Inactive' END AS status,
  created_at
`;

async function initializeAuthModule() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      user_id VARCHAR(255) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
      username VARCHAR(150) NOT NULL,
      name VARCHAR(150) NOT NULL,
      email VARCHAR(255) NOT NULL UNIQUE,
      phone VARCHAR(20) NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      address TEXT NULL,
      profile_image VARCHAR(255) NULL,
      notification_preferences TEXT NULL,
      role VARCHAR(32) NOT NULL DEFAULT 'user',
      status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_users_user_id (user_id)
    )
  `);
  const [idColumns] = await pool.query("SHOW COLUMNS FROM users LIKE 'id'");
  const [userIdColumns] = await pool.query("SHOW COLUMNS FROM users LIKE 'user_id'");
  if (!idColumns.length || !/^varchar\(255\)$/i.test(userIdColumns[0]?.Type || '')) {
    throw new Error('The users table needs the UUID migration. Run the users UUID migration before starting the backend.');
  }
  const [nameColumns] = await pool.query("SHOW COLUMNS FROM users LIKE 'name'");
  const nameLength = Number(String(nameColumns[0]?.Type || '').match(/^varchar\((\d+)\)$/i)?.[1] || 0);
  if (nameLength < 150) {
    await pool.query('ALTER TABLE users MODIFY COLUMN name VARCHAR(150) NOT NULL');
  }
  const [usernameColumns] = await pool.query("SHOW COLUMNS FROM users LIKE 'username'");
  const usernameLength = Number(String(usernameColumns[0]?.Type || '').match(/^varchar\((\d+)\)$/i)?.[1] || 0);
  if (usernameLength < 150) {
    await pool.query('ALTER TABLE users MODIFY COLUMN username VARCHAR(150) NOT NULL');
  }
  for (const column of ['address', 'profile_image', 'notification_preferences']) {
    const [columns] = await pool.query(`SHOW COLUMNS FROM users LIKE '${column}'`);
    if (!columns.length) {
      await pool.query(`ALTER TABLE users ADD COLUMN ${column} TEXT NULL`);
    }
  }
  const [uuidTriggers] = await pool.execute(
    `SELECT TRIGGER_NAME FROM information_schema.TRIGGERS
     WHERE TRIGGER_SCHEMA = DATABASE() AND EVENT_OBJECT_TABLE = 'users'
       AND TRIGGER_NAME = 'bi_users_uuid'`
  );
  if (!uuidTriggers.length) {
    await pool.query(`
      CREATE TRIGGER bi_users_uuid
      BEFORE INSERT ON users
      FOR EACH ROW
      SET NEW.user_id = IF(NEW.user_id IS NULL OR NEW.user_id = '', UUID(), NEW.user_id)
    `);
  }
}

async function insertUser(connection, { username, name = username, email, phone, password, status, role = 'user' }) {
  const passwordHash = await bcrypt.hash(password, 12);
  const [result] = await connection.execute(
    `INSERT INTO users (user_id, username, name, email, phone, password_hash, role, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [crypto.randomUUID(), username, name, email, phone || null, passwordHash, role, String(status).toLowerCase()]
  );
  return result.insertId;
}

async function createUser({ username, email, phone, password, status, role = 'user' }) {
  const userId = await insertUser(pool, { username, email, phone, password, status, role });
  return getUserById(userId);
}

async function getUserById(id) {
  const [users] = await pool.execute(
    `SELECT ${USER_COLUMNS} FROM users WHERE id = ?`,
    [id]
  );
  return users[0] || null;
}

async function getUserByUserId(userId) {
  const [users] = await pool.execute(
    `SELECT ${USER_COLUMNS} FROM users WHERE user_id = ?`,
    [userId]
  );
  return users[0] || null;
}

async function getOwnProfile(userId) {
  const [users] = await pool.execute(
    `SELECT id, user_id, username, name, email, phone, address, profile_image, notification_preferences,
            role, CASE WHEN status = 'active' THEN 'Active' ELSE 'Inactive' END AS status,
            created_at, updated_at
     FROM users WHERE user_id = ?`,
    [userId]
  );
  const user = users[0];
  if (!user) return null;
  let notificationPreferences = { email: true, orders: true };
  if (user.notification_preferences) {
    try {
      notificationPreferences = {
        ...notificationPreferences,
        ...JSON.parse(user.notification_preferences)
      };
    } catch (error) {
      console.error(`Invalid notification preferences for user ${userId}:`, error);
    }
  }
  const { notification_preferences: storedPreferences, ...profile } = user;
  return { ...profile, notification_preferences: notificationPreferences };
}

async function updateOwnProfile(userId, { username, name, email, phone, address }) {
  await pool.execute(
    `UPDATE users SET username = ?, name = ?, email = ?, phone = ?, address = ?
     WHERE user_id = ?`,
    [username, name, email, phone || null, address || null, userId]
  );
  return getOwnProfile(userId);
}

async function deactivateOwnAccount(userId) {
  const [result] = await pool.execute(
    "UPDATE users SET status = 'inactive' WHERE user_id = ? AND status = 'active'",
    [userId]
  );
  return result.affectedRows > 0;
}

async function updateOwnProfileImage(userId, imageUrl) {
  await pool.execute(
    'UPDATE users SET profile_image = ? WHERE user_id = ?',
    [imageUrl, userId]
  );
  return getOwnProfile(userId);
}

async function getPasswordHash(userId) {
  const [users] = await pool.execute(
    'SELECT password_hash FROM users WHERE user_id = ?',
    [userId]
  );
  return users[0]?.password_hash || null;
}

async function updatePasswordHash(userId, passwordHash) {
  await pool.execute(
    'UPDATE users SET password_hash = ? WHERE user_id = ?',
    [passwordHash, userId]
  );
}

async function hashPassword(password) {
  return bcrypt.hash(password, 12);
}

async function updateNotificationPreferences(userId, preferences) {
  await pool.execute(
    'UPDATE users SET notification_preferences = ? WHERE user_id = ?',
    [JSON.stringify(preferences), userId]
  );
  return getOwnProfile(userId);
}

async function listUsers(dateRange = {}) {
  const conditions = [];
  const values = [];
  addDateRangeCondition(conditions, values, 'created_at', dateRange);
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const [users] = await pool.execute(
    `SELECT ${USER_COLUMNS} FROM users ${where} ORDER BY created_at DESC, id DESC`,
    values
  );
  return users;
}

async function updateUser(userId, { username, name, email, phone, role, status }) {
  await pool.execute(
    `UPDATE users
     SET username = ?, name = ?, email = ?, phone = ?, role = ?, status = COALESCE(?, status)
     WHERE id = ?`,
    [username, name, email, phone || null, role, status || null, userId]
  );
  return getUserById(userId);
}

async function deleteUser(userId) {
  const [result] = await pool.execute(
    'DELETE FROM users WHERE id = ?',
    [userId]
  );
  return result.affectedRows > 0;
}

async function findUserForLogin(identifier) {
  const [users] = await pool.execute(
    `SELECT ${USER_COLUMNS}, password_hash
     FROM users
     WHERE email = ? OR phone = ? OR username = ?
     LIMIT 1`,
    [identifier, identifier, identifier]
  );
  return users[0] || null;
}

async function verifyPassword(password, passwordHash) {
  return bcrypt.compare(password, passwordHash);
}

function createAccessToken(user) {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET is required to issue login tokens');

  return jwt.sign(
    { user_id: user.user_id, role: user.role },
    secret,
    { expiresIn: process.env.JWT_EXPIRES_IN || '9d' }
  );
}

function createSubscriptionAccessToken(user) {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET is required to issue subscription checkout access');
  return jwt.sign(
    { user_id: user.user_id, purpose: 'subscription_checkout' },
    secret,
    { expiresIn: '10m' }
  );
}

module.exports = {
  createAccessToken,
  createSubscriptionAccessToken,
  createUser,
  deactivateOwnAccount,
  deleteUser,
  findUserForLogin,
  getOwnProfile,
  getPasswordHash,
  getUserById,
  getUserByUserId,
  hashPassword,
  initializeAuthModule,
  insertUser,
  listUsers,
  updateUser,
  updateOwnProfile,
  updateOwnProfileImage,
  updatePasswordHash,
  updateNotificationPreferences,
  verifyPassword
};
