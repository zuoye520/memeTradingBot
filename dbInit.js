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
        token_address VARCHAR(255) NOT NULL COMMENT 'Token 地址',
        network VARCHAR(50) NOT NULL COMMENT '区块链网络（如 Solana, Ethereum 等）',
        symbol VARCHAR(50) COMMENT 'Token 符号',
        name VARCHAR(255) COMMENT 'Token 名称',
        decimals INT COMMENT 'Token 精度',
        last_updated DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后更新时间',
        UNIQUE KEY unique_token (token_address, network)
      ) COMMENT 'Token 基本信息表'
    `);

    await createTableIfNotExists('portfolio', `
      CREATE TABLE portfolio (
        id INT AUTO_INCREMENT PRIMARY KEY COMMENT '唯一标识符',
        token_id INT NOT NULL COMMENT '关联 token_info 表的 ID',
        wallet_address VARCHAR(255) NOT NULL COMMENT '钱包地址',
        balance DECIMAL(30, 8) NOT NULL COMMENT '持有数量',
        average_buy_price DECIMAL(30, 8) COMMENT '平均买入价格',
        last_updated DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后更新时间',
        FOREIGN KEY (token_id) REFERENCES token_info(id),
        UNIQUE KEY unique_wallet_token (wallet_address, token_id)
      ) COMMENT '投资组合表，记录当前持仓'
    `);

    await createTableIfNotExists('trade_records', `
      CREATE TABLE trade_records (
        id INT AUTO_INCREMENT PRIMARY KEY COMMENT '唯一标识符',
        token_id INT NOT NULL COMMENT '关联 token_info 表的 ID',
        wallet_address VARCHAR(255) NOT NULL COMMENT '钱包地址',
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '交易时间',
        action ENUM('BUY', 'SELL') NOT NULL COMMENT '交易动作：买入或卖出',
        amount DECIMAL(30, 8) NOT NULL COMMENT '交易数量',
        price DECIMAL(30, 8) NOT NULL COMMENT '交易价格',
        total_value DECIMAL(30, 8) NOT NULL COMMENT '交易总值',
        transaction_hash VARCHAR(255) COMMENT '交易哈希',
        status ENUM('PENDING', 'COMPLETED', 'FAILED') DEFAULT 'PENDING' COMMENT '交易状态',
        fee DECIMAL(30, 8) COMMENT '交易费用',
        profit_loss DECIMAL(30, 8) COMMENT '本次交易产生的盈亏',
        FOREIGN KEY (token_id) REFERENCES token_info(id)
      ) COMMENT '交易记录表'
    `);

    console.log('Database initialization completed');
  } catch (error) {
    console.error('Error initializing database:', error);
  }
}

export { initDatabase, createTableIfNotExists, tableExists };