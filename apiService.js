import { sendRequest } from './httpUtils.js';
import dotenv from 'dotenv';
import { executeSolanaSwap } from './solanaTrading.js';

dotenv.config();

const GMGN_API_URL = process.env.GMGN_API_URL;

// ... 保留之前的函数 ...

/**
 * 执行 Solana 代币交换
 * @param {Object} tradeParams - 交易参数
 * @returns {Promise<Object>} - 交易结果
 */
async function executeSolanaTrade(tradeParams) {
  const { inputToken, outputToken, amount, fromAddress, slippage } = tradeParams;
  try {
    const result = await executeSolanaSwap(inputToken, outputToken, amount, fromAddress, slippage);
    return result;
  } catch (error) {
    console.error('Error executing Solana trade:', error);
    throw error;
  }
}

export {
  getPopularList,
  fetchTradingData,
  getWalletHoldings,
  gmgnTokens,
  getPairInfo,
  getTradeQuote,
  executeTrade,
  getTradeStatus,
  executeSolanaTrade
};