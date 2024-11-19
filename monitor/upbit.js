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
    //根据ID降序排列
    list.sort((a, b) => b.id - a.id);
    lastArticle = !lastArticle ? list[0] : lastArticle

    const {id,title,listed_at} = list[0]
    // const time1 = new Date(lastArticle.listed_at);
    // const time2 = new Date(listed_at);
    if(lastArticle.id < id){
      lastArticle = list[0]
      const time = moment(listed_at).format("YYYY/MM/DD HH:mm:ss");
      const link = `https://upbit.com/service_center/notice?id=${id}`;
      notify({
        type:'Group',
        message: `监控通知\n监控平台：Upbit(韩国站)\n公告标题：${title}\n公告类型：新币种上线\n公告时间：${time}`,
        inlineKeyboard:[
          [{ text: "🚀查看公告详情🚀", url: link }],
        ]
      })
      
    }
    // log.info(`Upbit 当前最新公告：`,lastArticle)

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