import dotenv from 'dotenv';
import { insertData, selectData, updateData } from './db.js';
import { initDatabase } from './dbInit.js';
import {
  getSolanaBalance,
  getPopularList,
  getWalletHoldings,
  executeSolanaTrade,
  getTransactionStatus
} from './apiService.js';
import { sendTgMessage } from './messagePush.js';
import { decryptPrivateKey } from './keyManager.js';

dotenv.config();

// 在程序开始时解密私钥
process.env.SOL_PRIVATE_KEY = decryptPrivateKey();

//执行周期状态
let checkAndExecuteBuyStatus = true,
  checkAndExecuteSellStatus = true,
  checkPendingTransactionsStatus = true;

/**
 * 检查并执行买入操作
 */
async function checkAndExecuteBuy() {
  if (checkAndExecuteBuyStatus === false) return;
  checkAndExecuteBuyStatus = false;
  try {
    // 检查 SOL 余额
    const solBalance = await getSolanaBalance(process.env.SOL_WALLET_ADDRESS);
    const requiredBalance = parseFloat(process.env.SOL_TRADE_AMOUNT) + parseFloat(process.env.SOL_PRIORITY_FEE);
    console.log(`SOL 当前余额: ${solBalance} SOL`);
    if (solBalance < requiredBalance * 2) {
      console.log(`SOL 余额不足。当前余额: ${solBalance} SOL, 需要: ${requiredBalance} SOL`);
      checkAndExecuteBuyStatus = true;
      return;
    }
    // 1. 获取热门token列表
    const popularTokens = await getPopularList({ 
      time: '1m', 
      limit: 20,
      max_marketcap : 500000,//市值小于50万
      min_holder_count : 300,//持仓地址大于500
      min_created :'12h'//创建时间大于72小时24*3
    });
    // console.log('热门代币:', popularTokens);
    for (const token of popularTokens) {
      //排除CTO未接管，1m/5m/1h 跌幅太多的标的
      const condition = token.cto_flag === 0 || token.price_change_percent1m <= -5 || token.price_change_percent5m <= -10 || token.price_change_percent1h <= -30;
      if(condition){
        console.log(`代币 ${token.address} 未接管，1m/5m/1h 跌幅太大，跳过`);
        continue;
      }
      // 2. 查询数据库是否存在该token信息
      const tokenInfo = await selectData('token_info', { token_address: token.address, chain: token.chain });
      if (tokenInfo.length <= 0) {
        // 3. 不存在则插入
        const tokenId = await insertData('token_info', {
          chain: token.chain,
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
          fee: process.env.SOL_PRIORITY_FEE
        };
        try {
          const tradeResult = await executeSolanaTrade(tradeData);

          console.log(`已为代币 ${token.symbol} 执行交易，结果:`, tradeResult);
          if(!tradeResult.data.hash) {
            console.log(`交易失败，交易结果:`, tradeResult);
            continue;
          }
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
          console.error(`为代币 ${token.symbol} 执行交易失败:`, tradeError);
        }
        // 5. 推送消息
        sendTgMessage({
          sniperAddress: process.env.SOL_WALLET_ADDRESS,
          tokenAddress: token.address,
          memo:`买入操作，买入数量: ${process.env.SOL_TRADE_AMOUNT}SOL`
        });
      } else {
        console.log(`代币 ${token.address} 在 token_info 表中，跳过`);
      }
    }
  } catch (error) {
    console.error('交易机器人周期出错:', error);
  }
  checkAndExecuteBuyStatus = true;
}

/**
 * 检查并执行卖出操作
 */
async function checkAndExecuteSell() {
  if (checkAndExecuteSellStatus === false) return;
  checkAndExecuteSellStatus = false;
  try {
    const walletAddress = process.env.SOL_WALLET_ADDRESS;
    const holdings = await getWalletHoldings(walletAddress);

    for (const holding of holdings) {
      if(holding.is_show_alert) {
        console.log(`${holding.symbol}，流动性不足，无法进行交易，跳过`);
        continue;
      }
      let sellAmount = 0;//卖出数量
      const profitPercentage = holding.unrealized_pnl * 100;//利润百分比 100%
      console.log(`${holding.symbol}，当前盈亏百分比: ${profitPercentage.toFixed(2)}%`)
      if(profitPercentage > 50) sellAmount = holding.balance * 0.9;//卖出 90%
      // switch (holding.sells) {
      //   case 0://未卖出
      //     if(profitPercentage > 100) sellAmount = holding.balance / 2 //卖出50%
      //     break;
      //   case 1://卖出1次
      //     if(profitPercentage > 200) sellAmount = holding.balance / 2 //卖出50%
      //     break;
      //   case 2://卖出2次
      //     if(profitPercentage > 500) sellAmount = holding.balance / 2 //卖出50%
      //     break;
      //   case 3://卖出3次
      //     if(profitPercentage > 1000) sellAmount = holding.balance / 2 //卖出50%
      //     break;    
      //   default:
      //     break;
      // }
      if (sellAmount > 0) {
        console.log(`准备卖出 ${holding.symbol}，盈亏百分比: ${profitPercentage.toFixed(2)}%，卖出数量: ${sellAmount.toFixed(0)}`);
        const symbol = holding.symbol;
        const address = holding.token_address
        const decimals = holding.decimals;
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
              console.log(`代币 ${symbol} 存在待完成的订单，本次不执行交易`);
              continue; 
            }
            //执行交易
            const tradeResult = await executeSolanaTrade(tradeData);
            console.log(`已为代币 ${symbol} 执行卖出，结果:`, tradeResult);
            if(!tradeResult.data.hash) {
              console.log(`交易失败，交易结果:`, tradeResult);
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
          console.error(`为代币 ${holding.symbol} 执行卖出失败:`, tradeError);
        }
      }
    }
  } catch (error) {
    console.error('检查并执行卖出操作失败:', error);
  }
  checkAndExecuteSellStatus = true;
}

/**
 * 检查待处理交易的状态
 */
async function checkPendingTransactions() {
  if (checkPendingTransactionsStatus === false) return;
  checkPendingTransactionsStatus = false;
  try {
    const pendingTransactions = await selectData('trade_records', { status: 'PENDING' });

    for (const transaction of pendingTransactions) {
      const status = await getTransactionStatus(transaction.hash, transaction.last_valid_block_height);

      if (status === 'success') {
        // 交易已确认，更新状态为 COMPLETED
        await updateData('trade_records', { status: 'COMPLETED' }, { id: transaction.id });
        console.log(`Transaction ${transaction.hash} completed`);
      } else if (status === 'failed') {
        // 交易失败或过期，更新状态为 FAILED
        await updateData('trade_records', { status: 'FAILED' }, { id: transaction.id });
        console.log(`Transaction ${transaction.hash} failed`);
      }
      // 如果 status 不是 success 或 failed，保持 PENDING 状态
    }
  } catch (error) {
    console.error('Error checking pending transactions:', error);
  }
  checkPendingTransactionsStatus = true;
}



/**
 * 运行交易机器人
 * 这个函数是机器人的主循环，每分钟执行一次
 */
async function runTradingBot() {
  console.log('启动 GMGN.ai 交易机器人...');
  await initDatabase(); // 初始化数据库
  
  setInterval(checkAndExecuteBuy, 1000 * 5); // 每10秒运行一次
  setInterval(checkAndExecuteSell, 1000 * 5); // 每10秒检查一次
  setInterval(checkPendingTransactions, 1000 * 10); // 每30秒检查一次待处理交易
}

runTradingBot();
