import redisManager from './redisManager.js';
import wechatBot from './wechatBot.js';
import { sendTgCustomMessage } from './telegramBot.js';

// 支持的通知渠道配置
const notifyConfig = {
    TG_NOTIFY: process.env.TG_NOTIFY === 'ON',
    WECHAT_NOTIFY: process.env.WECHAT_NOTIFY === 'ON',
};

// 统一的通知函数
export async function notify(params = {}) {
    const { lockKey, timer } = params;
    //通知消息锁
    if (lockKey && timer) {
        const lockSet = await redisManager.setTimeLock(lockKey, timer);
        if (!lockSet) {
            console.log('锁已存在，发送消息被阻止');
            return;
        }
    }
    const notifications = [];

    // TG通知
    if (notifyConfig.TG_NOTIFY) {
        notifications.push(sendTgCustomMessage(params));
    }

    // 微信通知
    if (notifyConfig.WECHAT_NOTIFY) {
        notifications.push(wechatBot.sendMessage(params));
    }

    // 并行执行所有通知
    await Promise.all(notifications);
}