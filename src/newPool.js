/**
 * 新币打新
 */
import { insertData, selectData, updateData, deleteOldData } from '../utils/db.js';
import redisManager from '../utils/redisManager.js';
import log from '../utils/log.js';

import {
  getNewPoolList
} from '../api/apiService.js';

import { sendTgMessage,sendTgCustomMessage } from '../utils/messagePush.js';

async function checkNewPoolAndExecuteBuy(){

}

