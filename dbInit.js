import { pool } from './db.js';

/**
 * 检查表是否存在
 * @param {string} tableName - 要检查的表名
 * @returns {Promise<boolean>} - 表是否存在
 * @example
 * const exists = await tableExists('users');
 * console.log(exists); // true 或 false
 */
async function tableExists(tableName) {
  const [rows] = await pool.query(`SHOW TABLES LIKE '${tableName}'`);
  return rows.length > 0;
}

/**
 * 如果表不存在，则创建表
 * @param {string} tableName - 要创建的表名
 * @param {string} createTableSQL - 创建表的 SQL 语句
 * @example
 * await createTableIfNotExists('users', `
 *   CREATE TABLE users (
 *     id INT AUTO_INCREMENT PRIMARY KEY,
 *     name VARCHAR(255) NOT NULL,
 *     email VARCHAR(255) UNIQUE NOT NULL
 *   )
 * `);
 */
async function createTableIfNotExists(tableName, createTableSQL) {
  if (!(await tableExists(tableName))) {
    await pool.query(createTableSQL);
    console.log(`Table ${tableName} created successfully`);
  } else {
    console.log(`Table ${tableName} already exists`);
  }
}

/**
 * 初始化数据库，创建必要的表
 * @example
 * await initDatabase();
 */
async function initDatabase() {
  try {
    await createTableIfNotExists('trading_data', `
      CREATE TABLE trading_data (
        id INT AUTO_INCREMENT PRIMARY KEY,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        data JSON
      )
    `);

    await createTableIfNotExists('trade_logs', `
      CREATE TABLE trade_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        action ENUM('BUY', 'SELL'),
        details JSON
      )
    `);

    console.log('Database initialization completed');
  } catch (error) {
    console.error('Error initializing database:', error);
  }
}

export { initDatabase, createTableIfNotExists, tableExists };