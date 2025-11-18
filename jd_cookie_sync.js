/**
 * JD Cookie Sync to Qinglong
 * 自动抓取京东 Cookie 并同步到青龙面板
 */

const $ = new Env('JD Cookie Sync');

// ============= 配置管理 =============

/**
 * 从持久化存储读取配置
 */
function getConfig() {
    const config = {
        qlUrl: $persistentStore.read('ql_url'),
        clientId: $persistentStore.read('ql_client_id'),
        clientSecret: $persistentStore.read('ql_client_secret'),
        updateInterval: parseInt($persistentStore.read('ql_update_interval') || '1800') // 默认30分钟
    };
    
    return config;
}

/**
 * 检查配置是否完整
 */
function checkConfig(config) {
    if (!config.qlUrl || !config.clientId || !config.clientSecret) {
        return {
            valid: false,
            message: '⚠️ 配置不完整\n\n请设置以下持久化数据：\n- ql_url: 青龙面板地址\n- ql_client_id: Client ID\n- ql_client_secret: Client Secret'
        };
    }
    
    // 验证 URL 格式
    if (!config.qlUrl.startsWith('http://') && !config.qlUrl.startsWith('https://')) {
        return {
            valid: false,
            message: '⚠️ 青龙面板地址格式错误\n\n需要以 http:// 或 https:// 开头'
        };
    }
    
    // 移除 URL 末尾的斜杠
    if (config.qlUrl.endsWith('/')) {
        config.qlUrl = config.qlUrl.slice(0, -1);
    }
    
    return { valid: true };
}

// ============= Cookie 提取与验证 =============

/**
 * 从请求头提取并验证 Cookie
 */
function extractCookie(headers) {
    const cookieHeader = headers['Cookie'] || headers['cookie'];
    
    if (!cookieHeader) {
        return { valid: false, message: 'Cookie header not found' };
    }
    
    // 提取 pt_key 和 pt_pin
    const ptKeyMatch = cookieHeader.match(/pt_key=([^;]+)/);
    const ptPinMatch = cookieHeader.match(/pt_pin=([^;]+)/);
    
    if (!ptKeyMatch || !ptPinMatch) {
        return { valid: false, message: 'pt_key or pt_pin not found in cookie' };
    }
    
    const ptKey = ptKeyMatch[1];
    const ptPin = decodeURIComponent(ptPinMatch[1]);
    
    // 验证格式
    if (!ptKey || !ptPin || ptKey.length < 10) {
        return { valid: false, message: 'Invalid cookie format' };
    }
    
    const jdCookie = `pt_key=${ptKey};pt_pin=${ptPin};`;
    
    return {
        valid: true,
        cookie: jdCookie,
        ptKey: ptKey,
        ptPin: ptPin
    };
}

/**
 * 检查是否需要更新（基于缓存和时间间隔）
 */
function shouldUpdate(ptPin, config) {
    const cacheKey = `jd_cookie_cache_${ptPin}`;
    const lastUpdateKey = `jd_cookie_last_update_${ptPin}`;
    
    const cachedCookie = $persistentStore.read(cacheKey);
    const lastUpdate = parseInt($persistentStore.read(lastUpdateKey) || '0');
    const now = Date.now();
    
    // 检查更新间隔（默认30分钟）
    const interval = config.updateInterval * 1000;
    if (now - lastUpdate < interval) {
        $.log(`⏰ 距离上次更新未满 ${config.updateInterval} 秒，跳过更新`);
        return { should: false, reason: 'interval' };
    }
    
    return { should: true };
}

/**
 * 更新缓存
 */
function updateCache(ptPin, cookie) {
    const cacheKey = `jd_cookie_cache_${ptPin}`;
    const lastUpdateKey = `jd_cookie_last_update_${ptPin}`;
    
    $persistentStore.write(cookie, cacheKey);
    $persistentStore.write(String(Date.now()), lastUpdateKey);
}

// ============= 青龙 API 调用 =============

/**
 * 获取青龙 Token
 */
