const assert = require('node:assert/strict');
const test = require('node:test');
const { pool } = require('../src/config/db');
const { initializeProductModule } = require('../src/modules/productModule');

test('product module clears orphaned audit users and starts successfully', async (context) => {
  const originalExecute = pool.execute;
  const originalQuery = pool.query;
  const statements = [];
  const clearedColumns = new Set();

  pool.query = async (sql) => {
    statements.push(sql);
    if (sql === 'SHOW COLUMNS FROM products') return [[]];
    return [[]];
  };
  pool.execute = async (sql) => {
    statements.push(sql);
    if (sql.includes('information_schema.COLUMNS')) {
      return [[{
        DATA_TYPE: 'varchar',
        COLUMN_TYPE: 'varchar(255)',
        CHARACTER_SET_NAME: 'ascii',
        COLLATION_NAME: 'ascii_bin'
      }]];
    }
    if (sql.includes('information_schema.KEY_COLUMN_USAGE')) return [[]];
    if (sql.includes('information_schema.STATISTICS')) return [[]];
    if (sql.startsWith('UPDATE products p') && sql.includes('LEFT JOIN users audit_user')) {
      const column = sql.includes('SET p.`created_by`') ? 'created_by' : 'updated_by';
      clearedColumns.add(column);
      return [{ affectedRows: 1 }];
    }
    if (sql.includes('SELECT p.id') && sql.includes('audit_user')) {
      const column = sql.includes('p.`created_by`') ? 'created_by' : 'updated_by';
      return [clearedColumns.has(column) ? [] : [{ id: 6 }]];
    }
    return [[]];
  };
  context.after(() => {
    pool.execute = originalExecute;
    pool.query = originalQuery;
  });

  await initializeProductModule();

  assert.deepEqual(clearedColumns, new Set(['created_by', 'updated_by']));
  assert.ok(statements.some((sql) => sql.includes('SET p.`created_by` = NULL')));
  assert.ok(statements.some((sql) => sql.includes('SET p.`updated_by` = NULL')));
});
