/**
 * memeTradingBot
 * 专注于SOLANA网络meme交易
 */
import schedule from 'node-schedule';
import dotenv from 'dotenv';
import { insertData, selectData, updateData, deleteOldData } from './utils/db.js';
import redisManager from './utils/redisManager.js';
import { initDatabase } from './utils/dbInit.js';
import log from './utils/log.js';
import {sleep} from './utils/utils.js';
import wechatBot from './utils/wechatBot.js';

import {
  transferSPLToken,
  getSolanaBalance,
  getWalletInfo,
  getSolanaTokenBalance,
  getPopularList,
  getWalletHoldings,
  executeSolanaTrade,
  executeRaydiumSwap,
  getTransactionStatus
} from './api/apiService.js';

import { notify } from './utils/notify.js';
import { decryptPrivateKey } from './utils/keyManager.js';
//监控
import { monitorDaosFun } from './monitor/daosfun.js';
import { monitorTipTag } from './monitor/tiptag.js';
import { monitorBinance } from './monitor/binance.js';
import { monitorUpbit } from './monitor/upbit.js';
import { monitorOkx } from './monitor/okx.js';
import { monitorGate } from './monitor/gate.js';
import { monitorMexc } from './monitor/mexc.js';
import { monitorBybit } from './monitor/bybit.js';
import { monitorBitget } from './monitor/bitget.js';
dotenv.config();

// 在程序开始时解密私钥
process.env.SOL_PRIVATE_KEY = decryptPrivateKey();
/**
 * 检查并执行买入操作
 */
async function checkAndExecuteBuy() {
  try {
    // 检查 SOL 余额
    // const solBalance = await getSolanaBalance(process.env.SOL_WALLET_ADDRESS);
    const {sol_balance:solBalance} = await getWalletInfo(process.env.SOL_WALLET_ADDRESS);
    // const requiredBalance = parseFloat(process.env.SOL_TRADE_AMOUNT) + parseFloat(process.env.SOL_PRIORITY_FEE);
    const solMinBalance = process.env.SOL_MIN_BALANCE || 0
    log.info(`SOL 当前余额: ${solBalance} SOL,账户最小余额为:${solMinBalance} SOL`,solBalance*1 <= solMinBalance*1);
    if (solBalance*1 <= solMinBalance*1) {
      log.info(`SOL 余额不足。当前余额: ${solBalance} SOL, 需要: ${solMinBalance} SOL`);
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
          amount:process.env.DEFAUT_SWAP =='GMGN' ? process.env.SOL_TRADE_AMOUNT * 1e9 : process.env.SOL_TRADE_AMOUNT * 1,//SOL 精度 9
          slippage: process.env.SOL_SLIPPAGE,
          fee: process.env.SOL_PRIORITY_FEE
        };
        try {
          const tradeResult =process.env.DEFAUT_SWAP =='GMGN' ? await executeSolanaTrade(tradeData) :await executeRaydiumSwap(tradeData);

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
          notify({
            type:'Error',
            message: `监控通知\n描述：执行交易失败,${token.symbol}\nWallet Address：${process.env.SOL_WALLET_ADDRESS}\nTOKEN地址：${token.address}\n错误信息：${tradeError}`
          })
        }
        // 6. 推送消息
        notify({
          type:'Admin',
          message: `监控通知\n描述：💰执行买入💰\nWallet Address：${process.env.SOL_WALLET_ADDRESS}\nSymbol：${token.symbol}\nToken Address：${token.address}\n买入数量：${process.env.SOL_TRADE_AMOUNT} SOL`,
          inlineKeyboard:[
            [{ text: "行情K线", url: `https://gmgn.ai/sol/token/${token.address}` }],
            [{ text: "交易记录", url: `https://gmgn.ai/sol/address/${process.env.SOL_WALLET_ADDRESS}` }]
          ]
        });
      } else {
        log.info(`代币${token.symbol}，${token.address} 在 token_info 表中，跳过`);
      }
    }
  } catch (error) {
    log.error('交易机器人周期出错:', error);
  } finally{
    log.info('checkAndExecuteBuy finally');
    return;
  }
  
}

/**
 * 检查并执行卖出操作
 */