async function getQinglongToken(config) {
    const url = `${config.qlUrl}/open/auth/token?client_id=${config.clientId}&client_secret=${config.clientSecret}`;
    
    try {
        const response = await $.http.get({
            url: url,
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        const body = JSON.parse(response.body);
        
        if (body.code === 200 && body.data && body.data.token) {
            $.log(`✅ 获取青龙 Token 成功`);
            return { success: true, token: body.data.token };
        } else {
            $.log(`❌ 获取青龙 Token 失败: ${body.message || 'Unknown error'}`);
            return { success: false, message: body.message || 'Failed to get token' };
        }
    } catch (error) {
        $.log(`❌ 获取青龙 Token 异常: ${error.message || error}`);
        return { success: false, message: error.message || String(error) };
    }
}

/**
 * 查询青龙环境变量列表
 */
async function getEnvList(config, token) {
    const url = `${config.qlUrl}/open/envs?searchValue=JD_COOKIE`;
    
    try {
        const response = await $.http.get({
            url: url,
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        const body = JSON.parse(response.body);
        
        if (body.code === 200 && body.data) {
            $.log(`✅ 查询环境变量成功，共 ${body.data.length} 条`);
            return { success: true, data: body.data };
        } else {
            $.log(`❌ 查询环境变量失败: ${body.message || 'Unknown error'}`);
            return { success: false, message: body.message || 'Failed to get env list' };
        }
    } catch (error) {
        $.log(`❌ 查询环境变量异常: ${error.message || error}`);
        return { success: false, message: error.message || String(error) };
    }
}

/**
 * 更新青龙环境变量（通过 PUT 请求）
 * 由于 Surge 不支持 PUT，改用先删除再添加的方式
 */
async function updateEnv(config, token, envId, name, value, remarks) {
    // 方法1：先删除再添加
    $.log(`🔄 更新环境变量: ${name} (ID: ${envId})`);
    
    // 删除旧的环境变量
    const deleteResult = await deleteEnv(config, token, envId);
    if (!deleteResult.success) {
        $.log(`⚠️ 删除旧环境变量失败，尝试直接添加`);
    }
    
    // 添加新的环境变量
    const addResult = await addEnv(config, token, name, value, remarks);
    return addResult;
}

/**
 * 删除青龙环境变量
 */
async function deleteEnv(config, token, envId) {
    const url = `${config.qlUrl}/open/envs`;
    
    try {
        const response = await $.http.post({
            url: url,
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'X-HTTP-Method-Override': 'DELETE'
            },
            body: JSON.stringify([envId])
        });
        
        const body = JSON.parse(response.body);
        
        if (body.code === 200) {
            $.log(`✅ 删除环境变量成功`);
            return { success: true };
        } else {
            $.log(`⚠️ 删除环境变量失败: ${body.message || 'Unknown error'}`);
            return { success: false, message: body.message || 'Failed to delete env' };
        }
    } catch (error) {
        $.log(`⚠️ 删除环境变量异常: ${error.message || error}`);
        return { success: false, message: error.message || String(error) };
    }
}

/**
 * 新增青龙环境变量
 */
async function addEnv(config, token, name, value, remarks) {
    const url = `${config.qlUrl}/open/envs`;
    
    const data = [{
        name: name,
        value: value,
        remarks: remarks || `Added by Surge at ${new Date().toLocaleString()}`
    }];
    
    try {
        const response = await $.http.post({
            url: url,
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });
        
        const body = JSON.parse(response.body);
        
        if (body.code === 200) {
            $.log(`✅ 新增环境变量成功: ${name}`);
            return { success: true };
        } else {
            $.log(`❌ 新增环境变量失败: ${body.message || 'Unknown error'}`);
            return { success: false, message: body.message || 'Failed to add env' };
        }
    } catch (error) {
        $.log(`❌ 新增环境变量异常: ${error.message || error}`);
        return { success: false, message: error.message || String(error) };
    }
}

/**
 * 同步 Cookie 到青龙
 */
async function syncToQinglong(cookie, ptPin) {
    const config = getConfig();
    
    // 检查配置
    const configCheck = checkConfig(config);
    if (!configCheck.valid) {
        $.notify('JD Cookie Sync', '配置错误', configCheck.message);
        return;
    }
    
    // 检查是否需要更新
    const updateCheck = shouldUpdate(ptPin, config);
    if (!updateCheck.should) {
        $.log(`⏭️ 跳过更新，原因: ${updateCheck.reason}`);
        return;
    }
    
    // 获取 Token
    const tokenResult = await getQinglongToken(config);
    if (!tokenResult.success) {
        $.notify('JD Cookie Sync', '获取 Token 失败', tokenResult.message);
        return;
    }
    
    const token = tokenResult.token;
    
    // 查询现有环境变量
    const envListResult = await getEnvList(config, token);
    if (!envListResult.success) {
        $.notify('JD Cookie Sync', '查询环境变量失败', envListResult.message);
        return;
    }
    
    const envList = envListResult.data;
    
    // 查找是否已存在该账号的 Cookie
    const existingEnv = envList.find(env => {
        if (env.name.startsWith('JD_COOKIE') && env.value) {
            const match = env.value.match(/pt_pin=([^;]+)/);
            if (match) {
                const envPtPin = decodeURIComponent(match[1]);
                return envPtPin === ptPin;
            }
        }
        return false;
    });
    
    let result;
    if (existingEnv) {
        // 更新现有环境变量
        $.log(`📝 找到现有账号 ${ptPin}，更新环境变量 ${existingEnv.name}`);
        result = await updateEnv(config, token, existingEnv.id, existingEnv.name, cookie, existingEnv.remarks);
    } else {
        // 新增环境变量，查找可用的变量名
        let envName = 'JD_COOKIE';
        const usedNames = envList.map(env => env.name);
        
        if (usedNames.includes('JD_COOKIE')) {
            let index = 2;
            while (usedNames.includes(`JD_COOKIE_${index}`)) {
                index++;
            }
            envName = `JD_COOKIE_${index}`;
        }
        
        $.log(`➕ 新增账号 ${ptPin}，创建环境变量 ${envName}`);
        result = await addEnv(config, token, envName, cookie, `Account: ${ptPin}`);
    }
    
    if (result.success) {
        // 更新缓存
        updateCache(ptPin, cookie);
        
        $.notify('JD Cookie Sync', '✅ 同步成功', `账号: ${ptPin}\n已同步到青龙面板`);
    } else {
        $.notify('JD Cookie Sync', '❌ 同步失败', result.message);
    }
}

// ============= 主函数 =============

(async () => {
    try {
        const headers = $request.headers;
        
        // 提取并验证 Cookie
        const cookieResult = extractCookie(headers);
        
        if (!cookieResult.valid) {
            $.log(`⚠️ Cookie 提取失败: ${cookieResult.message}`);
            $done({});
            return;
        }
        
        $.log(`✅ 成功提取 Cookie，账号: ${cookieResult.ptPin}`);
        
        // 同步到青龙
        await syncToQinglong(cookieResult.cookie, cookieResult.ptPin);
        
    } catch (error) {
        $.log(`❌ 脚本执行异常: ${error.message || error}`);
        $.notify('JD Cookie Sync', '脚本执行异常', String(error));
    } finally {
        $done({});
    }
})();

// ============= Surge 环境适配 =============

function Env(name) {
    this.name = name;
    this.logs = [];
    
    this.log = function(message) {
        console.log(`[${this.name}] ${message}`);
        this.logs.push(message);
    };
    
    this.notify = function(title, subtitle, message) {
        console.log(`[Notification] ${title}\n${subtitle}\n${message}`);
        $notification.post(title, subtitle, message);
    };
    
    this.http = {
        get: function(options) {
            return new Promise((resolve, reject) => {
                $httpClient.get(options, (error, response, body) => {
                    if (error) {
                        reject(error);
                    } else {
                        response.body = body;
                        resolve(response);
                    }
                });
            });
        },
        post: function(options) {
            return new Promise((resolve, reject) => {
                $httpClient.post(options, (error, response, body) => {
                    if (error) {
                        reject(error);
                    } else {
                        response.body = body;
                        resolve(response);
                    }
                });
            });
        }
    };
    
    return this;
}

