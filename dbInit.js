import { pool } from './db.js';

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
    await createTableIfNotExists('token_info', `
      CREATE TABLE token_info (
        id INT AUTO_INCREMENT PRIMARY KEY COMMENT '唯一标识符',
        chain VARCHAR(50) NOT NULL COMMENT '区块链网络（如 Solana, Ethereum 等）',
        token_address VARCHAR(255) NOT NULL COMMENT 'Token 地址',
        symbol VARCHAR(50) COMMENT 'Token 符号',
        last_updated DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后更新时间',
        UNIQUE KEY unique_token (token_address, chain)
      ) COMMENT 'Token 基本信息表'
    `);

    await createTableIfNotExists('trade_records', `
      CREATE TABLE trade_records (
        id INT AUTO_INCREMENT PRIMARY KEY COMMENT '唯一标识符',
        token_id INT NOT NULL COMMENT '关联 token_info 表的 ID',
        hash VARCHAR(255) NOT NULL COMMENT '交易哈希',
        last_valid_block_height BIGINT NOT NULL COMMENT '最后有效区块高度',
        wallet_address VARCHAR(255) NOT NULL COMMENT '钱包地址',
        side ENUM('BUY', 'SELL') NOT NULL COMMENT '交易方向',
        in_token VARCHAR(255) NOT NULL COMMENT '输入代币地址',
        out_token VARCHAR(255) NOT NULL COMMENT '输出代币地址',
        in_token_decimals INT NOT NULL COMMENT '输入代币精度',
        out_token_decimals INT NOT NULL COMMENT '输出代币精度',
        in_token_amount DECIMAL(30, 8) NOT NULL COMMENT '输入代币数量',
        out_token_amount DECIMAL(30, 8) NOT NULL COMMENT '输出代币数量',
        status ENUM('PENDING', 'COMPLETED', 'FAILED') DEFAULT 'PENDING' COMMENT '交易状态',
        priority_fee DECIMAL(30, 8) COMMENT '优先费用',
        price DECIMAL(30, 8) COMMENT '交易价格',
        gas_fee DECIMAL(30, 8) COMMENT '燃料费用',
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '交易时间',
        FOREIGN KEY (token_id) REFERENCES token_info(id)
      ) COMMENT '交易记录表'
    `);

    console.log('Database initialization completed');
  } catch (error) {
    console.error('Error initializing database:', error);
  }
}

export { initDatabase, createTableIfNotExists, tableExists };