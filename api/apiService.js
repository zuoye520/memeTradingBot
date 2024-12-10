import { sendRequest } from '../utils/httpUtils.js';
import * as cheerio from 'cheerio';
import dotenv from 'dotenv';
import { executeSolanaSwap } from './solanaTrading.js';
import RaydiumSwap from './raydiumSwap.js'
import { transferSPLToken, checkSPLTokenAccount } from './solanaTransfer.js';
import { Connection, LAMPORTS_PER_SOL,PublicKey } from '@solana/web3.js';
dotenv.config();

const GMGN_API_URL = process.env.GMGN_API_URL;
const NOTIFY_API_URL = process.env.NOTIFY_API_URL;
/**
 * 发送通知
 * @param {*} params 
 * @returns 
 */
async function sendNotifys(params = {}) {
  try {
    // 构建 API 请求 URL
    const url = `${NOTIFY_API_URL}/api/notify`;
    // 请求数据
    const data = params;
    // 发送 GET 请求获取热门列表
    const response = await sendRequest(url, { method: 'post',data });
    // 检查 API 响应是否成功
    if (response.code !== 0) throw response;
    
    return response;
  } catch (error) {
    // 捕获并记录任何发生的错误
    console.error('发送消息失败:', error);
    throw error
  }
}
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
 * 获取钱包信息
 * @param {string} walletAddress - 钱包地址
 * @returns {Promise<Array>} - 持仓盈亏信息数组
 */
