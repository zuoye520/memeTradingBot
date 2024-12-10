import log from '../utils/log.js';
import moment from 'moment';
import { notify } from '../utils/notify.js';
import {
  getBinanceArticleList
} from '../api/apiService.js';

let lastArticle = null;//缓存

function getArticleLink(title, code) {
  const removeChars = /[()（）]/g;
  const sanitizedTitle = title
    .replace(removeChars, '')
    .replace(/[ ，、]/g, '-');
  return `https://www.binance.com/zh-CN/support/announcement/${sanitizedTitle}-${code}`;
}
async function monitorBinance(){
  try {
    const articleList = await getBinanceArticleList()
    return;
    const found = articleList.find(element => element.catalogId === 48);//catalogId:48 为上线新币或者Launchpool
    const list = found.articles;
    // log.info('list:',list)
    //根据ID排序
    list.sort((a, b) => b.id - a.id);
    lastArticle = !lastArticle ? list[0] : lastArticle
    const {id,title,code,releaseDate} = list[0]

    if(lastArticle.id < id){
      lastArticle = list[0]
      const time = moment(releaseDate).format("YYYY/MM/DD HH:mm:ss");
      const link = getArticleLink(title,code);
      notify({
        type:'Group',
        message: `监控通知\n监控平台：Binance\n公告标题：${title}\n公告类型：新币种上线\n公告时间：${time}`,
        inlineKeyboard:[
          [{ text: "🚀查看公告详情🚀", url: link }],
        ]
      })
    }
    // log.info(`Binance 当前最新公告：`,lastArticle)

  } catch (error) {
    log.error('Binance 监控出现异常:',error)
    notify({
      type:'Error',
      message: `Binance 监控出现异常`,
      lockKey:'binance_error_lock', 
      timer: 60*30 // 30分钟
    })
  } finally{
    log.info('Binance 监控执行结束');
    return;
  }
  
}

export { monitorBinance };