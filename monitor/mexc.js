import log from '../utils/log.js';
import moment from 'moment';
import { notify } from '../utils/notify.js';
import {
  getMexcArticleList
} from '../api/apiService.js';

let lastArticle = 1;//缓存

async function monitorMexc(){
  try {
    const list = await getMexcArticleList()
    if(!lastArticle){
      lastArticle = list[0]
    }else{
      const {id,title,updateTime:uTime} = list[0]
      if(lastArticle.id != id){
        const time = moment(uTime).format("YYYY/MM/DD HH:mm:ss");
        const url = `https://www.mexc.com/support/articles/${id}`;
        notify({
          type:'Group',
          message: `<strong>监控通知</strong>\n监控平台：Mexc\n公告标题：${title}\n公告类型：MEXC测试公告监控\n公告时间：${time}`,
          inlineKeyboard:[
            [{ text: "🚀查看公告详情🚀", url: url }],
          ]
        })
      }else{
        // log.info(`Mexc 当前最新公告：`,list[0])
      }
      lastArticle = list[0]
    }

  } catch (error) {
    log.error('Mexc 监控出现异常:',error)
    notify({
      type:'Error',
      message: `Mexc 监控出现异常`,
      lockKey:'mexc_error_lock', 
      timer: 60*30 // 30分钟
    })
  } finally{
    log.info('Mexc 监控执行结束');
    return;
  }
  
}

export { monitorMexc };