import { spawn } from 'child_process';
import readline from 'readline';
import pm2 from 'pm2';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

rl.question('请输入解密密码: ', (password) => {
  rl.close();

  pm2.connect((err) => {
    if (err) {
      console.error('无法连接到 PM2:', err);
      process.exit(1);
    }

    pm2.start({
      script: 'index.js',
      name: 'meme-trading-bot',
      env: {
        ...process.env,
        DECRYPT_PASSWORD: password
      },
      autorestart: true,
      watch: false,
      max_memory_restart: '1G'
    }, (err, apps) => {
      if (err) {
        console.error('启动 PM2 进程失败:', err);
        pm2.disconnect();
        return;
      }

      console.log('PM2 进程已启动');
      
      // 监听日志输出
      pm2.launchBus((err, bus) => {
        if (err) {
          console.error('无法监听 PM2 日志:', err);
          return;
        }
        
        bus.on('log:out', (packet) => {
          console.log('[App Log]', packet.data);
        });
        
        bus.on('log:err', (packet) => {
          console.error('[App Error]', packet.data);
        });
      });
    });
  });
});