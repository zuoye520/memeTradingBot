import { sendRequest } from './httpUtils.js';
import dotenv from 'dotenv';
import { executeSolanaSwap } from './solanaTrading.js';

dotenv.config();

const GMGN_API_URL = process.env.GMGN_API_URL;

/**
 * 获取热门代币列表
 * @param {Object} params - 请求参数
 * @param {string} [params.time='1m'] - 时间范围
 * @param {number} [params.limit=20] - 返回结果数量限制
 * @returns {Promise<Array>} - 热门代币列表
 */
async function getPopularList(params = {}) {
  const { time = '1m', limit = 20 } = params;
  try {
    // 构建 API 请求 URL
    const url = `${GMGN_API_URL}/defi/quotation/v1/rank/sol/swaps/${time}?orderby=swaps&direction=desc&limit=${limit}&filters[]=renounced&filters[]=frozen`;
    
    // 发送 GET 请求获取热门列表
    const response = await sendRequest(url, { method: 'get' });
    
    // 检查 API 响应是否成功
    if (response.code !== 0) throw response;
    
    // 返回热门代币排名数据
    return response.data.rank;
  } catch (error) {
    // 捕获并记录任何发生的错误
    console.error('获取热门列表失败:', error);
    return [];
  }
}

/**
 * 获取特定 Solana 代币的信息
 * @param {string} tokenAddress - 代币地址
 * @returns {Promise<Object|boolean>} - 代币信息或在发生错误时返回 false
 */
async function gmgnTokens(tokenAddress) {
  // 构建 API 请求 URL
  const quoteUrl = `${GMGN_API_URL}/defi/quotation/v1/tokens/sol/${tokenAddress}`;
  console.log('请求 URL:', quoteUrl);
  
  try {
    // 发送 GET 请求获取代币信息
    const route = await sendRequest(quoteUrl, { method: 'get' });
    
    // 检查 API 响应是否成功
    if (route.code !== 0) {
      console.error('获取代币信息失败', route);
      return false;
    }
    
    // 返回代币数据
    return route.data;
  } catch (error) {
    // 捕获并记录任何发生的错误
    console.error('gmgnTokens 函数出错:', error);
    return false;
  }
}

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