async function checkAndExecuteSell() {
  
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
      if(profitPercentage > 30 && holding.usd_value > 1) sellAmount = holding.balance * 1;//卖出 100%
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
          amount: process.env.DEFAUT_SWAP =='GMGN' ? (sellAmount * Math.pow(10, decimals)).toFixed(0) * 1 : sellAmount*1,
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
            const tradeResult = process.env.DEFAUT_SWAP =='GMGN' ? await executeSolanaTrade(tradeData) :await executeRaydiumSwap(tradeData);
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
            notify({
              type:'Admin',
              message: `监控通知\n描述：🎉执行卖出🎉\nWallet Address：${process.env.SOL_WALLET_ADDRESS}\nSymbol：${symbol}\nToken Address：${address}\n卖出数量：${sellAmount.toFixed(0)} ${symbol}\n收益率：${profitPercentage.toFixed(2)}%`,
              inlineKeyboard:[
                [{ text: "行情K线", url: `https://gmgn.ai/sol/token/${address}` }],
                [{ text: "交易记录", url: `https://gmgn.ai/sol/address/${process.env.SOL_WALLET_ADDRESS}` }]
              ]
            });
          }else{
            await insertData('token_info', {
              chain: 'sol',
              token_address: address,
              symbol: symbol,
            });
          }
        } catch (tradeError) {
          log.error(`为代币 ${symbol} 执行卖出失败:`, tradeError);
          if(JSON.stringify(tradeError).indexOf('amounts must greater than zero') < 0){
            notify({
              type:'Error',
              message: `监控通知\n描述：执行交易失败,${symbol}\nWallet Address：${process.env.SOL_WALLET_ADDRESS}\nTOKEN地址：${address}\n错误信息：${tradeError}`
            })
          }
        }
      }
    }
  } catch (error) {
    log.error('检查并执行卖出操作失败:', error);
  } finally{
    log.info('checkAndExecuteSell finally');
    return;
  }
}



/**
 * 检查待处理交易的状态
 */
async function checkPendingTransactions() {
  try {
    const pendingTransactions = await selectData('trade_records', { status: 'PENDING' });

    for (const transaction of pendingTransactions) {
      const status = await getTransactionStatus(transaction.hash, transaction.last_valid_block_height);

      if (status === 'success') {
        // 交易已确认，更新状态为 COMPLETED
        await updateData('trade_records', { status: 'COMPLETED' }, { id: transaction.id });
        log.info(`Transaction ${transaction.hash} completed`);
        // 买入操作时, 转账spl token 10%到领一个账户
        if(transaction.out_token != process.env.SOL_ADDRESS){
          executeTransferSPLToken(transaction.out_token)
        }
      } else if (status === 'failed') {
        // 交易失败或过期，更新状态为 FAILED
        await updateData('trade_records', { status: 'FAILED' }, { id: transaction.id });
        log.info(`Transaction ${transaction.hash} failed`);
        //交易失败,删除缓存时间锁(买单才删除)
        if(transaction.out_token != process.env.SOL_ADDRESS){
          await redisManager.del(transaction.out_token);
        }
      }
      // 如果 status 不是 success 或 failed，保持 PENDING 状态
    }
  } catch (error) {
    log.error('Error checking pending transactions:', error);
  } finally{
    log.info('checkPendingTransactions finally')
    return;
  }
  
}
/**
 * 转账，转账失败重试3次
 * @param {*} tokenMintAddress 
 * @returns 
 */
