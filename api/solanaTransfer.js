import { 
    Connection, 
    PublicKey, 
    Transaction, 
    sendAndConfirmTransaction,
    Keypair,
    ComputeBudgetProgram
  } from '@solana/web3.js';
  import {
    TOKEN_PROGRAM_ID,
    createTransferInstruction,
    getOrCreateAssociatedTokenAccount,
    getAssociatedTokenAddress
  } from '@solana/spl-token';
  import bs58 from 'bs58';
  import log from '../utils/log.js';
  
  /**
   * 转账 SPL Token
   * @param {string} recipientAddress - 接收地址
   * @param {string} tokenMintAddress - Token Mint 地址
   * @param {number} amount - 转账数量
   * @param {number} decimals - Token 精度
   * @param {number} [priorityFee=0] - 优先费用（以 SOL 为单位）
   * @returns {Promise<string>} - 交易哈希
   */
  async function transferSPLToken(recipientAddress, tokenMintAddress, amount, decimals, priorityFee = 0) {
    try {
      // 连接到 Solana 网络
      const connection = new Connection(process.env.SOLANA_RPC_URL, 'confirmed');
      
      // 创建钱包实例
      const wallet = Keypair.fromSecretKey(bs58.decode(process.env.SOL_PRIVATE_KEY));
      
      // 创建 PublicKey 实例
      const mintPublicKey = new PublicKey(tokenMintAddress);
      const recipientPublicKey = new PublicKey(recipientAddress);
  
      // 获取或创建发送方的关联账户
      const senderTokenAccount = await getOrCreateAssociatedTokenAccount(
        connection,
        wallet,
        mintPublicKey,
        wallet.publicKey
      );
  
      // 获取或创建接收方的关联账户
      const recipientTokenAccount = await getOrCreateAssociatedTokenAccount(
        connection,
        wallet,
        mintPublicKey,
        recipientPublicKey
      );
  
      // 创建交易
      const transaction = new Transaction();
  
      // 如果设置了优先费用，添加优先费用指令
      if (priorityFee > 0) {
        const microLamports = Math.floor(priorityFee * 1e9); // 转换为 lamports
        const priorityFeeInstruction = ComputeBudgetProgram.setComputeUnitPrice({
          microLamports: microLamports
        });
        transaction.add(priorityFeeInstruction);
      }
  
      // 创建转账指令
      const transferInstruction = createTransferInstruction(
        senderTokenAccount.address,
        recipientTokenAccount.address,
        wallet.publicKey,
        amount * Math.pow(10, decimals),
        [],
        TOKEN_PROGRAM_ID
      );
  
      // 添加转账指令
      transaction.add(transferInstruction);
      
      // 获取最新的 blockhash
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = wallet.publicKey;
  
      // 签名并发送交易
      const signature = await sendAndConfirmTransaction(
        connection,
        transaction,
        [wallet]
      );
  
      log.info(`SPL Token 转账成功，交易哈希: https://solscan.io/tx/${signature}`);
      return {
        hash: signature,
        lastValidBlockHeight
      };
    } catch (error) {
      log.error('SPL Token 转账失败:', error);
      throw error;
    }
  }
  
  /**
   * 检查 SPL Token 账户是否存在
   * @param {string} walletAddress - 钱包地址
   * @param {string} tokenMintAddress - Token Mint 地址
   * @returns {Promise<boolean>} - 账户是否存在
   */
  async function checkSPLTokenAccount(walletAddress, tokenMintAddress) {
    try {
      const connection = new Connection(process.env.SOLANA_RPC_URL, 'confirmed');
      const walletPublicKey = new PublicKey(walletAddress);
      const mintPublicKey = new PublicKey(tokenMintAddress);
  
      const associatedTokenAddress = await getAssociatedTokenAddress(
        mintPublicKey,
        walletPublicKey
      );
  
      const tokenAccount = await connection.getAccountInfo(associatedTokenAddress);
      return tokenAccount !== null;
    } catch (error) {
      log.error('检查 SPL Token 账户失败:', error);
      return false;
    }
  }
  
  export {
    transferSPLToken,
    checkSPLTokenAccount
  };