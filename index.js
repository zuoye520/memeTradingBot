import dotenv from 'dotenv';
import { insertData, selectData } from './db.js';
import { initDatabase } from './dbInit.js';
import { 
  getPopularList, 
  executeSolanaTrade,
  gmgnTokens
} from './apiService.js';
import { sendTgMessage } from './messagePush.js';

dotenv.config();

/**
 * 保存交易数据到数据库
 * @param {Object} data - 要保存的交易数据
 */
async function saveTradingData(data) {
  try {
    await insertData('trading_data', { data: JSON.stringify(data) });
  } catch (error) {
    console.error('保存交易数据失败:', error);
  }
}

/**
 * 执行交易并记录日志
 * @param {Object} tradeData - 交易数据
 * @returns {Object} 交易状态
 */
async function executeTradeWithLogging(tradeData) {
  console.log('执行交易:', tradeData);
  
  try {
    let tradeResult;
    if (tradeData.chain === 'solana') {
      tradeResult = await executeSolanaTrade(tradeData);
    } else {
      throw new Error('不支持的区块链');
    }
    console.log('交易结果:', tradeResult);

    // 插入交易日志
    await insertData('trade_logs', { 
      action: tradeData.side, 
      details: JSON.stringify({
        tradeData,
        tradeResult
      })
    });

    return tradeResult;
  } catch (error) {
    console.error('执行交易失败:', error);
    throw error;
  }
}

/**
 * 检查并执行买入操作
 */
async function checkAndExecuteBuy() {
  try {
    // 1. 获取热门token列表
    const popularTokens = await getPopularList({ time: '1m', limit: 1 });
    console.log('热门代币:', popularTokens);
    for (const token of popularTokens) {
      // 2. 查询数据库是否存在该token信息
      const tokenInfo = await selectData('token_info', { token_address: token.address, network: token.chain });
      if (tokenInfo.length <= 0) {
        // 3. 不存在则插入
        const tokenId = await insertData('token_info', {
          chain:token.chain,
          token_address: token.address,
          symbol: token.symbol,
        });
        // 4. 满足条件执行交易
        const tradeData = {
          swapMode: 'ExactIn',//SOL->TOKEN
          inputToken: process.env.SOL_ADDRESS,
          outputToken: token.address,
          amount: process.env.SOL_TRADE_AMOUNT * 1e9,//SOL 精度 9
          slippage: process.env.SOL_SLIPPAGE,
          fee:process.env.SOL_PRIORITY_FEE
        };
        try {
          const tradeResult = await executeSolanaTrade(tradeData);

          console.log(`已为代币 ${token.symbol} 执行交易，结果:`, tradeResult);
          // 5. 记录交易到数据库
          await insertData('trade_records', {
            token_id: tokenId,
            hash: tradeResult.data.hash,
            wallet_address: process.env.SOL_WALLET_ADDRESS,
            side: 'BUY',
            in_token:tradeData.inputToken,
            out_token:tradeData.outputToken,
            in_token_decimals:9,
            out_token_decimals:9,
            in_token_amount: tradeData.amount,
            out_token_amount:0,
            status: 'PENDING',
            priority_fee: process.env.SOL_PRIORITY_FEE,
            price: 0,
            gas_fee:0
          });
        } catch (tradeError) {
          console.error(`为代币 ${token.symbol} 执行交易失败:`, tradeError);
        }
        // 5. 推送消息
        sendTgMessage({
            sniperAddress: process.env.SOL_WALLET_ADDRESS,
            tokenAddress: token.address
          });
      } else {
        console.log(`代币 ${token.address} 在 token_info 表中，跳过`);
      }
    }
  } catch (error) {
    console.error('交易机器人周期出错:', error);
  }
}

/**
 * 检查并执行卖出操作
 */
async function checkAndExecuteSell() {
  try {
    const walletAddress = process.env.SOL_WALLET_ADDRESS;
    const holdings = await getWalletHoldings(walletAddress);

    for (const holding of holdings) {
      const profitPercentage = (holding.unrealized_profit / holding.cost) * 100;
      if (profitPercentage > 20 || profitPercentage < -10) {
        console.log(`准备卖出 ${holding.symbol}，盈亏百分比: ${profitPercentage.toFixed(2)}%`);

        const tradeData = {
          chain: 'solana',
          side: 'SELL',
          inputToken: holding.token_address,
          outputToken: process.env.BASE_TOKEN_ADDRESS,
          amount: holding.balance,
          fromAddress: walletAddress,
          slippage: 1,
          price: holding.price
        };

        try {
          const tradeResult = await executeTradeWithLogging(tradeData);
          console.log(`已为代币 ${holding.symbol} 执行卖出，结果:`, tradeResult);

          // 更新数据库中的交易记录
          const tokenInfo = await selectData('token_info', { token_address: holding.token_address });
          if (tokenInfo.length > 0) {
            const tokenId = tokenInfo[0].id;
            await insertData('trade_records', {
              token_id: tokenId,
              wallet_address: walletAddress,
              action: 'SELL',
              amount: holding.balance,
              price: holding.price,
              total_value: holding.balance * holding.price,
              transaction_hash: tradeResult.transaction_hash,
              status: 'COMPLETED',
              fee: tradeResult.fee,
              profit_loss: holding.unrealized_profit
            });
          }

          await sendTgMessage({
            sniperAddress: walletAddress,
            tokenAddress: holding.token_address,
            action: 'SELL',
            profitPercentage: profitPercentage
          });
        } catch (tradeError) {
          console.error(`为代币 ${holding.symbol} 执行卖出失败:`, tradeError);
        }
      }
    }
  } catch (error) {
    console.error('检查并执行卖出操作失败:', error);
  }
}

/**
 * 运行交易机器人
 * 这个函数是机器人的主循环，每分钟执行一次
 */
async function runTradingBot() {
  console.log('启动 GMGN.ai 交易机器人...');
  
  await initDatabase(); // 初始化数据库
  setInterval(checkAndExecuteBuy, 1000 * 20); // 每5秒运行一次
  setInterval(checkAndExecuteSell, 1000 * 10); // 每10秒检查一次
}

runTradingBot();

export {
  saveTradingData,
  executeTradeWithLogging,
  runTradingBot
};