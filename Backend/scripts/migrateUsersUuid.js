const path = require('node:path');
const dotenv = require('dotenv');
const mysql = require('mysql2/promise');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

function quoteIdentifier(value) {
  return `\`${String(value).replace(/`/g, '``')}\``;
}

async function addUserForeignKey(connection, foreignKey, parentColumn) {
  const [existing] = await connection.execute(
    `SELECT CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND CONSTRAINT_NAME = ?`,
    [foreignKey.TABLE_NAME, foreignKey.CONSTRAINT_NAME]
  );
  if (existing.length) return;

  await connection.query(
    `ALTER TABLE ${quoteIdentifier(foreignKey.TABLE_NAME)}
     ADD CONSTRAINT ${quoteIdentifier(foreignKey.CONSTRAINT_NAME)}
     FOREIGN KEY (${quoteIdentifier(foreignKey.COLUMN_NAME)})
     REFERENCES users (${quoteIdentifier(parentColumn)})
     ON DELETE ${foreignKey.DELETE_RULE} ON UPDATE ${foreignKey.UPDATE_RULE}`
  );
}

async function ensureUuidTrigger(connection) {
  const [triggers] = await connection.execute(
    `SELECT TRIGGER_NAME FROM information_schema.TRIGGERS
     WHERE TRIGGER_SCHEMA = DATABASE() AND EVENT_OBJECT_TABLE = 'users'
       AND TRIGGER_NAME = 'bi_users_uuid'`
  );
  if (!triggers.length) {
    await connection.query(`
      CREATE TRIGGER bi_users_uuid
      BEFORE INSERT ON users
      FOR EACH ROW
      SET NEW.user_id = IF(NEW.user_id IS NULL OR NEW.user_id = '', UUID(), NEW.user_id)
    `);
  }
}