async function executeTransferSPLToken(tokenMintAddress) {
  const MAX_RETRIES = 3;
  let attempts = 0;
  while (attempts < MAX_RETRIES) {
    try {
      //获取spl token 余额及精度
      const walletAddress = process.env.SOL_WALLET_ADDRESS
      const {decimals,uiAmount} = await getSolanaTokenBalance(walletAddress,tokenMintAddress);
      //执行转账
      const recipientAddress = process.env.SPL_WALLET_ADDRESS;
      const amount = (uiAmount * 0.1).toFixed(0) * 1;//转账10%
      await transferSPLToken(recipientAddress, tokenMintAddress, amount, decimals);
      attempts = MAX_RETRIES;
      notify({
        message: `监控通知\n描述：转账成功\nWallet Address：${process.env.SOL_WALLET_ADDRESS}\nTOKEN地址：${tokenMintAddress}`
      })
    } catch (error) {
      attempts++;
      // 5. 推送消息
      notify({
        message: `监控通知\n描述：转账失败\nWallet Address：${process.env.SOL_WALLET_ADDRESS}\nTOKEN地址：${tokenMintAddress}\n错误信息：${error}`
      })
      await sleep(3);
    }
  }
  return attempts;
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
async function runBot() {
  log.info('启动 GMGN.ai 交易机器人...');
  await initDatabase(); // 初始化数据库
  // if(process.env.WECHAT_NOTIFY === 'ON') await wechatBot.initialize();// 初始化微信Bot

  // meme交易定时任务
  schedule.scheduleJob('checkAndExecuteBuy-task', `*/3 * * * * *`, async () => {
    const lockKey = 'check_buy_lock';
    const lockSet = await redisManager.setTimeLock(lockKey, 10);//流程10秒
    if (!lockSet) {
      log.info('checkAndExecuteBuy 锁已存在，操作被阻止');
      return;
    } 
    try {
      console.time("checkAndExecuteBuy executionTime");
      await checkAndExecuteBuy();
      console.timeEnd("checkAndExecuteBuy executionTime");
    } catch (error) {
      log.error('checkAndExecuteBuy task error:', error);
    } finally{
      //删除流程锁
      await redisManager.del(lockKey);
    }
  });
  schedule.scheduleJob('checkAndExecuteSell-task', `*/5 * * * * *`, async () => {
    const lockKey = 'check_sell_lock';
    const lockSet = await redisManager.setTimeLock(lockKey, 10);//流程10秒
    if (!lockSet) {
      log.info('checkAndExecuteSell 锁已存在，操作被阻止');
      return;
    } 
    try {
      console.time("checkAndExecuteSell executionTime");
      await checkAndExecuteSell();
      console.timeEnd("checkAndExecuteSell executionTime");
    } catch (error) {
      log.error('checkAndExecuteSell task error:', error);
    } finally{
      //删除流程锁
      await redisManager.del(lockKey);
    }
  });
  schedule.scheduleJob('checkPendingTransactions-task', `*/10 * * * * *`, async () => {
    const lockKey = 'check_pending_lock';
    const lockSet = await redisManager.setTimeLock(lockKey, 30);//流程10秒
    if (!lockSet) {
      log.info('checkPendingTransactions 锁已存在，操作被阻止');
      return;
    }
    try {
      console.time("checkPendingTransactions executionTime");
      await checkPendingTransactions();
      console.timeEnd("checkPendingTransactions executionTime");
    } catch (error) {
      log.error('checkPendingTransactions task error:', error);
    } finally{
      //删除流程锁
      await redisManager.del(lockKey);
      
    }
  });
  //每10分钟执行一次
  schedule.scheduleJob('cleanupOldData-task', `*/10 * * * *`, async () => {
    try {
      await cleanupOldData();
    } catch (error) {
      log.error('cleanupOldData task error:', error);
    }
  });
  //===========================================================================
  // monitorDaosFun监控任务,每X秒执行一次
  schedule.scheduleJob('monitorDaosFun-task', `*/10 * * * * *`, async () => {
    try {
      await monitorDaosFun();
    } catch (error) {
      log.error('monitorDaosFun task error:', error);
    }
  });
  // tipTag监控任务,每X秒执行一次
  schedule.scheduleJob('monitorTipTag-task', `*/10 * * * * *`, async () => {
    try {
      await monitorTipTag();
    } catch (error) {
      log.error('monitorTipTag task error:', error);
    }
  });
  // Binance监控任务,每X秒执行一次
  // schedule.scheduleJob('monitorBinance-task', `*/10 * * * * *`, async () => {
  //   const lockKey = 'monitorBinance_lock';
  //   const lockSet = await redisManager.setTimeLock(lockKey, 20);//流程10秒
  //   if (!lockSet) {
  //     log.info('monitorBinance-task 锁已存在，操作被阻止');
  //     return;
  //   } 
  //   try {
  //     await monitorBinance();
  //   } catch (error) {
  //     log.error('monitorBinance task error:', error);
  //   } finally{
  //     await redisManager.del(lockKey);
  //   }
  // });
  // Upbit监控任务,每X秒执行一次
  schedule.scheduleJob('monitorUpbit-task', `*/10 * * * * *`, async () => {
    try {
      await monitorUpbit();
    } catch (error) {
      log.error('monitorUpbit task error:', error);
    }
  });
  // OKX监控任务,每X秒执行一次
  schedule.scheduleJob('monitorOkx-task', `*/3 * * * * *`, async () => {
    const lockKey = 'monitorOkx_lock';
    const lockSet = await redisManager.setTimeLock(lockKey, 10);//流程10秒
    if (!lockSet) {
      log.info('monitorOkx-task 锁已存在，操作被阻止');
      return;
    } 
    try {
      await monitorOkx();
    } catch (error) {
      log.error('monitorOkx task error:', error);
    } finally{
      await redisManager.del(lockKey);
    }
  });
  // Gate监控任务,执行一次
  monitorGate()

  // Mexc监控任务,每X秒执行一次
  schedule.scheduleJob('monitorMexc-task', `*/5 * * * * *`, async () => {
    const lockKey = 'monitorMexc_lock';
    const lockSet = await redisManager.setTimeLock(lockKey, 10);//流程10秒
    if (!lockSet) {
      log.info('monitorMexc-task 锁已存在，操作被阻止');
      return;
    }
    try {
      await monitorMexc();
    } catch (error) {
      log.error('monitorMexc task error:', error);
    } finally{
      await redisManager.del(lockKey);
    }
  });
  // Bybit监控任务,每X秒执行一次
  schedule.scheduleJob('monitorBybit-task', `*/5 * * * * *`, async () => {
    const lockKey = 'monitorBybit_lock';
    const lockSet = await redisManager.setTimeLock(lockKey, 10);//流程10秒
    if (!lockSet) {
      log.info('monitorBybit-task 锁已存在，操作被阻止');
      return;
    }
    try {
      await monitorBybit();
    } catch (error) {
      log.error('monitorBybit task error:', error);
    } finally{
      await redisManager.del(lockKey);
    }
  });
  // Bitget监控任务,每X秒执行一次
  schedule.scheduleJob('monitorBitget-task', `*/5 * * * * *`, async () => {
    const lockKey = 'monitorBitget_lock';
    const lockSet = await redisManager.setTimeLock(lockKey, 10);//流程10秒
    if (!lockSet) {
      log.info('monitorBitget-task 锁已存在，操作被阻止');
      return;
    }
    try {
      await monitorBitget();
    } catch (error) {
      log.error('monitorBitget task error:', error);
    } finally{
      await redisManager.del(lockKey);
    }
  });

}

runBot();
