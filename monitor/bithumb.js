import log from '../utils/log.js';
import moment from 'moment';
import { notify } from '../utils/notify.js';
import {
  getBithumbArticleList
} from '../api/apiService.js';

let lastArticle = null;//缓存
async function monitorBithumb(){
  try {
    const list = await getBithumbArticleList()
    //根据ID降序排列
    list.sort((a, b) => b.id - a.id);
    lastArticle = !lastArticle ? list[0] : lastArticle

    const {id,title,publicationDateTime:pTime} = list[0]
    if(lastArticle.id <= id){
      lastArticle = list[0]
      const time = moment(pTime).format("YYYY/MM/DD HH:mm:ss");
      const link = `https://feed.bithumb.com/notice/${id}`;
      notify({
        type:'Group',
        message: `监控通知\n监控平台：Bithumb\n公告标题：${title}\n公告类型：测试公告\n公告时间：${time}`,
        inlineKeyboard:[
          [{ text: "🚀查看公告详情🚀", url: link }],
        ]
      })
      
    }
    // log.info(`Bithumb 当前最新公告：`,lastArticle)

  } catch (error) {
    log.error('Bithumb 监控出现异常:',error)
    notify({
      type:'Error',
      message: `Bithumb 监控出现异常`,
      lockKey:'bithumb_error_lock', 
      timer: 60*30 // 30分钟
    })
  } finally{
      log.info('Bithumb 监控执行结束');
      return;
  }
  
}

export { monitorBithumb };