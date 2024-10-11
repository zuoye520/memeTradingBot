import { sendRequest } from './httpUtils.js';
import dotenv from 'dotenv';
import { executeSolanaSwap } from './solanaTrading.js';
import { Connection, LAMPORTS_PER_SOL,PublicKey } from '@solana/web3.js';
dotenv.config();

const GMGN_API_URL = process.env.GMGN_API_URL;

/**
 * 获取热门代币列表
 * @param {Object} params - 请求参数
 * @param {string} [params.time='1m'] - 时间范围
 * @param {number} [params.limit=20] - 返回结果数量限制
 * @param {number} [params.max_marketcap=500000] - 最大市值
 * @param {number} [params.min_holder_count=500] - 最少持仓地址
 * @param {string} [params.min_created='2h'] - 最少创建时间
 * @returns {Promise<Array>} - 热门代币列表
 */
async function getPopularList(params = {}) {
  const { time = '1m', limit = 20,max_marketcap =500000,min_holder_count=500,min_created='2h' } = params;
  try {
    // 构建 API 请求 URL
    const url = `${GMGN_API_URL}/defi/quotation/v1/rank/sol/swaps/${time}?orderby=swaps&direction=desc&limit=${limit}&filters[]=renounced&filters[]=frozen&max_marketcap=${max_marketcap}&min_holder_count=${min_holder_count}&min_created=${min_created}`;
    
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

/**
 * 获取钱包持仓盈亏信息
 * @param {string} walletAddress - 钱包地址
 * @returns {Promise<Array>} - 持仓盈亏信息数组
 */
async function getWalletHoldings(walletAddress) {
  try {
    const url = `${GMGN_API_URL}/defi/quotation/v1/wallet/sol/holdings/${walletAddress}?orderby=unrealized_profit&direction=desc&showsmall=true&sellout=true`;
    const response = await sendRequest(url, { method: 'get' });
    
    if (response.code !== 0) {
      console.error('获取钱包持仓盈亏信息失败', response);
      return [];
    }
    
    return response.data.holdings;
  } catch (error) {
    console.error('获取钱包持仓盈亏信息出错:', error);
    return [];
  }
}

async function executeSolanaTrade(tradeParams) {
  const { inputToken, outputToken, amount, slippage, swapMode, fee} = tradeParams;
  try {
    const result = await executeSolanaSwap(inputToken, outputToken, amount, slippage, swapMode, fee);
    return result;
  } catch (error) {
    console.error('Error executing Solana trade:', error);
    throw error;
  }
}

/**
 * 获取 Solana 钱包余额
 * @param {string} walletAddress - Solana 钱包地址
 * @returns {Promise<number>} - 钱包余额（以 SOL 为单位）
 */
async function getSolanaBalance(walletAddress) {
  try {
    const connection = new Connection(process.env.SOLANA_RPC_URL, 'confirmed');
    const accountKey = new PublicKey(walletAddress);
    const balance = await connection.getBalance(accountKey);
    return balance / LAMPORTS_PER_SOL;
  } catch (error) {
    console.error('获取 Solana 余额失败:', error);
    throw error;
  }
}

async function getTransactionStatus(hash,lastValidBlockHeight) {
  const statusUrl = `${GMGN_API_URL}/defi/router/v1/sol/tx/get_transaction_status?hash=${hash}&last_valid_height=${lastValidBlockHeight}`;
  const status = await sendRequest(statusUrl, { method: 'get' });
  console.log('Transaction status:', statusUrl, status);
  if (status && (status.data.success === true)) return 'success';//上链成功
  if (status && (status.data.expired === true || status.data.failed === true)) return 'failed';//过期expired /失败failed
  return 'undone';
}

export {
  getSolanaBalance,
  getPopularList,
  getWalletHoldings,
  gmgnTokens,
  executeSolanaTrade,
  getTransactionStatus
};