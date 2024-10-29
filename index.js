/**
 * memeTradingBot
 * 专注于SOLANA网络meme交易
 */
import dotenv from 'dotenv';
import { insertData, selectData, updateData, deleteOldData } from './utils/db.js';
import redisManager from './utils/redisManager.js';
import { initDatabase } from './utils/dbInit.js';
import log from './utils/log.js';

import {
  getSolanaBalance,
  getSolanaTokenBalance,
  getPopularList,
  getWalletHoldings,
  executeSolanaTrade,
  getTransactionStatus
} from './api/apiService.js';
import { sendTgMessage } from './utils/messagePush.js';
import { decryptPrivateKey } from './utils/keyManager.js';
//监控
import { monitorDaosFun } from './monitor/daosfun.js';
import { monitorTipTag } from './monitor/tiptag.js';

dotenv.config();
const sleep = (seconds) => {
  const milliseconds = seconds * 1000;
  
  return new Promise(resolve => setTimeout(resolve, milliseconds));
};
// 在程序开始时解密私钥
process.env.SOL_PRIVATE_KEY = decryptPrivateKey();
/**
 * 检查并执行买入操作
 */
async function checkAndExecuteBuy() {
  const lockKey = 'check_buy_lock';
  const lockSet = await redisManager.setTimeLock(lockKey, 20);//流程20秒
  if (!lockSet) {
    log.info('checkAndExecuteBuy 锁已存在，操作被阻止');
    return;
  } 
  
  try {
    // 检查 SOL 余额
    const solBalance = await getSolanaBalance(process.env.SOL_WALLET_ADDRESS);
    const requiredBalance = parseFloat(process.env.SOL_TRADE_AMOUNT) + parseFloat(process.env.SOL_PRIORITY_FEE);
    log.info(`SOL 当前余额: ${solBalance} SOL`);
    if (solBalance < requiredBalance * 1.5) {
      log.info(`SOL 余额不足。当前余额: ${solBalance} SOL, 需要: ${requiredBalance} SOL`);
      return;
    }
    // 1. 获取热门token列表
    const popularTokens = await getPopularList({ 
      time: '1m', 
      limit: 20,
      max_marketcap : 500000,//市值小于100万
      min_holder_count : 300,//持仓地址大于500
      min_created :'48h'//创建时间大于48小时24*3
    });
    // log.info('热门代币:', popularTokens);
    for (const token of popularTokens) {
      //排除CTO未接管，1m/5m/1h 涨跌幅太多的标的
      const condition = token.cto_flag === 0 || token.price_change_percent1m <= -5 || token.price_change_percent5m <= -10 || token.price_change_percent1h <= -30 || token.price_change_percent1m >= 20 || token.price_change_percent5m >= 40 || token.price_change_percent1h >= 80;
      if(condition){
        log.info(`代币 ${token.symbol} ${token.address} 未接管，1m/5m/1h 跌幅太大，跳过`);
        continue;
      }
      // 2. 查询数据库是否存在该token信息
      const tokenInfo = await selectData('token_info', { token_address: token.address, chain: token.chain });
      if (tokenInfo.length <= 0) {
        //设置token 购买时间锁
        const tokenLockSet = await redisManager.setTimeLock(token.address, 60*60*24);//锁 24小时
        if(!tokenLockSet){
          log.info(`${token.symbol} ${token.address} token锁已存在，操作被阻止`);
          continue;
        }
        // 3. 满足条件执行交易
        const tradeData = {
          swapMode: 'ExactIn',//SOL->TOKEN
          inputToken: process.env.SOL_ADDRESS,
          outputToken: token.address,
          amount: process.env.SOL_TRADE_AMOUNT * 1e9,//SOL 精度 9
          slippage: process.env.SOL_SLIPPAGE,
          fee: process.env.SOL_PRIORITY_FEE
        };
        try {
          const tradeResult = await executeSolanaTrade(tradeData);
          log.info(`已为代币 ${token.symbol} 执行交易，结果:`, tradeResult);
          if(!tradeResult || !tradeResult.data || !tradeResult.data.hash) {
            log.info(`交易失败，交易结果:`, tradeResult);
            //交易失败,删除缓存锁
            await redisManager.del(token.address);
            continue;
          }
          // 4. 不存在则插入
          const tokenId = await insertData('token_info', {
            chain: token.chain,
            token_address: token.address,
            symbol: token.symbol,
          });
          // 5. 记录交易到数据库
          await insertData('trade_records', {
            token_id: tokenId,
            hash: tradeResult.data.hash,
            last_valid_block_height: tradeResult.data.lastValidBlockHeight,
            wallet_address: process.env.SOL_WALLET_ADDRESS,
            side: 'BUY',
            in_token: tradeData.inputToken,
            out_token: tradeData.outputToken,
            in_token_decimals: 9,
            out_token_decimals: 9,
            in_token_amount: process.env.SOL_TRADE_AMOUNT,
            out_token_amount: 0,
            status: 'PENDING',
            priority_fee: process.env.SOL_PRIORITY_FEE,
            price: 0,
            gas_fee: 0
          });
        } catch (tradeError) {
          log.error(`为代币 ${token.symbol} 执行交易失败:`, tradeError);
        }
        // 6. 推送消息
        sendTgMessage({
          sniperAddress: process.env.SOL_WALLET_ADDRESS,
          tokenAddress: token.address,
          memo:`买入操作，买入数量: ${process.env.SOL_TRADE_AMOUNT}SOL`
        });
      } else {
        log.info(`代币${token.symbol}，${token.address} 在 token_info 表中，跳过`);
      }
    }
  } catch (error) {
    log.error('交易机器人周期出错:', error);
  } finally{
    log.info('checkAndExecuteBuy finally');
    //删除流程锁
    await redisManager.del(lockKey);
  }
  
}

