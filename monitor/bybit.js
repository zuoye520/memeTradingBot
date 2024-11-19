import log from '../utils/log.js';
import moment from 'moment';
import { notify } from '../utils/notify.js';
import {
  getBybitArticleList
} from '../api/apiService.js';

let lastArticle = null;//缓存
async function monitorBybit(){
  try {
    const list = await getBybitArticleList()
    lastArticle = !lastArticle ? list[0] : lastArticle

    const {title,url,dateTimestamp:cTime} = list[0]
    if(lastArticle.dateTimestamp < cTime){
      lastArticle = list[0]
      const time = moment(cTime).format("YYYY/MM/DD HH:mm:ss");
      notify({
        type:'Group',
        message: `监控通知\n监控平台：Bybit\n公告标题：${title}\n公告类型：新币种上线\n公告时间：${time}`,
        inlineKeyboard:[
          [{ text: "🚀查看公告详情🚀", url: url }],
        ]
      })
      
    }
    // log.info(`Bybit 当前最新公告：`,lastArticle)

  } catch (error) {
    log.error('Bybit 监控出现异常:',error)
    notify({
      type:'Error',
      message: `Bybit 监控出现异常`,
      lockKey:'bybit_error_lock', 
      timer: 60*30 // 30分钟
    })
  } finally{
      log.info('Bybit 监控执行结束');
      return;
  }
  
}

export { monitorBybit };