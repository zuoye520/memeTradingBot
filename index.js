import dotenv from 'dotenv';
import { pool, initDatabase } from './db.js';
import { 
  getPopularList, 
  fetchTradingData, 
  getPairInfo, 
  getTradeQuote, 
  executeTrade, 
  getTradeStatus,
  executeSolanaTrade
} from './apiService.js';

dotenv.config();

async function saveTradingData(data) {
  try {
    await insertData('trading_data', { data: JSON.stringify(data) });
  } catch (error) {
    console.error('Error saving trading data:', error);
  }
}

async function executeTradeWithLogging(tradeData) {
  console.log('Executing trade:', tradeData);
  
  try {
    let tradeResult;
    if (tradeData.chain === 'solana') {
      tradeResult = await executeSolanaTrade(tradeData);
    } else {
      // 获取交易报价
      const quoteData = await getTradeQuote(tradeData);
      console.log('Trade quote:', quoteData);

      // 执行交易
      tradeResult = await executeTrade(quoteData);
    }
    console.log('Trade result:', tradeResult);

    // 获取交易状态
    const tradeStatus = await getTradeStatus(tradeResult.data.hash);
    console.log('Trade status:', tradeStatus);

    // 记录交易日志
    await insertData('trade_logs', { 
      action: tradeData.side, 
      details: JSON.stringify({
        tradeData,
        tradeResult,
        tradeStatus
      })
    });

    return tradeStatus;
  } catch (error) {
    console.error('Error executing trade:', error);
    throw error;
  }
}

/**
 * 1、通过gmgn.ai 赛选条件 获取热门token列表
 * 2、查询数据库是否已经买入过该token
 * 3、满足条件发送通知
 * 4、满足条件执行交易
 */

async function runTradingBot() {
  console.log('Starting GMGN.ai trading bot...');
  
  await initDatabase();

  setInterval(async () => {
    const tradingData = await fetchTradingData();
    if (tradingData) {
      await saveTradingData(tradingData);
      
      // 分析交易数据并决定是否执行交易
      if (tradingData.signal === 'BUY' || tradingData.signal === 'SELL') {
        try {
          const tradeStatus = await executeTradeWithLogging({
            chain: tradingData.chain,
            side: tradingData.signal,
            inputToken: tradingData.baseToken,
            outputToken: tradingData.quoteToken,
            amount: tradingData.amount,
            fromAddress: process.env.WALLET_ADDRESS,
            slippage: 0.5 // 可以从配置文件中读取
          });
          console.log('Trade completed with status:', tradeStatus);
        } catch (error) {
          console.error('Failed to execute trade:', error);
        }
      }
    }

    // 获取热门token列表
    const popularTokens = await getPopularList();
    console.log('Popular tokens:', popularTokens);
    // 这里可以添加处理热门token列表的逻辑
  }, 60000); // 每分钟检查一次
}

runTradingBot();

export {
  saveTradingData,
  executeTradeWithLogging,
  runTradingBot
};