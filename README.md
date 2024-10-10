# Meme 交易机器人

这是一个基于 GMGN.ai API 的高级 meme 代币交易机器人。它使用 Node.js 实现，并集成了 MySQL 数据库用于数据存储和日志记录。该机器人支持多链交易，特别关注 Solana 链。

## 功能特性

- 利用 GMGN.ai API 获取交易数据和热门代币列表
- 基于预定义条件自动执行交易操作
- 支持 Solana 区块链上的交易
- 将交易数据和日志存储到 MySQL 数据库
- 定期（每分钟）检查并更新交易数据
- 获取钱包持仓信息
- 获取代币对信息
- 通过 Telegram 发送交易通知

## 安装

1. 克隆仓库：
   ```
   git clone https://github.com/zuoye520/memeTradingBot.git
   cd memeTradingBot
   ```

2. 安装依赖：
   ```
   npm install
   ```

3. 配置环境变量：
   复制 `.env.example` 文件为 `.env`，然后编辑 `.env` 文件，填入你的实际配置：
   ```
   GMGN_API_URL=http://your-api-url
   DB_HOST=localhost
   DB_USER=你的数据库用户名
   DB_PASSWORD=你的数据库密码
   DB_NAME=gmgn_trading_bot
   WALLET_ADDRESS=你的钱包地址
   PRIVATE_KEY=你的私钥（用于 Solana 交易）
   TG_BOT_TOKEN=你的Telegram机器人令牌
   TG_CHAT_IDS=Telegram聊天ID列表，用逗号分隔
   ```

4. 初始化数据库：
   确保你有一个运行中的 MySQL 服务器，并创建了一个名为 `gmgn_trading_bot` 的数据库。

## 使用方法

运行机器人：

```
npm start
```

机器人将开始运行，每分钟从 GMGN.ai API 获取一次数据，并根据预定义的条件执行交易操作。

## 项目结构

- `index.js`: 主程序文件，包含交易机器人的核心逻辑
- `db.js`: 数据库连接、初始化脚本和数据库操作函数
- `dbInit.js`: 数据库初始化和表创建
- `apiService.js`: GMGN.ai API 服务封装
- `httpUtils.js`: HTTP 请求工具函数
- `solanaTrading.js`: Solana 交易相关函数
- `messagePush.js`: 消息推送功能，包括 Telegram 通知
- `.env`: 环境变量配置文件
- `package.json`: 项目依赖和脚本配置

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