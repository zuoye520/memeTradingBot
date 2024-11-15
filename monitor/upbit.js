import log from '../utils/log.js';
import moment from 'moment';
import { notify } from '../utils/notify.js';
import {
  getUpbitArticleList
} from '../api/apiService.js';

let lastArticle = null;//缓存
async function monitorUpbit(){
  try {
    const list = await getUpbitArticleList()
    if(!lastArticle){
      lastArticle = list[0]
    }else{
      const {id,title,listed_at} = list[0]
      if(lastArticle.id != id){
        const time = moment(listed_at).format("YYYY/MM/DD HH:mm:ss");
        const link = `https://upbit.com/service_center/notice?id=${id}`;
        notify({
          type:'Group',
          message: `<strong>监控通知</strong>\n监控平台：Upbit(韩国站)\n公告标题：${title}\n公告时间：${time}`,
          inlineKeyboard:[
            [{ text: "🚀查看公告详情🚀", url: link }],
          ]
        })
      }else{
        // log.info(`Upbit 当前最新公告：`,list[0])
      }
      lastArticle = list[0]
    }

  } catch (error) {
    log.error('Upbit 监控出现异常:',error)
    notify({
      type:'Error',
      message: `Upbit 监控出现异常`,
      lockKey:'upbit_error_lock', 
      timer: 60*30 // 30分钟
    })
  } finally{
      log.info('Upbit 监控执行结束');
      return;
  }
  
}

export { monitorUpbit };