async function migrate(connection) {
  const [columns] = await connection.query('SHOW COLUMNS FROM users');
  const columnsByName = new Map(columns.map((column) => [column.Field, column]));
  const userIdColumn = columnsByName.get('user_id');
  const idColumn = columnsByName.get('id');
  const isMigrated = idColumn
    && /^varchar\(255\)$/i.test(userIdColumn?.Type || '');

  if (isMigrated) {
    await ensureUuidTrigger(connection);
    console.log('The users table already uses UUID user_id values.');
    return;
  }
  if (!userIdColumn || idColumn || !/^int\(10\) unsigned$/i.test(userIdColumn.Type)) {
    throw new Error('Unsupported users schema; expected the legacy INT AUTO_INCREMENT user_id column.');
  }

  const [invalidRows] = await connection.query(`
    SELECT
      SUM(email IS NULL OR email = '' OR CHAR_LENGTH(email) > 255) AS invalid_email,
      SUM(phone IS NOT NULL AND CHAR_LENGTH(phone) > 20) AS invalid_phone
    FROM users
  `);
  if (Number(invalidRows[0].invalid_email || 0) > 0 || Number(invalidRows[0].invalid_phone || 0) > 0) {
    throw new Error('Existing users contain missing/oversized email or oversized phone values; resolve them before migration.');
  }

  const [foreignKeys] = await connection.execute(
    `SELECT k.TABLE_NAME, k.COLUMN_NAME, k.CONSTRAINT_NAME, r.DELETE_RULE, r.UPDATE_RULE
     FROM information_schema.KEY_COLUMN_USAGE k
     JOIN information_schema.REFERENTIAL_CONSTRAINTS r
       ON r.CONSTRAINT_SCHEMA = k.CONSTRAINT_SCHEMA
       AND r.CONSTRAINT_NAME = k.CONSTRAINT_NAME
       AND r.TABLE_NAME = k.TABLE_NAME
     WHERE k.TABLE_SCHEMA = DATABASE()
       AND k.REFERENCED_TABLE_NAME = 'users'
       AND k.REFERENCED_COLUMN_NAME = 'user_id'
     ORDER BY k.TABLE_NAME, k.CONSTRAINT_NAME`
  );
  const [tableInfo] = await connection.execute(
    `SELECT AUTO_INCREMENT FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users'`
  );
  const nextId = Math.max(6, Number(tableInfo[0]?.AUTO_INCREMENT || 1));
  const backupTable = `_users_uuid_backup_${new Date().toISOString().replace(/\D/g, '').slice(0, 14)}`;
  let migrationStarted = false;

  try {
    await connection.query(`CREATE TABLE ${quoteIdentifier(backupTable)} LIKE users`);
    await connection.query(`INSERT INTO ${quoteIdentifier(backupTable)} SELECT * FROM users`);
    for (const foreignKey of foreignKeys) {
      await connection.query(
        `ALTER TABLE ${quoteIdentifier(foreignKey.TABLE_NAME)}
         DROP FOREIGN KEY ${quoteIdentifier(foreignKey.CONSTRAINT_NAME)}`
      );
    }

    migrationStarted = true;
    await connection.query(
      'ALTER TABLE users CHANGE COLUMN user_id id INT UNSIGNED NOT NULL AUTO_INCREMENT'
    );
    await connection.query(
      'ALTER TABLE users ADD COLUMN user_id VARCHAR(255) CHARACTER SET ascii COLLATE ascii_bin NULL AFTER id'
    );
    await connection.query('UPDATE users SET user_id = UUID() WHERE user_id IS NULL');
    await connection.query(
      'ALTER TABLE users MODIFY COLUMN user_id VARCHAR(255) CHARACTER SET ascii COLLATE ascii_bin NOT NULL'
    );
    await connection.query('ALTER TABLE users ADD UNIQUE KEY uq_users_user_id (user_id)');
    await connection.query('ALTER TABLE users MODIFY COLUMN email VARCHAR(255) NOT NULL');
    await connection.query('ALTER TABLE users MODIFY COLUMN phone VARCHAR(20) NULL');
    await connection.query("ALTER TABLE users MODIFY COLUMN status VARCHAR(16) NOT NULL DEFAULT 'active'");
    await connection.query('UPDATE users SET status = LOWER(status)');
    await connection.query(
      "ALTER TABLE users MODIFY COLUMN status ENUM('active', 'inactive') NOT NULL DEFAULT 'active'"
    );
    await connection.query(`ALTER TABLE users AUTO_INCREMENT = ${nextId}`);

    for (const foreignKey of foreignKeys) {
      await addUserForeignKey(connection, foreignKey, 'id');
    }
    await ensureUuidTrigger(connection);

    const [checks] = await connection.query(`
      SELECT
        (SELECT COUNT(*) FROM users WHERE user_id IS NULL OR user_id = '') AS missing_uuid,
        (SELECT COUNT(*) FROM users) AS user_count
    `);
    if (Number(checks[0].missing_uuid) !== 0) {
      throw new Error('UUID migration verification failed.');
    }

    await connection.query(`DROP TABLE ${quoteIdentifier(backupTable)}`);
    console.log(`Migrated users to UUID user_id; numeric IDs are preserved and the next id is at least ${nextId}.`);
  } catch (error) {
    if (migrationStarted) {
      try {
        const [currentColumns] = await connection.query('SHOW COLUMNS FROM users');
        const currentColumnNames = new Set(currentColumns.map((column) => column.Field));
        const parentColumn = currentColumnNames.has('id') ? 'id' : 'user_id';
        for (const foreignKey of foreignKeys) {
          await addUserForeignKey(connection, foreignKey, parentColumn);
        }
      } catch (restoreError) {
        console.error(`Foreign-key restoration failed (${restoreError.code || 'unknown error'}).`);
      }
    }
    console.error(`UUID migration failed (${error.code || 'unknown error'}).`);
    console.error(`Backup table retained for recovery: ${backupTable}`);
    throw error;
  }
}

async function main() {
  const database = process.argv[2];
  if (!database || !/^[A-Za-z0-9_]+$/.test(database)) {
    throw new Error('Pass the target database name, for example: node scripts/migrateUsersUuid.js gold_product_db');
  }

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database
  });
  try {
    await migrate(connection);
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
