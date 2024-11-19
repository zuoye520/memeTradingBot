import { sendRequest } from '../utils/httpUtils.js';
import dotenv from 'dotenv';
import { executeSolanaSwap } from './solanaTrading.js';
import RaydiumSwap from './raydiumSwap.js'
import { transferSPLToken, checkSPLTokenAccount } from './solanaTransfer.js';
import { Connection, LAMPORTS_PER_SOL,PublicKey } from '@solana/web3.js';
dotenv.config();

const GMGN_API_URL = process.env.GMGN_API_URL;

/**
 * 获取gmgn新币列表
 * @param {*} params 
 * @returns 
 */
async function getNewPoolList(params = {}) {
  const { time = '1m', limit = 20} = params;
  try {
    // 构建 API 请求 URL
    const url = `${GMGN_API_URL}/defi/quotation/v1/pairs/sol/new_pairs/${time}?limit=${limit}&orderby=open_timestamp&direction=desc&period=1m&filters[]=not_honeypot&filters[]=has_social&filters[]=renounced&filters[]=frozen&platforms[]=pump&platforms[]=moonshot&platforms[]=raydium`;
    console.log('getPopularList:',url)
    // 发送 GET 请求获取热门列表
    const response = await sendRequest(url, { method: 'get' });
    
    // 检查 API 响应是否成功
    if (response.code !== 0) throw response;
    
    // 返回热门代币排名数据
    return response.data.pairs;
  } catch (error) {
    // 捕获并记录任何发生的错误
    console.error('获取新币列表失败:', error);
    return [];
  }
}

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
    console.log('getPopularList:',url)
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
    const url = `${GMGN_API_URL}/api/v1/wallet_holdings/sol/${walletAddress}?orderby=unrealized_profit&direction=desc&showsmall=true&sellout=true`;
    console.log('getWalletHoldings:',url)
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

/**
 * gmgn swap API
 * @param {*} tradeParams 
 * @returns 
 */
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
 * Raydium Swap
 * @param {*} tradeParams 
 * @returns 
 */
