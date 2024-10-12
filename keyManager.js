import CryptoJS from 'crypto-js';
import fs from 'fs';
import readlineSync from 'readline-sync';
import dotenv from 'dotenv';

dotenv.config();

export function encryptPrivateKey() {
  const privateKey = readlineSync.question('请输入你的 Solana 私钥: ', {
    hideEchoBack: true
  });

  if (!privateKey) {
    console.error('私钥不能为空');
    process.exit(1);
  }

  const password = readlineSync.question('请输入加密密码: ', {
    hideEchoBack: true
  });

  const confirmPassword = readlineSync.question('请再次输入加密密码: ', {
    hideEchoBack: true
  });

  if (password !== confirmPassword) {
    console.error('两次输入的密码不匹配');
    process.exit(1);
  }

  const encryptedPrivateKey = CryptoJS.AES.encrypt(privateKey, password).toString();

  fs.writeFileSync('.encrypted_private_key', encryptedPrivateKey);

  console.log('私钥已加密并保存到 .encrypted_private_key 文件');
  console.log('请确保在 .env 文件中设置 ENCRYPTED_PRIVATE_KEY_FILE=.encrypted_private_key');
}

export function decryptPrivateKey() {
  const encryptedKeyFile = process.env.ENCRYPTED_PRIVATE_KEY_FILE;
  if (!encryptedKeyFile) {
    console.error('请在 .env 文件中设置 ENCRYPTED_PRIVATE_KEY_FILE');
    process.exit(1);
  }

  const encryptedPrivateKey = fs.readFileSync(encryptedKeyFile, 'utf8');
  const password = readlineSync.question('请输入解密密码: ', {
    hideEchoBack: true
  });

  try {
    const decryptedPrivateKey = CryptoJS.AES.decrypt(encryptedPrivateKey, password).toString(CryptoJS.enc.Utf8);
    if (!decryptedPrivateKey) {
      throw new Error('解密失败，请检查密码是否正确');
    }
    return decryptedPrivateKey;
  } catch (error) {
    console.error('解密私钥失败:', error.message);
    process.exit(1);
  }
}