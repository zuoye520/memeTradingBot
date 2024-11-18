import { WechatyBuilder } from 'wechaty';
import log from './log.js';
import moment from 'moment';

class WechatBot {
  constructor() {
    this.bot = null;
    this.ready = false;
    this.receivers = process.env.WECHAT_RECEIVERS
      ? process.env.WECHAT_RECEIVERS.split(',')
      : [''];
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
      .on('message', (message) => {
        log.info('Bot Message:', message);
      });

    try {
      await this.bot.start();
      log.info('Bot started successfully');
    } catch (error) {
      log.error('Failed to start bot:', error);
      throw error;
    }
  }

  async sendMessage(params = {}) {
    if (!this.ready) {
      log.error('Bot is not ready. Try to initialize...');
      await this.initialize();
    }
    if (!this.ready) {
      throw new Error('Bot is still not ready after initialization');
    }
    const { type = 'Admin', message, inlineKeyboard = [] } = params;

    const time = moment().format("YYYY/MM/DD HH:mm:ss");

    let urls = ``
    inlineKeyboard.map((item)=>{
      urls += `\n${item[0].text}：${item[0].url}`
    })
    let text = `${message}${urls}\n播报时间: ${time}`;
    let receiver = this.receivers[0];
    if(type == 'Group') receiver = this.receivers[1];
    try {
      // 支持发送到联系人或群聊
      const contact = await this.bot.Contact.find({ name: receiver }) ||
        await this.bot.Room.find({ topic: receiver });
      if (contact) {
        const MAX_RETRIES = 3;
        let attempts = 0;
        while (attempts < MAX_RETRIES) {
          try {
            await contact.say(text);
            log.info(`Message sent to ${receiver} successfully`);
            attempts = MAX_RETRIES;
          } catch (error) {
            log.error(`Message sent to ${receiver} error`, error);
            attempts++;
          }
        }
      } else {
        log.error(`Receiver not found: ${receiver}`);
      }
    } catch (error) {
      log.error(`Failed to send message to ${receiver}:`, error);
    }
    return;
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