async function executeRaydiumSwap(tradeParams) {
  const { inputToken:baseMint, outputToken:quoteMint, amount, slippage = 10, swapMode, fee:priorityFee, useVersionedTransaction = true} = tradeParams;
  try {

    const raydiumSwap = new RaydiumSwap(process.env.SOLANA_RPC_URL, process.env.SOL_PRIVATE_KEY)
    console.log(`Raydium swap initialized`)

    // Loading with pool keys from https://api.raydium.io/v2/sdk/liquidity/mainnet.json
    await raydiumSwap.loadPoolKeys()
    console.log(`Loaded pool keys`)

    // Trying to find pool info in the json we loaded earlier and by comparing baseMint and tokenBAddress
    let poolInfo = raydiumSwap.findPoolInfoForTokens(baseMint, quoteMint)

    if (!poolInfo) poolInfo = await raydiumSwap.findRaydiumPoolInfo(baseMint, quoteMint)

    if (!poolInfo) {
      throw new Error("Couldn't find the pool info")
    }
    const side = swapMode =='ExactIn'? 'in':'out' 
    const tx = await raydiumSwap.getSwapTransaction(
      quoteMint,
      amount,
      poolInfo,
      priorityFee * LAMPORTS_PER_SOL, // Prioritization fee, now set to (0.0005 SOL)
      useVersionedTransaction,
      'in',// "in" | "out" 这里如果是out 则baseMint amount不是固定值
      slippage // Slippage
    )
    let lastValidBlockHeight,
        txid;
    if (useVersionedTransaction) {
      txid = await raydiumSwap.sendVersionedTransaction(tx)
      const { lastValidBlockHeight: blockHeight } = await raydiumSwap.connection.getLatestBlockhash()
      lastValidBlockHeight = blockHeight
    } else {
        txid = await raydiumSwap.sendLegacyTransaction(tx)
        lastValidBlockHeight = tx.lastValidBlockHeight
    }
    console.log(`Transaction sent: https://solscan.io/tx/${txid}`)
    return {data:{hash:txid,lastValidBlockHeight}}

  } catch (error) {
    console.error('Error executing Solana trade:', error);
    throw error;
  }
}
async function fetchPoolKeys() {
  const raydiumSwap = new RaydiumSwap(process.env.SOLANA_RPC_URL, process.env.SOL_PRIVATE_KEY)
    console.log(`Raydium swap initialized`)

    // Loading with pool keys from https://api.raydium.io/v2/sdk/liquidity/mainnet.json
    await raydiumSwap.loadPoolKeys()
    console.log(`Loaded pool keys`)
    return true;
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

/**
 * 获取token 余额
 * @returns {Object} balance {
  amount: '45539516',
  decimals: 9,
  uiAmount: 0.045539516,
  uiAmountString: '0.045539516'
}
 */
async function getSolanaTokenBalance(walletAddress,tokenAddress) {
  // 创建账户和 Token 的 PublicKey 对象
  const accountKey = new PublicKey(walletAddress);
  const tokenMintKey = new PublicKey(tokenAddress);

  // 查询账户的 token 余额
  const connection = new Connection(process.env.SOLANA_RPC_URL, 'confirmed');
  const tokenAccountInfo = await connection.getParsedTokenAccountsByOwner(accountKey, { mint: tokenMintKey });
  if (!tokenAccountInfo || tokenAccountInfo.value.length === 0) {
      throw new Error('Token account not found');
  }
  console.log('tokenAmount:',tokenAccountInfo.value[0].account.data.parsed.info.tokenAmount)
  // 提取并返回余额
  const tokenAmount = tokenAccountInfo.value[0].account.data.parsed.info.tokenAmount;
  return tokenAmount;
}

async function getTransactionStatus(hash,lastValidBlockHeight) {
  const statusUrl = `${GMGN_API_URL}/defi/router/v1/sol/tx/get_transaction_status?hash=${hash}&last_valid_height=${lastValidBlockHeight}`;
  const status = await sendRequest(statusUrl, { method: 'get' });
  console.log('Transaction status:', statusUrl, status);
  if (status && (status.data.success === true)) return 'success';//上链成功
  if (status && status.data.success === false && status.data.expired === true) return 'failed';//过期 expired
  if (status && status.data.success === false && status.data.failed === true && (status.data.err_code=='0x1e' || status.data.err_code=='0x1')) return 'failed';//过期 expired
  return 'undone';
}

/**
 * daos.fun api
 * @returns {Array}
 */
async function getDaosFunList() {
  try {
    // 构建 API 请求 URL
    const url = `https://www.daos.fun/api/trpc/banner_events.list,daos?batch=1&input=%7B%221%22%3A%7B%22page_number%22%3A1%7D%7D`;
    console.log('getDaosFunList:',url)
    const response = await sendRequest(url, { method: 'get' });
    // console.log('response:',response)
    if (!Array.isArray(response)) throw response;
    return response;
  } catch (error) {
    console.error('getDaosFunList Error:', error);
    throw error;
  }
}
/**
 * tiptag api
 * https://eth-api.tiptag.social/community/communitiesByNew eth
 * https://enuls-api.tiptag.social/community/communitiesByNew enuls
 * https://api.tiptag.social/community/communitiesByNew base
 * @returns {Array}
 */
async function getTipTagNewList(chain = 'base') {
  try {
    // 构建 API 请求 URL
    let url = `https://api.tiptag.social/community/communitiesByNew`; 
    if(chain === 'eth'){
      url = `https://eth-api.tiptag.social/community/communitiesByNew`
    }else if(chain === 'enuls'){
      url = `https://enuls-api.tiptag.social/community/communitiesByNew`
    }
    console.log('getTipTagNewList:',url)
    const response = await sendRequest(url, { method: 'get' });
    if (!Array.isArray(response)) throw response;
    return response;
  } catch (error) {
    console.error('getTipTagNewList Error:', error);
    throw error;
  }
}
/**
 * Binance 公告
 * @returns 
 */
async function getBinanceArticleList() {
  try {
    // 构建 API 请求 URL
    let url = `https://www.binance.com/bapi/apex/v1/public/apex/cms/article/list/query?type=1&pageSize=5&pageNo=1`; 
    console.log('getBnArticleList:',url)
    const response = await sendRequest(url, { method: 'get' });
    if(!response.success) throw response
    return response.data.catalogs;
  } catch (error) {
    console.error('getBinanceArticleList Error:', error);
    throw error;
  }
}
/**
 * Upbit 公告
 * @returns 
 */
async function getUpbitArticleList() {
  try {
    // 构建 API 请求 URL
    let url = `https://api-manager.upbit.com/api/v1/announcements?os=web&page=1&per_page=20&category=trade`; 
    console.log('getUpbitArticleList:',url)
    const response = await sendRequest(url, { method: 'get' });
    if(!response.success) throw response
    return response.data.notices;
  } catch (error) {
    console.error('getUpbitArticleList Error:', error);
    throw error;
  }
}
/**
 * Mexc 公告
 * 上新币ID：15425930840735
 * @returns 
 */
async function getMexcArticleList() {
  const headers = {
    "Accept": "*/*",
    "Sec-Fetch-Site": "same-site",
    "Accept-Language": "zh-CN,zh-Hans;q=0.9",
    "Accept-Encoding": "gzip, deflate, br",
    "Sec-Fetch-Mode": "cors",
    "Content-Type": "application/json",
    // Content-Length: 55
    "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148",
    "Referer": "https://www.mexc.com/zh-TW/support/categories/360000254192?handleDefaultLocale=keep",
    "Connection": "keep-alive",
    "Sec-Fetch-Dest": "empty",
    "sentry-trace":"ca7e2df4086b4afebe27e75829e30a0f-884c7f445efd6c36-0",
    "trochilus-trace-id":"27120a1e-1e5a-4aa5-b734-48a02cdeffb9-0305",
    "trochilus-uid":"29008685"
};
  try {
    // 构建 API 请求 URL
    // let url = `https://www.mexc.com/help/announce/api/en-US/section/15425930840735/articles?page=1&perPage=10`; 
    const url = `https://www.mexc.com/help/announce/api/zh-TW/section/15425930840735/articles?page=1&perPage=20`
    console.log('getMexcArticleList:',url)
    const response = await sendRequest(url, { 
      headers,
      method: 'get' 
    });
    if(response.msg !=='success') throw response
    return response.data.results;
  } catch (error) {
    console.error('getMexcArticleList Error:', error);
    throw error;
  }
}

export {
  transferSPLToken,
  checkSPLTokenAccount,
  getSolanaBalance,
  getSolanaTokenBalance,
  getNewPoolList,
  getPopularList,
  getWalletHoldings,
  gmgnTokens,
  executeSolanaTrade,
  executeRaydiumSwap,
  fetchPoolKeys,
  getTransactionStatus,
  getDaosFunList,
  getTipTagNewList,
  getBinanceArticleList,
  getUpbitArticleList,
  getMexcArticleList
};