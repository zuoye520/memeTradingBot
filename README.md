# GMGN.ai Trading Bot

这是一个基于 GMGN.ai API 的交易机器人，使用 Node.js 实现，并集成了 MySQL 数据库用于数据存储和日志记录。该机器人支持多链交易，包括 Solana。

## 功能特性

- 使用 GMGN.ai API 获取交易数据和热门代币列表
- 自动执行交易操作（基于 API 返回的信号）
- 支持 Solana 链上的交易
- 将交易数据和日志存储到 MySQL 数据库
- 定期（每分钟）检查并更新交易数据
- 获取钱包持仓信息
- 获取代币对信息

## 安装

1. 克隆仓库：
   ```
   git clone https://e.coding.net/FE_ZUOZUO/makerhub_prediction/gmgn-trading-bot.git
   cd gmgn-trading-bot
   ```

2. 安装依赖：
   ```
   npm install
   ```

3. 配置环境变量：
   复制 `.env.example` 文件为 `.env`，然后编辑 `.env` 文件，填入你的实际配置：
   ```
   GMGN_API_URL=http://47.237.120.213:9488
   DB_HOST=localhost
   DB_USER=你的数据库用户名
   DB_PASSWORD=你的数据库密码
   DB_NAME=gmgn_trading_bot
   WALLET_ADDRESS=你的钱包地址
   PRIVATE_KEY=你的私钥（用于 Solana 交易）
   ```

4. 初始化数据库：
   确保你有一个运行中的 MySQL 服务器，并创建了一个名为 `gmgn_trading_bot` 的数据库。

## 使用方法

运行机器人：

```
npm start
```

机器人将开始运行，每分钟从 GMGN.ai API 获取一次数据，并根据返回的信号执行交易操作。

## 项目结构

- `index.js`: 主程序文件，包含交易机器人的核心逻辑
- `db.js`: 数据库连接、初始化脚本和数据库操作函数
- `apiService.js`: GMGN.ai API 服务封装
- `httpUtils.js`: HTTP 请求工具函数
- `solanaTrading.js`: Solana 交易相关函数
- `.env`: 环境变量配置文件
- `package.json`: 项目依赖和脚本配置

## 注意事项

- 请确保你的 GMGN.ai API 地址是正确的
- 在实际交易环境中使用前，请充分测试并根据你的需求调整交易逻辑
- 定期检查日志和数据库，确保机器人正常运行
- 保护好你的私钥和敏感信息，不要将它们暴露在公共环境中

## 贡献

欢迎提交问题和拉取请求。对于重大更改，请先开issue讨论您想要改变的内容。

## 许可证

[MIT](https://choosealicense.com/licenses/mit/)

## 下载和本地运行

1. 从 Coding 克隆项目：
   ```
   git clone https://e.coding.net/FE_ZUOZUO/makerhub_prediction/gmgn-trading-bot.git
   ```

2. 进入项目目录：
   ```
   cd gmgn-trading-bot
   ```

3. 安装依赖：
   ```
   npm install
   ```

4. 配置 .env 文件（参考上面的 "配置环境变量" 部分）

5. 确保 MySQL 数据库已经设置好

6. 运行项目：
   ```
   npm start
   ```

请确保你的本地环境中已安装 Node.js 和 MySQL。