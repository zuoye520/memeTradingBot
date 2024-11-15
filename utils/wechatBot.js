import { WechatyBuilder } from 'wechaty';
import log from './log.js';

class WechatBot {
  constructor() {
    this.bot = null;
    this.ready = false;
    this.receivers = process.env.WECHAT_RECEIVERS 
      ? process.env.WECHAT_RECEIVERS.split(',')
      : ['Azz'];
  }

  async initialize() {
    if (this.bot) {
      return;
    }

    this.bot = WechatyBuilder.build();

    this.bot
      .on('scan', (qrcode, status) => {
        const qrcodeImageUrl = `https://wechaty.js.org/qrcode/${encodeURIComponent(qrcode)}`;
        log.info(`Scan QR Code to login: ${status}\n${qrcodeImageUrl}`);
      })
      .on('login', async (user) => {
        log.info(`User ${user} logged in`);
        this.ready = true;
      })
      .on('logout', () => {
        log.info('Bot logged out');
        this.ready = false;
      })
      .on('error', (error) => {
        log.error('Bot error:', error);
      })
      .on('message',(message)=>{
        log.info('Bot Message:', message);
        this.sendMessage('标题','测试内容')
      });

    try {
      await this.bot.start();
      log.info('Bot started successfully');
    } catch (error) {
      log.error('Failed to start bot:', error);
      throw error;
    }
  }

  async sendMessage(title, content) {
    if (!this.ready) {
      log.warn('Bot is not ready. Try to initialize...');
      await this.initialize();
    }

    if (!this.ready) {
      throw new Error('Bot is still not ready after initialization');
    }

    const message = `${title}\n\n${content}`;

    for (const receiver of this.receivers) {
      try {
        // 支持发送到联系人或群聊
        const contact = await this.bot.Contact.find({ name: receiver }) ||
                       await this.bot.Room.find({ topic: receiver });
                       
        if (contact) {
          await contact.say(message);
          log.info(`Message sent to ${receiver} successfully`);
          const urlMessage = {
            description: 'Wechaty is a Bot SDK for Wechat Individual Account which can help you create a bot in 6 lines of javascript, with cross-platform support including Linux, Windows, Darwin(OSX/Mac) and Docker.',
            thumbnailUrl: 'https://camo.githubusercontent.com/f310a2097d4aa79d6db2962fa42bb3bb2f6d43df/68747470733a2f2f6368617469652e696f2f776563686174792f696d616765732f776563686174792d6c6f676f2d656e2e706e67',
            title: 'Wechaty',
            url: 'https://github.com/wechaty/wechaty',
          };
          await contact.say(await this.bot.UrlLink.create(urlMessage));
          log.info(`Message sent to ${receiver} successfully`);
        } else {
          log.warn(`Receiver not found: ${receiver}`);
        }
      } catch (error) {
        log.error(`Failed to send message to ${receiver}:`, error);
      }
    }
  }

  async stop() {
    if (this.bot) {
      await this.bot.stop();
      this.bot = null;
      this.ready = false;
      log.info('Bot stopped');
    }
  }
}

// 单例模式
const wechatBot = new WechatBot();
export default wechatBot;