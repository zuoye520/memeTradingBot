import log from '../utils/log.js';
import moment from 'moment';
import { notify } from '../utils/notify.js';
import {
  getBitgetArticleList
} from '../api/apiService.js';

let lastArticle = null;//缓存
async function monitorBitget(){
  try {
    const list = await getBitgetArticleList()
    //根据ID降序排列
    list.sort((a, b) => b.annId - a.annId);
    lastArticle = !lastArticle ? list[0] : lastArticle
    const {annId:id,annTitle:title,annUrl:url,cTime} = list[0]
    if(lastArticle.annId < id){
      lastArticle = list[0]
      const time = moment(cTime*1).format("YYYY/MM/DD HH:mm:ss");
      notify({
        type:'Group',
        message: `监控通知\n监控平台：Bitget\n公告标题：${title}\n公告类型：新币种上线\n公告时间：${time}`,
        inlineKeyboard:[
          [{ text: "🚀查看公告详情🚀", url: url }],
        ]
      })
      
    }
    // log.info(`Bitget 当前最新公告：`,lastArticle)

  } catch (error) {
    log.error('Bitget 监控出现异常:',error)
    notify({
      type:'Error',
      message: `Bitget 监控出现异常`,
      lockKey:'bitget_error_lock', 
      timer: 60*30 // 30分钟
    })
  } finally{
      log.info('Bitget 监控执行结束');
      return;
  }
  
}

export { monitorBitget };