import { sendNotifys } from '../api/apiService.js';
import log from './log.js';
// import redisManager from './redisManager.js';
// import wechatBot from './wechatBot.js';
// import { sendTgCustomMessage } from './telegramBot.js';

// 支持的通知渠道配置
const notifyConfig = {
    TG_NOTIFY: process.env.TG_NOTIFY === 'ON',
    WECHAT_NOTIFY: process.env.WECHAT_NOTIFY === 'ON',
};

const wxNames = process.env.WECHAT_RECEIVERS ? process.env.WECHAT_RECEIVERS.split(',') : [''];
const chatIds = process.env.TG_CHAT_IDS ? process.env.TG_CHAT_IDS.split(',') : [];      

export async function notify(params = {}){
    try {
        const {type} = params
        let wxReceiver = [wxNames[0]],
            tgReceiver = [chatIds[0]];
        if(type == 'Group') {
            wxReceiver = [wxNames[1]];
            tgReceiver = chatIds;
        }
        const data = {...params,...{chatIds:tgReceiver,wxNames:wxReceiver}}
        // TG通知
        if (!notifyConfig.TG_NOTIFY) {
            data.chatIds = []
        }
        // 微信通知
        if (!notifyConfig.WECHAT_NOTIFY) {
            data.wxNames = []
        }
        const result = await sendNotifys(data);
        log.info('发送消息通知成功:',{params,result})
        return result;
    } catch (error) {
        log.error('发送消息通知失败:',{params,error})
        throw error;
    }
    
}
// 统一的通知函数
// export async function notify(params = {}) {
//     const { lockKey, timer } = params;
//     //通知消息锁
//     if (lockKey && timer) {
//         const lockSet = await redisManager.setTimeLock(lockKey, timer);
//         if (!lockSet) {
//             console.log('锁已存在，发送消息被阻止');
//             return;
//         }
//     }
//     const notifications = [];

//     // TG通知
//     if (notifyConfig.TG_NOTIFY) {
//         notifications.push(sendTgCustomMessage(params));
//     }

//     // 微信通知
//     if (notifyConfig.WECHAT_NOTIFY) {
//         notifications.push(wechatBot.sendMessage(params));
//     }

//     // 并行执行所有通知
//     await Promise.all(notifications);
// }