async function getWalletInfo(walletAddress) {
  try {
    const url = `${GMGN_API_URL}/defi/quotation/v1/smartmoney/sol/walletNew/${walletAddress}`;
    console.log('getGmgnWalletInfo:',url)
    const response = await sendRequest(url, { method: 'get' });
    if (response.code !== 0) throw response
    return response.data;
  } catch (error) {
    console.error('获取钱包信息出错:', error);
    throw error
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
  if (status && status.data.success === false && status.data.failed === true && (status.data.err_code=='0x1e' || status.data.err_code=='0x1' || status.data.err_code=='0x28')) return 'failed';//过期 expired
  // if (status && status.data.success === false && status.data.failed === false && status.data.expired === false && status.data.err_code=='0x0') return 'failed';//过期 expired
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
    // let url = `https://www.binance.com/bapi/apex/v1/public/apex/cms/article/list/query?type=1&pageSize=5&pageNo=1`; 
    let url = `https://www.binance.com/zh-CN/support/announcement/new-cryptocurrency-listing?c=48&navId=48`
    console.log('getBnArticleList:',url)
    const response = await sendRequest(url, { method: 'get' });
    console.log('getBinanceArticleList result:',response)
    // const $ = cheerio.load(response);
    // const titles = [],
    //   times = [];
    // $('h3.typography-body1-1').each((index, element) => {
    //   titles.push($(element).text().trim());
    // });
    // $('div[class="typography-caption1 noH5:typography-body1-1 text-TertiaryText mobile:text-SecondaryText"]').each((index, element) => {
    //   times.push($(element).text().trim());
    // });
    // console.log('公告标题:', titles,times);
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

/**
 * Bybit 公告
 * @returns 
 */
async function getBybitArticleList() {
  
  try {
    // 构建 API 请求 URL
    let url = `https://api.bybit.com/v5/announcements/index?locale=zh-TW&page=1&limit=10&type=new_crypto`; 
    console.log('getBybitArticleList:',url)
    const response = await sendRequest(url, { method: 'get' });
    if(response.retCode !==0) throw response
    return response.result.list;
  } catch (error) {
    console.error('getBybitArticleList Error:', error);
    throw error;
  }
}
/**
 * Bybit 公告
 * @returns 
 */
async function getBitgetArticleList() {
  
  try {
    // 当前时间的 Unix 毫秒时间戳
    const endTime = Date.now();
    // 前一天的 Unix 毫秒时间戳
    const oneDayInMillis = 24 * 60 * 60 * 1000;
    const startTime = endTime - oneDayInMillis;
    // 构建 API 请求 URL
    let url = `https://api.bitget.com/api/v2/public/annoucements?annType=coin_listings&language=zh_CN&startTime=${startTime}&endTime=${endTime}`; 
    console.log('getBitgetArticleList:',url)
    const response = await sendRequest(url, { method: 'get' });
    if(response.msg !=='success') throw response
    return response.data;
  } catch (error) {
    console.error('getBitgetArticleList Error:', error);
    throw error;
  }
}
/**
 * bithumb 公告
 * @returns 
 */
async function getBithumbArticleList() {
  try {
    const cookies = `bt_react=Y; _fbp=fb.1.1732012829260.566976767327275898; custom_cookie_theme=N; bm_mi=D437D7A806B4BF9B690574D1D4399D6B~YAAQJy3RF7Y6RpmTAQAAMaCEqRrWKKbCpRuwY8ghjiQKnnirsxNLe5tuKJ7hMVkpof9a6a14u0SiRZYI47WQmVM4eUGAy+8uFrBHhaP1crAyj5s/I55z/RiWxiqhA6CLEhdgj1PVNauUtoa4JU6hRR1EXBGXETip5hCeUGrZ8WswkoKC5+mJ9ASK5IYS16Y+nEDzbCEP8GWxY5xxoGK96eGdmwlLrAfWSOZiUv3IGvlfU9qwg5/GKQi5CKIsfr82QrJlujNYtHd4z+ahvaixwemQUYwGLQibPQaf6Q4txURlcJtOcn8gJkA1Kb8vm9kyPY75FsE=~1; ak_bmsc=B5E77966189202C1B6C89086D12D326D~000000000000000000000000000000~YAAQJy3RF906RpmTAQAAQqmEqRpf0RlSTw0aZXiGjxytnCUzr+v2gK1JJKP2yN7GfMkXWZ7azPYUe/17Az1HCTNXTth0sLi0oFTeri3aqIingK9xVKMyvUU2sAdYF5wT2g9mYFZYGWz3ItJZm6Qviom678eDpkiDalfoPQ4HIWzbHvRXEkhKZUMbGov6IL9kh8fkWQCEZSO53O92qsiWwNKcoqF5TY5OcGFSXxN3nSGs6o7mH4QAIs98zfWVY3uh60aKi3jGDNXtk+oUzGoCG3lXIn+pR/YS1WtmfhFX47Uq9+Zmagu4/2JGx0JH+pWNU+Vj0PJ6BnO9YEWIDM/N+lwHQbOfIZjproerlLKXp5H5DQqCdlPldIMpnfbzbM7LnWyXVuYdIZhl2sqzIfwSadZEhqTk0QwSGUP+wMjx8a9QliUhMSEkRNrj2sA3kDmna9IqbLQzYLHHjpPVDhwJbcrArE0EqJX9B0+WHJroUDyWSZCtdEA=; mainBannerBelt294=Y; _abck=070B59975BE52FB1E259360394FB3D8C~0~YAAQHy3RF3NjA5eTAQAApfSFqQ0KJKV57rsgPkPaWkTt0K8pdb2cVsulyRFMa0cSblcCkgwxB+BDJ469cd2Fy1UIpclFbAKJqA8NrfF58oA9+za1HzM6ucbbzPJZcwyRhJC7sBxghdtmmv73AB8U/I2Tp/+vyl++qLln4LH3wrNcxhnQiwZyFQE1vudpzBha74SAcoSHBpOBGhJ8SseW6W/M+1Vm7uce5Pyj/Zsfa3WV3RtcmnJ8hPr0CZ2e6bCvEuLF+Ir5hzcLpDCsmIDNR8KZIJmm0aNEx2f5sOX0GLQlTt/Vb89/g5aY6Tvn0ev2Bp5iArflmIK9EhUv7C7S4jjK5QNL7eiinKd1kC9NNOnVuuqcEANdAap9Wy3LOXPEMyAzapw5+p7bOyMkMfN5DN+LPSUi5Qx95cHTplitQzMydq2LiUCU2t5K5fjmJtoLCucE4yYXsiBlTqi8HJnDmkmQ1MUnEvhE3kBAvjwTdNAy~-1~-1~-1; bm_sv=9C0CC31E79A97AABA8AFCACF63BFFB61~YAAQV0XcF/QktkaTAQAAYBGIqRrFqSvLWNOOy1qCBuz0wYxEeKbLDeMv0H/RuUKq7SYsif3d8pSDsFopn0QAFrULD8YubC7YmcCgY0XiaYjNOxfi8+c0Xehj+2Zzoe8rpxPnT2ZBui5QHnDEOMVKSlGYpY9dVhGPBAdRSaPQFH8h1jU+Qv9bgTBS50749YVZaenfjCeaQJQu/NJ6CXg8l1qpP4eZzZ+qCnF8qeyoAbQCdTrXLRlrEdlTFulBxc2uxJA=~1; _gid=GA1.2.2046406342.1733716095; _ga_V9QC8ZLCKS=GS1.1.1733716095.1.1.1733716407.0.0.0; _ga=GA1.1.1304914901.1732012428; bm_sz=AAA7BCE2AE1D3D58D098D7808A28BB9D~YAAQvSAhF5d2R56TAQAA1ziTqRo/jc5JjhFPzPKH0ln4d3SKHwP0P15a4CwejEOWgdIOyNnVfbUeyZLvyYtLzbPYHJkoud5DZI7yWcwqgxzQYQrAMPeah676q8QG/aCpVLnEXplZb+tGVAK+hUzb2a9gTuplTdhyPJy1MOMTVdOiwjG0h+eeYZCwjHsUexChNKrQHHCT9WwJz7kTWc7+Wl/hSQv2wCq7utg7iQMVKkrBPTzt0YEZNGMKq/oJczLgj/MUyDQrfjYZEL6tLqZKLTyFjoZwalAI8uPA8MHvGz2yqZHuWEPQHhV/vvZT2tQrHQNCBC2dSW0qGQIUvWdMdKxbRZDQvqnsIcKRIBCJ/kd/WX/b5EpXMwbSme/TtWHWI/4dOE+cZOkYBzh0TWSvXGSCMGOFIs5GQ29jhWhtLgkoJ4NfZrPn+iJL0webGG82~4534582~3424821; RT="z=1&dm=bithumb.com&si=be2cdf89-ed68-41ed-9335-0f960e0e36cf&ss=m4ghnpsc&sl=3&tt=cx3&bcn=%2F%2F684d0d44.akstat.io%2F&rl=1&nu=8yt7sk2&cl=4zwt&obo=1&ld=kkjg&r=4csgumab&hd=kkjh"; _ga_LZEDLEJTC3=GS1.1.1733715867.4.1.1733719354.29.0.0`
    const headers = {
      // "authority":"feed.bithumb.com",
      // "path":"/notice?category=9&page=1",
      // "scheme":"https",
      // "method":"GET",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
      "Accept-Encoding":"gzip, deflate, br, zstd",
      "Accept-Language":"zh-CN,zh;q=0.9,en;q=0.8",
      "Cache-Control":"no-cache",
      "Pragma":"no-cache",
      "Priority":"u=1, i",
      "Sec-Ch-Ua":'"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
      "Sec-Ch-Ua-Mobile":"?0",
      "Sec-Ch-Ua-Platform":"macOS",
      "Sec-Fetch-Mode":"cors",
      "Sec-Fetch-Site": "same-origin",
      "Accept-Language": "zh-CN,zh-Hans;q=0.9",
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      "upgrade-insecure-requests":1,
      "Sec-Fetch-Dest": "document",
      "Cookie": cookies,
      
  };
    // 构建 API 请求 URL
    let url = `https://feed.bithumb.com/_next/data/hhdLPMrwd0SGFdqVw_11M/notice.json?category=9&page=1`;
    console.log('getBithumbArticleList:',url)
    const response = await sendRequest(url, { 
      headers:headers,
      method: 'get' 
    });
    console.log('response:',response)
    if(!response.pageProps || response.pageProps.status != 'ok') throw response
    return response.pageProps.noticeList;
  } catch (error) {
    console.error('getBithumbArticleList Error:', error);
    throw error;
  }
}

// async function getBithumbArticleList() {
//   try {
//     const headers = {
//       "authority":"www.binance.com",
//       "path":"/zh-CN/support/announcement/new-cryptocurrency-listing?c=48&navId=48",
//       "referer":"https://www.binance.com/zh-CN/support/announcement",
//       "scheme":"https",
//       "method":"GET",
//       "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
//       "Accept-Encoding":"gzip, deflate, br, zstd",
//       "Accept-Language":"zh-CN,zh;q=0.9,en;q=0.8",
//       "Cache-Control":"no-cache",
//       "Pragma":"no-cache",
//       "Priority":"u=1, i",
//       "Sec-Ch-Ua":'"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
//       "Sec-Ch-Ua-Mobile":"?0",
//       "Sec-Ch-Ua-Platform":"macOS",
//       "Sec-Fetch-Mode":"cors",
//       "Sec-Fetch-Site": "same-origin",
//       "Accept-Language": "zh-CN,zh-Hans;q=0.9",
//       "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
//       "upgrade-insecure-requests":1,
//       "Sec-Fetch-Dest": "document",
//       "Cookie": `monitor-uid=434564334; bnc-uuid=6b27e440-ba3a-4b0c-ac5a-da2bddb8d3cd; changeBasisTimeZone=; se_gd=wsBUxAlkQQFEBJXlRGFkgZZDQU1ARBZUVMAJfW0B1hTUwVFNXWQD1; BNC_FV_KEY=333e81e67269a979808d33ccd1275b812c168083; se_gsd=XjAkLzhvNSQkDQkyNxwiFRAnCVVSBAcYWFVAU1FVWlhVI1NS1; theme=dark; source=BinanceTwitter; campaign=GlobalSocial; OptanonAlertBoxClosed=2024-02-02T08:29:27.341Z; language=zh-CN; BNC-Location=BINANCE; userPreferredCurrency=USD_USD; language=zh-CN; userId=; futures-layout=pro; _gcl_au=1.1.1086385030.1731762914; _uetvid=2ab5f7a0851b11eeb3bc293722eba7d9; bu_c=1qegaGiTVQw_vniw4kpg7w; bu_s=twitter; bu_a=web_square_share_link; ref=902507482; refstarttime=1733581672041; se_sd=xYQFBB1sBEBVBJWQMBw8gZZBhFg0PEQW1VcZeVU5VJRWwB1NWUYD1; cr00=FFF79CCE42E277BE608C298FC422BE17; d1og=web.434564334.BC5C6C50B411841605E4F7231A847709; r2o1=web.434564334.0A8D7A9410644765E2887F653AB3CA89; f30l=web.434564334.47F642823F2CE1C652A1633BCDE9AD47; logined=y; __BNC_USER_DEVICE_ID__={"37faa25a5c61b2fd6e3cdc85b9359ae9":{"date":1711156880024,"value":""},"d41d8cd98f00b204e9800998ecf8427e":{"date":1733581705739,"value":""}}; p20t=web.434564334.0C3EA0056C312DBC3EB04B7D5CA7A307; sensorsdata2015jssdkcross=%7B%22distinct_id%22%3A%22434564334%22%2C%22first_id%22%3A%2218bbe0760219c8-0a7ad67dff941f-16525634-1296000-18bbe076022625%22%2C%22props%22%3A%7B%22%24latest_traffic_source_type%22%3A%22%E7%9B%B4%E6%8E%A5%E6%B5%81%E9%87%8F%22%2C%22%24latest_search_keyword%22%3A%22%E6%9C%AA%E5%8F%96%E5%88%B0%E5%80%BC_%E7%9B%B4%E6%8E%A5%E6%89%93%E5%BC%80%22%2C%22%24latest_referrer%22%3A%22%22%2C%22%24latest_utm_campaign%22%3A%22web_square_share_link%22%2C%22%24latest_utm_source%22%3A%22twitter%22%2C%22%24latest_utm_medium%22%3A%22GlobalSocial%22%2C%22%24latest_utm_content%22%3A%221qegaGiTVQw_vniw4kpg7w%22%7D%2C%22identities%22%3A%22eyIkaWRlbnRpdHlfY29va2llX2lkIjoiMThiYmUwNzYwMjE5YzgtMGE3YWQ2N2RmZjk0MWYtMTY1MjU2MzQtMTI5NjAwMC0xOGJiZTA3NjAyMjYyNSIsIiRpZGVudGl0eV9sb2dpbl9pZCI6IjQzNDU2NDMzNCJ9%22%2C%22history_login_id%22%3A%7B%22name%22%3A%22%24identity_login_id%22%2C%22value%22%3A%22434564334%22%7D%2C%22%24device_id%22%3A%2218bbe0760219c8-0a7ad67dff941f-16525634-1296000-18bbe076022625%22%7D; _gid=GA1.2.1853776375.1733712056; lang=zh-cn; BNC_FV_KEY_T=101-844cFoZq2cc37%2FXXSMEUY519czzeVGT5iAHntNrA5%2FwX63zvS6Ep3qK1R5pKEb5ioLGwU0u3gmmEnqMpBQ5%2Flg%3D%3D-wP1PXtlhg2zTyx3UPiWhRg%3D%3D-d6; BNC_FV_KEY_EXPIRE=1733733677733; OptanonConsent=isGpcEnabled=0&datestamp=Mon+Dec+09+2024+12%3A00%3A53+GMT%2B0800+(%E4%B8%AD%E5%9B%BD%E6%A0%87%E5%87%86%E6%97%B6%E9%97%B4)&version=202411.1.0&browserGpcFlag=0&isIABGlobal=false&hosts=&consentId=8063c2e1-9173-411d-9a2d-13048cf1611a&interactionCount=2&landingPath=NotLandingPage&groups=C0001%3A1%2CC0003%3A1%2CC0004%3A1%2CC0002%3A1&geolocation=SG%3B&AwaitingReconsent=false&isAnonUser=1; _ga_3WP50LGEEC=GS1.1.1733712049.833.1.1733716856.54.0.0; _ga=GA1.1.2139504594.1699700236`,
      
//   };
//     // 构建 API 请求 URL
//     let url = `https://www.binance.com/zh-CN/support/announcement/new-cryptocurrency-listing?c=48&navId=48`;
//     console.log('getBithumbArticleList:',url)
//     const response = await sendRequest(url, { 
//       // headers,
//       method: 'get' 
//     });
//     console.log('response:',response)
//     if(!response.pageProps || response.pageProps.status != 'ok') throw response
//     return response.pageProps.noticeList;
//   } catch (error) {
//     console.error('getBithumbArticleList Error:', error);
//     throw error;
//   }
// }

export {
  sendNotifys,
  transferSPLToken,
  checkSPLTokenAccount,
  getSolanaBalance,
  getSolanaTokenBalance,
  getNewPoolList,
  getPopularList,
  getWalletHoldings,
  getWalletInfo,
  gmgnTokens,
  executeSolanaTrade,
  executeRaydiumSwap,
  fetchPoolKeys,
  getTransactionStatus,
  getDaosFunList,
  getTipTagNewList,
  getBinanceArticleList,
  getUpbitArticleList,
  getMexcArticleList,
  getBybitArticleList,
  getBithumbArticleList,
  getBitgetArticleList
};