/**
 * 检查并执行卖出操作
 */
async function checkAndExecuteSell() {
  const lockKey = 'check_sell_lock';
  const lockSet = await redisManager.setTimeLock(lockKey, 20);//流程20秒
  if (!lockSet) {
    log.info('checkAndExecuteSell 锁已存在，操作被阻止');
    return;
  } 
  try {
    const walletAddress = process.env.SOL_WALLET_ADDRESS;
    const holdings = await getWalletHoldings(walletAddress);

    for (let holding of holdings) {
      holding = {...holding, ...holding.token}
      if(holding.is_show_alert) {
        log.info(`${holding.symbol}，流动性不足，无法进行交易，跳过`);
        continue;
      }
      let sellAmount = 0;//卖出数量
      const profitPercentage = holding.unrealized_pnl * 100;//利润百分比 100%
      log.info(`代币：${holding.symbol}，当前盈亏百分比: ${profitPercentage.toFixed(2)}%`)
      if(profitPercentage > 30) sellAmount = holding.balance * 1;//卖出 100%
      // switch (holding.sells) {
      //   case 0://未卖出
      //     if(profitPercentage > 30) sellAmount = holding.balance * 1 //卖出90%
      //     break;
      //   case 1://卖出1次
      //     if(profitPercentage > 50) sellAmount = holding.balance * 1 //卖出50%
      //     break;
      //   case 2://卖出2次
      //     if(profitPercentage > 100) sellAmount = holding.balance * 1 //卖出50%
      //     break;
      //   case 3://卖出3次
      //     if(profitPercentage > 120) sellAmount = holding.balance * 1 //卖出50%
      //     break;    
      //   default:
      //     break;
      // }
      if (sellAmount > 0) {
        log.info(`准备卖出 ${holding.symbol}，盈亏百分比: ${profitPercentage.toFixed(2)}%，卖出数量: ${sellAmount.toFixed(0)}`);
        const symbol = holding.symbol;
        const address = holding.token_address
        const decimals = holding.decimals;
        // 检查余额是否足够
        const {uiAmount} = await getSolanaTokenBalance(walletAddress,address);
        if(uiAmount <= 0) {
          log.info(`${symbol} ${address} 余额不足,不执行卖出`);
          continue;
        }
        const tradeData = {
          swapMode: 'ExactOut',//TOKEN->SOL
          inputToken: address,//TOKEN
          outputToken: process.env.SOL_ADDRESS,//SOL
          amount: (sellAmount * Math.pow(10, decimals)).toFixed(0) * 1,
          slippage: process.env.SOL_SLIPPAGE,
          fee: process.env.SOL_PRIORITY_FEE
        };
        try {
          // 更新数据库中的交易记录
          const tokenInfo = await selectData('token_info', { token_address: address });
          if (tokenInfo.length > 0) {
            const tokenId = tokenInfo[0].id;
            const tradeRecords = await selectData('trade_records', { token_id: tokenId,status:'PENDING' });
            //交易记录中有未完成的记录，当前周期不进行交易
            if(tradeRecords.length > 0) {
              log.info(`代币 ${symbol} 存在待完成的订单，本次不执行交易`);
              continue; 
            }
            //执行交易
            const tradeResult = await executeSolanaTrade(tradeData);
            log.info(`已为代币 ${symbol} 执行卖出，结果:`, tradeResult);
            if(!tradeResult.data.hash) {
              log.info(`交易失败，交易结果:`, tradeResult);
              continue;
            }
            //查询是否有存在待完成的交易
            await insertData('trade_records', {
              token_id: tokenId,
              hash: tradeResult.data.hash,
              last_valid_block_height: tradeResult.data.lastValidBlockHeight,
              wallet_address: process.env.SOL_WALLET_ADDRESS,
              side: 'SELL',
              in_token: tradeData.inputToken,
              out_token: tradeData.outputToken,
              in_token_decimals: 9,
              out_token_decimals: 9,
              in_token_amount: tradeData.amount,
              out_token_amount: 0,
              status: 'PENDING',
              priority_fee: process.env.SOL_PRIORITY_FEE,
              price: 0,
              gas_fee: 0
            });
            // 5. 推送消息
            sendTgMessage({
              sniperAddress: process.env.SOL_WALLET_ADDRESS,
              tokenAddress: address,
              memo:`卖出操作，当前盈亏百分比: ${profitPercentage.toFixed(2)}%，卖出数量: ${sellAmount.toFixed(0)}${symbol}`
            });
          }else{
            await insertData('token_info', {
              chain: 'sol',
              token_address: address,
              symbol: symbol,
            });
          }
        } catch (tradeError) {
          log.error(`为代币 ${holding.symbol} 执行卖出失败:`, tradeError);
        }
      }
    }
  } catch (error) {
    log.error('检查并执行卖出操作失败:', error);
  } finally{
    log.info('checkAndExecuteSell finally');
    //删除流程锁
    await redisManager.del(lockKey);
  }
}



