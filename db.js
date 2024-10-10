import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

async function tableExists(tableName) {
  const [rows] = await pool.query(`SHOW TABLES LIKE '${tableName}'`);
  return rows.length > 0;
}

async function createTableIfNotExists(tableName, createTableSQL) {
  if (!(await tableExists(tableName))) {
    await pool.query(createTableSQL);
    console.log(`Table ${tableName} created successfully`);
  } else {
    console.log(`Table ${tableName} already exists`);
  }
}

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

// 插入数据
async function insertData(table, data) {
  const keys = Object.keys(data);
  const values = Object.values(data);
  const placeholders = keys.map(() => '?').join(', ');
  const query = `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${placeholders})`;
  
  try {
    const [result] = await pool.query(query, values);
    return result.insertId;
  } catch (error) {
    console.error('Error inserting data:', error);
    throw error;
  }
}

// 查询数据
async function selectData(table, conditions = {}, fields = '*') {
  const whereClause = Object.keys(conditions).map(key => `${key} = ?`).join(' AND ');
  const query = `SELECT ${fields} FROM ${table}${whereClause ? ` WHERE ${whereClause}` : ''}`;
  const values = Object.values(conditions);

  try {
    const [rows] = await pool.query(query, values);
    return rows;
  } catch (error) {
    console.error('Error selecting data:', error);
    throw error;
  }
}

// 更新数据
async function updateData(table, data, conditions) {
  const setClause = Object.keys(data).map(key => `${key} = ?`).join(', ');
  const whereClause = Object.keys(conditions).map(key => `${key} = ?`).join(' AND ');
  const query = `UPDATE ${table} SET ${setClause} WHERE ${whereClause}`;
  const values = [...Object.values(data), ...Object.values(conditions)];

  try {
    const [result] = await pool.query(query, values);
    return result.affectedRows;
  } catch (error) {
    console.error('Error updating data:', error);
    throw error;
  }
}

// 删除数据
async function deleteData(table, conditions) {
  const whereClause = Object.keys(conditions).map(key => `${key} = ?`).join(' AND ');
  const query = `DELETE FROM ${table} WHERE ${whereClause}`;
  const values = Object.values(conditions);

  try {
    const [result] = await pool.query(query, values);
    return result.affectedRows;
  } catch (error) {
    console.error('Error deleting data:', error);
    throw error;
  }
}

export {
  pool,
  initDatabase,
  insertData,
  selectData,
  updateData,
  deleteData
};