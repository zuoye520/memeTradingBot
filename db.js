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

/**
 * 插入数据到指定表
 * @param {string} table - 表名
 * @param {Object} data - 要插入的数据对象
 * @returns {Promise<number>} - 插入的记录ID
 * @example
 * const newId = await insertData('users', { name: 'John Doe', email: 'john@example.com' });
 * console.log('Inserted record ID:', newId);
 */
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

/**
 * 从指定表查询数据
 * @param {string} table - 表名
 * @param {Object} conditions - 查询条件
 * @param {string} fields - 要查询的字段，默认为 '*'
 * @returns {Promise<Array>} - 查询结果数组
 * @example
 * const users = await selectData('users', { role: 'admin' }, 'id, name, email');
 * console.log('Admin users:', users);
 */
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

/**
 * 更新指定表中的数据
 * @param {string} table - 表名
 * @param {Object} data - 要更新的数据
 * @param {Object} conditions - 更新条件
 * @returns {Promise<number>} - 受影响的行数
 * @example
 * const updatedRows = await updateData('users', { status: 'active' }, { id: 1 });
 * console.log('Updated rows:', updatedRows);
 */
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

/**
 * 从指定表删除数据
 * @param {string} table - 表名
 * @param {Object} conditions - 删除条件
 * @returns {Promise<number>} - 受影响的行数
 * @example
 * const deletedRows = await deleteData('users', { status: 'inactive' });
 * console.log('Deleted inactive users:', deletedRows);
 */
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
  insertData,
  selectData,
  updateData,
  deleteData
};