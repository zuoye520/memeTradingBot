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

## 主要组件

- `index.js`: 主程序文件，包含交易机器人的核心逻辑
- `db.js`: 数据库连接和操作函数
- `dbInit.js`: 数据库初始化和表创建
- `apiService.js`: GMGN.ai API 服务封装
- `httpUtils.js`: HTTP 请求工具函数
- `solanaTrading.js`: Solana 交易相关函数
- `messagePush.js`: 消息推送功能，包括 Telegram 通知
- `keyManager.js`: 私钥加密和解密功能
- `start.js`: 启动脚本，处理密码输入并启动主程序

## 安装

1. 克隆仓库：
   ```
   git clone https://github.com/yourusername/memeTradingBot.git
   cd memeTradingBot
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
2. 每 5 秒检查并执行买入操作
3. 每 5 秒检查并执行卖出操作
4. 每 10 秒检查待处理交易的状态

## 交易策略

### 买入策略
- 检查 SOL 余额，确保有足够的资金进行交易
- 获取符合条件的热门代币列表（市值小于 50 万，持仓地址大于 300，创建时间大于 12 小时）
- 排除未被 CTO 接管或短期内跌幅过大的代币
- 对符合条件的代币执行买入操作

### 卖出策略
- 检查钱包中的代币持仓
- 当某个代币的未实现盈利超过 50% 时，执行全部卖出操作

## 注意事项

- 请确保你的 GMGN.ai API 地址是正确的
- 在实际交易环境中使用前，请充分测试并根据你的需求调整交易逻辑
- 定期检查日志和数据库，确保机器人正常运行
- 保护好你的私钥和敏感信息，不要将它们暴露在公共环境中
- 确保你的 Telegram 机器人设置正确，并且有权限发送消息到指定的聊天

## 贡献

欢迎提交问题和拉取请求。对于重大更改，请先开 issue 讨论您想要改变的内容。

## 许可证

[MIT](https://choosealicense.com/licenses/mit/)