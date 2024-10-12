import { spawn } from 'child_process';
import readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

rl.question('请输入解密密码: ', (password) => {
  rl.close();

  const child = spawn('node', ['index.js'], {
    stdio: 'inherit',
    env: { ...process.env, DECRYPT_PASSWORD: password }
  });

  child.on('close', (code) => {
    console.log(`子进程退出，退出码 ${code}`);
  });
});