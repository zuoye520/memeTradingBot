import log from '../utils/log.js';
import moment from 'moment';
import { notify } from '../utils/notify.js';
import {
  getMexcArticleList
} from '../api/apiService.js';

let lastArticle = null;//缓存

async function monitorMexc(){
  try {
    const list = await getMexcArticleList()
    //根据ID降序排列
    list.sort((a, b) => b.id - a.id);
    lastArticle = !lastArticle ? list[0] : lastArticle
    const {id,title,updateTime:uTime} = list[0]
    if(lastArticle.id < id ){
      lastArticle = list[0]
      const time = moment(uTime).format("YYYY/MM/DD HH:mm:ss");
      const url = `https://www.mexc.com/support/articles/${id}`;
      notify({
        type:'Admin',//Group
        message: `监控通知\n监控平台：Mexc\n公告标题：${title}\n公告类型：新币种上线\n公告时间：${time}`,
        inlineKeyboard:[
          [{ text: "🚀查看公告详情🚀", url: url }],
        ]
      })
    }
    // log.info(`Mexc 当前最新公告：`,lastArticle)

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