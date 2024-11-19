import log from '../utils/log.js';
import crypto from 'crypto';
import moment from 'moment';
import { notify } from '../utils/notify.js';
import { sendRequest } from '../utils/httpUtils.js';



let lastArticle = null;//缓存
class API {
	constructor(options) {
		this.api_key = options.api_key || '';
		this.secret = options.secret || '';
		this.passphrase = options.passphrase || '';
		this.server = options.server || "https://www.okx.com";
		this.timeout = options.timeout || 10000;
	}
	signMessage(timestamp, method, requestPath, params) {

		let paramStr = `${timestamp}${method}${requestPath}${params && JSON.stringify(params)}`
		// console.log('signMessage===>',paramStr)
		paramStr = crypto.createHmac('sha256', this.secret).update(paramStr).digest().toString('base64');
    // console.log('paramStr===>',paramStr)
		return paramStr;
	}
	/**
	 * 返回 signHeaders
	 */
	signHeaders(method, requestPath, params = '') {
		const timestamp = new Date().toISOString()
		const sign = {
			"content-type": "application/json",
			'OK-ACCESS-KEY': this.api_key,
			'OK-ACCESS-SIGN': this.signMessage(timestamp, method, requestPath, params),
			'OK-ACCESS-TIMESTAMP': timestamp,
			'OK-ACCESS-PASSPHRASE': this.passphrase
		}
		return sign
	}
  /**
   * 公告
   * @returns 
   */
  async getOkxArticleList() {
    const data = {
      // 'annType':'announcements-new-listings'
    }
		const requestPath = `/api/v5/support/announcements?annType=announcements-new-listings`
    const url = this.server + requestPath;
    log.info('url:',url)
    const headers = {...this.signHeaders('GET', requestPath,data),...{'Accept-Language':'zh-CN'}}
    const response = await sendRequest(url, { 
      headers: headers,
      method: 'get',
      data:data
    });
    if(response.code !=='0') throw response
		return response.data[0].details;
	}
}

async function monitorOkx(){
  try {
    const GWAPI = new API({//只读
    api_key:process.env.OKX_API_KEY,
    secret:process.env.OKX_API_SECRET,
    passphrase:process.env.OKX_API_PASSPHRASE,
    // server: 'http://103.153.101.112:1123'
  });
    const list = await GWAPI.getOkxArticleList()
    // log.info('list:',list)
    lastArticle = !lastArticle ? list[0] : lastArticle
    const {title,url,pTime} = list[0]
    if(lastArticle.url != url && lastArticle.pTime < pTime){
      lastArticle = list[0]
      const time = moment(pTime*1).format("YYYY/MM/DD HH:mm:ss");
      notify({
        type:'Group',
        message: `监控通知\n监控平台：OKX\n公告标题：${title}\n公告类型：新币种上线\n公告时间：${time}`,
        inlineKeyboard:[
          [{ text: "🚀查看公告详情🚀", url: url }],
        ]
      })
    }
    // log.info(`OKX 当前最新公告：`,lastArticle)

  } catch (error) {
    log.error('OKX 监控出现异常:',error)
    notify({
      type:'Error',
      message: `OKX 监控出现异常`,
      lockKey:'okx_error_lock', 
      timer: 60*30 // 30分钟
    })
  } finally{
    log.info('OKX 监控执行结束');
    return;
  }
  
}

export { monitorOkx };