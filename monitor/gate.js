import log from '../utils/log.js';
import moment from 'moment';
import { notify } from '../utils/notify.js';

import WebSocket from 'ws';

let lastArticle = null;//缓存
let ws;
let heartbeatInterval;
let heartbeatTimeout;
const heartbeatTimeoutDuration = 60000;  // 心跳超时时间，60秒后认为连接已断开
const heartbeatMessage = JSON.stringify({ event: 'ping' });  // 假设服务器支持心跳 ping 消息

// 初始化 WebSocket 连接
function initWebSocket() {
    ws = new WebSocket('wss://api.gateio.ws/ws/v4/ann');

    ws.on('open', () => {
        log.info('Gate WebSocket连接已建立');
        // 启动心跳检测
        startHeartbeat();

        // 根据文档，发送订阅消息以接收公告数据（如果需要）
        const subscribeMessage = {
            time: +new Date(), // 请求时间戳
            channel: "announcement.summary_listing", // 频道名称
            event: "subscribe", // 订阅操作
            "payload": ["cn"]  // 公告的语言
        };
        ws.send(JSON.stringify(subscribeMessage));
    });

    ws.on('message', (message) => {
        // log.info('Gate 接收到消息:', message);
        const { event, result } = JSON.parse(message);
        
        // 重置心跳计时器
        resetHeartbeat();

        if (event !== 'update') return;
        msNotify(result);
    });

    ws.on('close', (code, reason) => {
        log.info(`Gate WebSocket连接关闭，代码: ${code}, 原因: ${reason}`);
        stopHeartbeat();  // 停止心跳检测
        reconnectWebSocket();
    });

    ws.on('error', (error) => {
        log.error('Gate WebSocket错误:', error);
        stopHeartbeat();  // 停止心跳检测
        reconnectWebSocket();
    });
}

// 断开重连逻辑
function reconnectWebSocket() {
    log.info('Gate WS 正在尝试重连...');
    setTimeout(() => {
        initWebSocket();
    }, 3000); // 重连间隔为3秒
}

// 开始心跳检测
function startHeartbeat() {
    // 每30秒发送一次心跳消息
    heartbeatInterval = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(heartbeatMessage); // 发送心跳消息
            log.info('Gate 发送心跳消息');
        }
    }, 30000);  // 每30秒发送一次心跳

    // 设置心跳超时，如果超过60秒没有收到任何消息，就认为连接断开
    heartbeatTimeout = setTimeout(() => {
        log.error('Gate WebSocket连接超时，没有收到心跳响应');
        ws.close(); // 关闭连接并触发重连逻辑
    }, heartbeatTimeoutDuration);
}

// 重置心跳定时器
function resetHeartbeat() {
    clearTimeout(heartbeatTimeout);  // 清除之前的超时
    clearInterval(heartbeatInterval); // 清除之前的定时器
    startHeartbeat();  // 重新开始心跳检测
}

// 停止心跳检测
function stopHeartbeat() {
    clearInterval(heartbeatInterval);
    clearTimeout(heartbeatTimeout);
}

function msNotify(data){
  try {
    if(!lastArticle){
      lastArticle = data
    }else{
      const {title,origin_url:url,published_at:pTime} = data
      console.log('data:',data)
      if(lastArticle.origin_url != url){
        const time = moment(pTime*1000).format("YYYY/MM/DD HH:mm:ss");
        notify({
          type:'Admin',//Group
          message: `监控通知\n监控平台：Gate\n公告标题：${title}\n公告类型：新币种上线\n推送时间：${time}`,
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