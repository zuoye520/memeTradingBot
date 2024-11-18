import log from '../utils/log.js';
import { notify } from '../utils/notify.js';
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
    log.info('results:',results)
    if(!newsProject){
      newsProject = results
    }else{
      results.map((list,index)=>{
        if(list.length <=0) return;
        const chain = index === 0 ? 'base' : index === 1 ? 'eth' : 'enuls'
        let link = `https://tiptag.social/tag-detail/`
        if(chain == 'enuls'){
          link = `https://enuls.tiptag.social/tag-detail/`
        }else if(chain == 'eth'){
          link = `https://eth.tiptag.social/tag-detail/`
        }
        if(newsProject[index][0].token !== list[0].token){
          link
          notify({
            type:'Group',
            message: `监控通知\n监控平台：TipTag\n监控网络：${chain}\n描述：疑是有新项目发布\n项目名称：${list[0].name}\n创建人地址：${list[0].creator}`,
            inlineKeyboard:[
              [{ text: "🚀查看项目详情🚀", url: link+list[0].name}],
            ]
          })
        }else{
          log.info(`TipTag ${chain}网络,最新项目信息：${list[0].name}`)
        }
      })
      newsProject = results

    }
  } catch (error) {
    log.error('TipTag 监控出现异常:',error)
    notify({
      type:'Error',
      message: `TipTag 监控出现异常`,
      lockKey:'tiptag_error_lock', 
      timer: 60*30 // 30分钟
    })
  }
  
}

export { monitorTipTag };