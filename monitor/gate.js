import log from '../utils/log.js';
import moment from 'moment';
import { notify } from '../utils/notify.js';

import WebSocket from 'ws';

let lastArticle = null;//缓存
let ws;
// 初始化 WebSocket 连接
function initWebSocket() {
    ws = new WebSocket('wss://api.gateio.ws/ws/v4/ann');

    ws.on('open', () => {
        log.info('Gate WebSocket连接已建立');
        // 根据文档，发送订阅消息以接收公告数据（如果需要）
        const subscribeMessage = {
            time:+new Date,               // 请求时间戳
            channel: "announcement.summary_listing", // 频道名称
            event: "subscribe",           // 订阅操作
            "payload": ["cn"]             // 公告的语言
        };
        ws.send(JSON.stringify(subscribeMessage));
    });

    ws.on('message', (message) => {
        // log.info('Gate 接收到消息:', message);
        const {event,result} = JSON.parse(message)
        if(event != 'update') return;
        msNotify(result);
          
    });

    ws.on('close', (code, reason) => {
        log.info(`Gate WebSocket连接关闭，代码: ${code}, 原因: ${reason}`);
        reconnectWebSocket();
    });

    ws.on('error', (error) => {
        log.error('Gate WebSocket错误:', error);
        reconnectWebSocket();
    });
}

// 断开重连逻辑
function reconnectWebSocket() {
    log.info('Gate WS 正在尝试重连...');
    setTimeout(() => {
        initWebSocket();
    }, 5000); // 重连间隔为5秒
}

function msNotify(data){
  try {
    if(!lastArticle){
      lastArticle = data
    }else{
      const {title,origin_url:url,published_at:pTime} = data
      console.log('data:',data)
      if(lastArticle.url != url){
        const time = moment(pTime*1000).format("YYYY/MM/DD HH:mm:ss");
        notify({
          type:'Group',
          message: `<strong>监控通知</strong>\n监控平台：Gate\n公告标题：${title}\n公告类型：新币种上线\n推送时间：${time}`,
          inlineKeyboard:[
            [{ text: "🚀查看公告详情🚀", url: url }],
          ]
        })
      }else{
        // log.info(`Gate 当前最新公告：`,result)
      }
      lastArticle = data
    }
  } catch (error) {
    log.error('Gate 监控出现异常:',error)
    notify({
      type:'Error',
      message: `Gate 监控出现异常`,
      lockKey:'gate_error_lock', 
      timer: 60*30 // 30分钟
    })
  } finally{
    log.info('Gate 监控执行结束');
    return;
  }
  
}
async function monitorGate(){
  // 启动 WebSocket
  initWebSocket();
}

export { monitorGate };