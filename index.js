import dotenv from 'dotenv';
import { insertData, selectData } from './db.js';
import { initDatabase } from './dbInit.js';
import { 
  getPopularList, 
  fetchTradingData, 
  getPairInfo, 
  getTradeQuote, 
  executeTrade, 
  getTradeStatus,
  executeSolanaTrade
} from './apiService.js';
import { sendTgMessage } from './messagePush.js';

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
      const quoteData = await getTradeQuote(tradeData);
      console.log('Trade quote:', quoteData);
      tradeResult = await executeTrade(quoteData);
    }
    console.log('Trade result:', tradeResult);

    const tradeStatus = await getTradeStatus(tradeResult.data.hash);
    console.log('Trade status:', tradeStatus);

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

async function runTradingBot() {
  console.log('Starting GMGN.ai trading bot...');
  
  await initDatabase();

  setInterval(async () => {
    try {
      // 1. 获取热门token列表
      const popularTokens = await getPopularList({ time: '1h', limit: 50 });
      console.log('Popular tokens:', popularTokens);

      for (const token of popularTokens) {
        // 2. 查询数据库是否已经买入过该token
        const existingTrade = await selectData('trade_logs', { 'details->tradeData->outputToken': token.address });
        
        if (existingTrade.length === 0) {
          // 3. 满足条件发送通知
          const tokenInfo = await getPairInfo(token.address);
          
          // 这里可以添加更多的交易条件，例如：
          const tradingConditions = 
            tokenInfo.token.market_cap > 100000 && // 市值大于 10 万
            tokenInfo.token.holder_count > 100 && // 持有者数量大于 100
            tokenInfo.token.renounced_mint === 1 && // Mint 权限已放弃
            tokenInfo.token.renounced_freeze_account === 1; // 无黑名单

          if (tradingConditions) {
            await sendTgMessage({
              sniperAddress: process.env.WALLET_ADDRESS,
              tokenAddress: token.address
            });

            // 4. 满足条件执行交易
            const tradeData = {
              chain: 'solana',
              side: 'BUY',
              inputToken: process.env.BASE_TOKEN_ADDRESS, // 假设使用 USDC 作为基础货币
              outputToken: token.address,
              amount: process.env.TRADE_AMOUNT, // 从环境变量中获取交易金额
              fromAddress: process.env.WALLET_ADDRESS,
              slippage: 1 // 1% 滑点
            };

            try {
              const tradeStatus = await executeTradeWithLogging(tradeData);
              console.log(`Trade executed for token ${token.symbol}, status:`, tradeStatus);
            } catch (tradeError) {
              console.error(`Failed to execute trade for token ${token.symbol}:`, tradeError);
            }
          }
        }
      }

      // 获取并保存交易数据（如果需要的话）
      const tradingData = await fetchTradingData();
      if (tradingData) {
        await saveTradingData(tradingData);
      }

    } catch (error) {
      console.error('Error in trading bot cycle:', error);
    }
  }, 60000); // 每分钟运行一次
}

runTradingBot();

export {
  saveTradingData,
  executeTradeWithLogging,
  runTradingBot
};