# Meme 交易机器人

这是一个基于 GMGN.ai API 的高级 meme 代币交易机器人。它使用 Node.js 实现，并集成了 MySQL 数据库用于数据存储和日志记录。该机器人专注于 Solana 链上的交易。

## 功能特性

- 利用 GMGN.ai API 获取交易数据和热门代币列表
- 基于预定义条件自动执行买入和卖出操作
- 支持 Solana 区块链上的交易
- 将交易数据和日志存储到 MySQL 数据库
- 定期检查并更新交易状态
- 获取钱包持仓信息和盈亏情况
- 通过 Telegram 发送交易通知
- 私钥加密功能，提高安全性
- 使用 PM2 进行进程管理
- 自动清理旧数据，保持数据库整洁
- 使用 Redis 进行缓存和时间锁管理

## 项目结构

```
meme-trading-bot/
├── api/
│   ├── apiService.js
│   └── solanaTrading.js
├── utils/
│   ├── db.js
│   ├── dbInit.js
│   ├── httpUtils.js
│   ├── keyManager.js
│   ├── log.js
│   ├── messagePush.js
│   └── redisManager.js
├── .env.example
├── index.js
├── package.json
├── README.md
└── start.js
```

## 主要组件

- `index.js`: 主程序文件，包含交易机器人的核心逻辑
- `api/apiService.js`: GMGN.ai API 服务封装
- `api/solanaTrading.js`: Solana 交易相关函数
- `utils/db.js`: 数据库连接和操作函数
- `utils/dbInit.js`: 数据库初始化和表创建
- `utils/httpUtils.js`: HTTP 请求工具函数
- `utils/keyManager.js`: 私钥加密和解密功能
- `utils/log.js`: 日志记录功能
- `utils/messagePush.js`: 消息推送功能，包括 Telegram 通知
- `utils/redisManager.js`: Redis 缓存和时间锁管理
- `start.js`: 启动脚本，处理密码输入并启动主程序

## 安装

1. 克隆仓库：
   ```
   git clone https://github.com/yourusername/meme-trading-bot.git
   cd meme-trading-bot
   ```

2. 安装依赖：
   ```
   npm install
   ```

3. 配置环境变量：
   复制 `.env.example` 文件为 `.env`，然后编辑 `.env` 文件，填入你的实际配置。

4. 加密私钥：
   ```
   npm run encrypt
   ```
   这将提示你输入你的 Solana 私钥和一个用于加密的密码。加密后的私钥将保存在 `.encrypted_private_key` 文件中。

5. 更新 `.env` 文件：
   添加 `ENCRYPTED_PRIVATE_KEY_FILE=.encrypted_private_key`。

## 使用方法

使用 PM2 运行机器人：

```
npm run pm2:start
```

这将启动 `start.js`，它会提示你输入密码，然后启动主程序。

PM2 将保持程序运行，即使在发生错误或系统重启后也会自动重启程序。

要查看日志，可以使用：

```
pm2 logs meme-trading-bot
```

要停止程序，使用：

```
pm2 stop meme-trading-bot
```

机器人启动后将执行以下操作：

1. 初始化数据库
2. 每 3 秒检查并执行买入操作
3. 每 5 秒检查并执行卖出操作
4. 每 10 秒检查待处理交易的状态
5. 每 10 分钟自动清理旧数据（默认清理 2 天前的数据）

## 交易策略

### 买入策略
- 检查 SOL 余额，确保有足够的资金进行交易
- 获取符合条件的热门代币列表（市值小于 100 万，持仓地址大于 300，创建时间大于 48 小时）
- 排除未被 CTO 接管或短期内跌幅过大的代币
- 对符合条件的代币执行买入操作

### 卖出策略
- 检查钱包中的代币持仓
- 当盈利百分比超过 30% 时执行全部卖出操作

## 数据清理
- 默认每 10 分钟自动清理 2 天前的旧数据
- 清理时间可通过修改 `index.js` 中的 `CLEANUP_DAYS` 常量来调整

## 注意事项

- 请确保你的 GMGN.ai API 地址是正确的
- 在实际交易环境中使用前，请充分测试并根据你的需求调整交易逻辑
- 定期检查日志和数据库，确保机器人正常运行
- 保护好你的私钥和敏感信息，不要将它们暴露在公共环境中
- 确保你的 Telegram 机器人设置正确，并且有权限发送消息到指定的聊天
- 注意调整和优化 Redis 缓存策略，以提高性能并减少 API 调用次数

## 未来改进

- 实现更复杂的交易策略，包括技术分析指标
- 添加风险管理机制，如止损和资金管理
- 实现回测和模拟交易功能
- 增加更多的数据分析和报告功能
- 优化并发处理和性能
- 增强安全性措施
- 添加单元测试和集成测试

## 贡献

欢迎提交问题和拉取请求。对于重大更改，请先开 issue 讨论您想要改变的内容。

## 许可证

[MIT](https://choosealicense.com/licenses/mit/)