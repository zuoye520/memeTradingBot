import log from '../utils/log.js';
import { sendTgCustomMessage } from '../utils/messagePush.js';
import {
  getTipTagNewList
} from '../api/apiService.js';

let newsProject = null;
async function monitorTipTag(){
  try {
    const results = await Promise.all([
      getTipTagNewList('base'),
      getTipTagNewList('eth'),
      getTipTagNewList('enuls')
    ]);
    
    if(!newsProject){
      newsProject = results
    }else{
      results.map((list,index)=>{
        if(list.length <=0) return;
        const chain = index === 0 ? 'base' : index === 1 ? 'eth' : 'enuls'
        if(newsProject[index][0].token !== list[0].token){
          sendTgCustomMessage({
            message: `<strong>监控通知</strong>\n监控平台：TipTag\n监控网络：${chain}\n描述：疑是有新项目发布\n项目信息：${list[0].name}`
          })
        }else{
          log.info(`TipTag ${chain}网络,最新项目信息：${list[0].name}`)
        }
      })
      newsProject = results

    }
  } catch (error) {
    log.error('TipTag 监控出现异常:',error)
    sendTgCustomMessage({
      message: `TipTag 监控出现异常`
    })
  }
  
}

export { monitorTipTag };