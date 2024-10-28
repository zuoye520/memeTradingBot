import log from '../utils/log.js';
import { sendTgCustomMessage } from '../utils/messagePush.js';
import {
  getDaosFunList
} from '../api/apiService.js';

let daosCount = 0;
async function monitorDaosFun(){
  try {
    const list = await getDaosFunList()
    if( daosCount === 0){
      daosCount = list[1].result.data.length
    }else{
      if(daosCount !== list[1].result.data.length){
        sendTgCustomMessage({
          message: `<strong>监控通知</strong>\n监控平台：DAOS.FUN\n描述：疑是有新基金发布\n当前基金数量：${list[1].result.data.length}`
        })
      }else{
        log.info(`DAOS FUN 当前基金数量：${list[1].result.data.length}`)
      }
      daosCount = list[1].result.data.length

    }
  } catch (error) {
    log.error('DAOSFUN 监控出现异常:',error)
    sendTgCustomMessage({
      message: `DAOSFUN 监控出现异常`
    })
  }
  
}

export { monitorDaosFun };