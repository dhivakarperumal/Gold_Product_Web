const assert = require('node:assert/strict');
const test = require('node:test');
const { pool } = require('../src/config/db');
const { initializeCategoryModule } = require('../src/modules/categoryModule');

test('category module normalizes missing category users before adding their foreign keys', async (context) => {
  const originalExecute = pool.execute;
  const originalQuery = pool.query;
  const statements = [];
  const normalizedColumns = new Set();

  pool.query = async (sql) => {
    statements.push(sql);
    if (sql === 'SHOW COLUMNS FROM categories') {
      return [[
        { Field: 'created_by' },
        { Field: 'updated_by' },
        { Field: 'created_at' },
        { Field: 'updated_at' }
      ]];
    }
    for (const column of ['created_by', 'updated_by', 'user_id']) {
      if (sql.includes(`SET category.\`${column}\` = NULL`)) normalizedColumns.add(column);
    }
    return [[]];
  };
  pool.execute = async (sql) => {
    statements.push(sql);
    if (sql.includes('information_schema.COLUMNS')) {
      return [[{
        COLUMN_TYPE: 'varchar(255)',
        CHARACTER_SET_NAME: 'ascii',
        COLLATION_NAME: 'ascii_bin'
      }]];
    }
    if (sql.includes('information_schema.KEY_COLUMN_USAGE')) {
      if (sql.includes('REFERENCED_TABLE_NAME = \'categories\'')) return [[]];
      if (sql.includes('SELECT category.id FROM categories category')) {
        const column = ['created_by', 'updated_by', 'user_id']
          .find((candidate) => sql.includes(`category.\`${candidate}\``));
        return [normalizedColumns.has(column) ? [] : [{ id: 8 }]];
      }
      return [[]];
    }
    if (sql.includes('information_schema.STATISTICS')) {
      return [[{ INDEX_NAME: 'uq_categories_user_cat_id', NON_UNIQUE: 0, column_list: 'user_id,catId' }]];
    }
    return [[]];
  };
  context.after(() => {
    pool.execute = originalExecute;
    pool.query = originalQuery;
  });

  await initializeCategoryModule();

  for (const column of ['created_by', 'updated_by', 'user_id']) {
    const cleanupIndex = statements.findIndex((sql) => (
      sql.includes(`SET category.\`${column}\` = NULL`)
      && sql.includes('audit_user.user_id IS NULL')
    ));
    const foreignKeyIndex = statements.findIndex((sql) => (
      sql.includes(`ADD CONSTRAINT \`fk_categories_${column === 'user_id' ? 'user_id' : `${column}_user_id`}\``)
    ));
    assert.notEqual(cleanupIndex, -1, `${column} orphan cleanup should run`);
    assert.ok(foreignKeyIndex > cleanupIndex, `${column} cleanup should precede its foreign key`);
    assert.ok(statements.some((sql) => (
      sql.includes(`SET category.\`${column}\` = legacy_user.user_id`)
    )), `${column} legacy numeric IDs should be translated`);
  }
});