/**
 * 检查待处理交易的状态
 */
async function checkPendingTransactions() {
  const lockKey = 'check_pending_lock';
  const lockSet = await redisManager.setTimeLock(lockKey, 20);//流程20秒
  if (!lockSet) {
    log.info('checkPendingTransactions 锁已存在，操作被阻止');
    return;
  } 
  try {
    const pendingTransactions = await selectData('trade_records', { status: 'PENDING' });

    for (const transaction of pendingTransactions) {
      const status = await getTransactionStatus(transaction.hash, transaction.last_valid_block_height);

      if (status === 'success') {
        // 交易已确认，更新状态为 COMPLETED
        await updateData('trade_records', { status: 'COMPLETED' }, { id: transaction.id });
        log.info(`Transaction ${transaction.hash} completed`);
      } else if (status === 'failed') {
        // 交易失败或过期，更新状态为 FAILED
        await updateData('trade_records', { status: 'FAILED' }, { id: transaction.id });
        log.info(`Transaction ${transaction.hash} failed`);
        //交易失败,删除缓存时间锁(买单才删除)
        if(transaction.out_token != 'So11111111111111111111111111111111111111112'){
          await redisManager.del(transaction.out_token);
        }
      }
      // 如果 status 不是 success 或 failed，保持 PENDING 状态
    }
  } catch (error) {
    log.error('Error checking pending transactions:', error);
  } finally{
    log.info('checkPendingTransactions finally')
    //删除流程锁
    await redisManager.del(lockKey);
  }
  
}

/**
 * 清理旧数据的定时任务
 */
async function cleanupOldData() {
  // 设置清理数据的天数
  const CLEANUP_DAYS = 2; // 2天
  try {
    const result = await deleteOldData(CLEANUP_DAYS);
    log.info(`清理完成: 删除了 ${result.deletedTokens} 个${CLEANUP_DAYS}天前的旧token和 ${result.deletedTradeRecords} 条相关交易记录`);
  } catch (error) {
    log.error('清理旧数据时出错:', error);
  }
}

/**
 * 运行交易机器人
 * 这个函数是机器人的主循环，每分钟执行一次
 */
async function runTradingBot() {
  try {
    log.info('启动 GMGN.ai 交易机器人...');
    await initDatabase(); // 初始化数据库
    // meme交易定时任务
    setInterval(checkAndExecuteBuy, 1000 * 3); // 每10秒运行一次
    setInterval(checkAndExecuteSell, 1000 * 5); // 每10秒检查一次
    setInterval(checkPendingTransactions, 1000 * 10); // 每10秒检查一次待处理交易
    setInterval(cleanupOldData, 1000 * 60 * 10); // 每10分钟运行一次清理任务
    //监控定时任务
    setInterval(monitorDaosFun, 1000 * 10); // 每10秒运行一次任务
    setInterval(monitorTipTag, 1000 * 10); // 每10秒运行一次任务
    
  } catch (error) {
    log.error('定时任务运行失败:', error);
  }
}

runTradingBot();
