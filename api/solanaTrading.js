import { Wallet } from '@project-serum/anchor';
import { Connection, Keypair, VersionedTransaction, LAMPORTS_PER_SOL } from '@solana/web3.js';
import bs58 from 'bs58';
import { sendRequest } from '../utils/httpUtils.js';
import dotenv from 'dotenv';

dotenv.config();

const API_HOST = process.env.GMGN_API_URL;

async function executeSolanaSwap(inputToken, outputToken, amount, slippage, swapMode, fee) {
  try {
    // 钱包初始化
    const wallet = new Wallet(Keypair.fromSecretKey(bs58.decode(process.env.SOL_PRIVATE_KEY)));
    console.log(`wallet address: ${wallet.publicKey.toString()}`);
    const fromAddress = wallet.publicKey.toString()

    // 获取quote以及待签名交易
    const quoteUrl = `${API_HOST}/defi/router/v1/sol/tx/get_swap_route?token_in_address=${inputToken}&token_out_address=${outputToken}&in_amount=${amount}&from_address=${fromAddress}&slippage=${slippage}&swap_mode=${swapMode}&fee=${fee}`;
    const route = await sendRequest(quoteUrl, { method: 'get' });
    console.log('Route:', quoteUrl, route);

    // 签名交易
    const swapTransactionBuf = Buffer.from(route.data.raw_tx.swapTransaction, 'base64');
    const transaction = VersionedTransaction.deserialize(swapTransactionBuf);
    transaction.sign([wallet.payer]);
    const signedTx = Buffer.from(transaction.serialize()).toString('base64');
    console.log('Signed transaction:', signedTx);

    // 提交交易
    const res = await sendRequest(`${API_HOST}/defi/router/v1/sol/tx/submit_signed_transaction`, {
      method: 'post',
      data: { signed_tx: signedTx },
      headers: {'Content-Type': 'application/json'}
    });
    console.log('Submit transaction response:', res);
    res.data.lastValidBlockHeight = route.data.raw_tx.lastValidBlockHeight;
    return res;
  } catch (error) {
    console.error('Error executing Solana swap:', error);
    throw error;
  }
}

export { executeSolanaSwap};