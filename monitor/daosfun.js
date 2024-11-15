import log from '../utils/log.js';
import { sendTgCustomMessage } from '../utils/messagePush.js';
import {
  getDaosFunList
} from '../api/apiService.js';

let daos = null;
async function monitorDaosFun(){
  try {
    const list = await getDaosFunList()
    if(!daos){
      daos = list[1].result.data.daos[0].dao_mint
    }else{
      if(daos !== list[1].result.data.daos[0].dao_mint){
        sendTgCustomMessage({
          type:'Group',
          message: `<strong>监控通知</strong>\n监控平台：DAOS.FUN\n描述：疑是有新基金发布\n最新基金DAO地址：${list[1].result.data.daos[0].dao_mint}`
        })
      }else{
        log.info(`DAOS FUN 当前最新基金DAO地址：${list[1].result.data.daos[0].dao_mint}`)
      }
      daos = list[1].result.data.daos[0].dao_mint
    }
  } catch (error) {
    log.error('DAOSFUN 监控出现异常:',error)
    sendTgCustomMessage({
      type:'Error',
      message: `DAOSFUN 监控出现异常`,
      lockKey:'daos_fun_error_lock', 
      timer: 60*30 // 30分钟
    })
  }
  
}

export { monitorDaosFun };