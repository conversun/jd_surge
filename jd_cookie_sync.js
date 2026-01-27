/**
 * JD Cookie Sync to Qinglong
 * 自动抓取京东 Cookie 并同步到青龙面板
 */

const $ = new Env('JD Cookie Sync');

// ============= 常量定义 =============

const CONFIG_KEYS = {
    URL: 'ql_url',
    CLIENT_ID: 'ql_client_id',
    CLIENT_SECRET: 'ql_client_secret',
    UPDATE_INTERVAL: 'ql_update_interval',
    BYPASS_CHECK: 'jd_bypass_interval_check'
};

const DEFAULT_UPDATE_INTERVAL = 1800; // 默认30分钟

// ============= 配置管理 =============

/**
 * 从持久化存储读取配置
 */
function getConfig() {
    return {
        qlUrl: $.getval(CONFIG_KEYS.URL),
        clientId: $.getval(CONFIG_KEYS.CLIENT_ID),
        clientSecret: $.getval(CONFIG_KEYS.CLIENT_SECRET),
        updateInterval: parseInt($.getval(CONFIG_KEYS.UPDATE_INTERVAL) || String(DEFAULT_UPDATE_INTERVAL))
    };
}

/**
 * 检查配置是否完整
 */
function validateConfig(config) {
    if (!config.qlUrl || !config.clientId || !config.clientSecret) {
        return {
            valid: false,
            message: '⚠️ 配置不完整\n\n请设置以下持久化数据：\n- ql_url: 青龙面板地址\n- ql_client_id: Client ID\n- ql_client_secret: Client Secret'
        };
    }

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

    const ptKeyMatch = cookieHeader.match(/pt_key=([^;]+)/);
    const ptPinMatch = cookieHeader.match(/pt_pin=([^;]+)/);

    if (!ptKeyMatch || !ptPinMatch) {
        return { valid: false, message: 'pt_key or pt_pin not found in cookie' };
    }

    const ptKey = ptKeyMatch[1];
    const ptPin = decodeURIComponent(ptPinMatch[1]);

    if (!ptKey || !ptPin || ptKey.length < 10) {
        return { valid: false, message: 'Invalid cookie format' };
    }

    if (ptKey.startsWith('fake_') || ptPin.toLowerCase() === 'guest') {
        return { valid: false, message: 'Guest cookie detected, skipping sync' };
    }

    return {
        valid: true,
        cookie: `pt_key=${ptKey};pt_pin=${ptPin};`,
        ptKey,
        ptPin
    };
}

/**
 * 获取缓存键名
 */
function getCacheKeys(ptPin) {
    return {
        cookie: `jd_cookie_cache_${ptPin}`,
        lastUpdate: `jd_cookie_last_update_${ptPin}`
    };
}

/**
 * 检查是否需要更新（基于缓存和时间间隔）
 */
function shouldUpdate(ptPin, currentCookie, config) {
    const keys = getCacheKeys(ptPin);
    const cachedCookie = $.getval(keys.cookie);
    const lastUpdate = parseInt($.getval(keys.lastUpdate) || '0');
    const now = Date.now();

    // 检查绕过间隔的标志
    if ($.getval(CONFIG_KEYS.BYPASS_CHECK) === 'true') {
        $.log('🔄 检测到缓存清除标志，绕过时间间隔检查');
        return { should: true, reason: 'bypass' };
    }

    // Cookie 值变化时立即更新
    if (cachedCookie && cachedCookie !== currentCookie) {
        $.log('🔄 检测到 Cookie 值已变化，需要立即更新');
        return { should: true, reason: 'cookie_changed' };
    }

    // 检查更新间隔
    const intervalMs = config.updateInterval * 1000;
    if (now - lastUpdate < intervalMs) {
        $.log(`⏰ Cookie 未变化且距离上次更新未满 ${config.updateInterval} 秒，跳过更新`);
        return { should: false, reason: 'interval' };
    }

    return { should: true, reason: 'interval_expired' };
}

/**
 * 更新缓存
 */
function updateCache(ptPin, cookie) {
    const keys = getCacheKeys(ptPin);
    $.setval(cookie, keys.cookie);
    $.setval(String(Date.now()), keys.lastUpdate);
}

// ============= HTTP 请求封装 =============

/**
 * 发送 HTTP 请求
 */
function httpRequest(options) {
    const opts = typeof options === 'string' ? { url: options } : options;
    const method = (opts.method || ('body' in opts ? 'post' : 'get')).toLowerCase();
    const timeout = opts._timeout || 15000;

    if (method !== 'get') {
        opts.method = method.toUpperCase();
    }

    return Promise.race([
        createTimeoutPromise(timeout, opts.url),
        createRequestPromise(opts, method)
    ]);
}

function createTimeoutPromise(timeout, url) {
    return new Promise((_, reject) => {
        setTimeout(() => reject(new Error(`请求超时: ${url}`)), timeout);
    });
}

function createRequestPromise(opts, method) {
    return new Promise((resolve, reject) => {
        const methodFn = method === 'get' ? 'get' : 'post';
        $[methodFn](opts, (error, response, data) => {
            if (error) {
                reject(new Error(typeof error === 'string' ? error : JSON.stringify(error)));
                return;
            }
            if (!response) {
                reject(new Error('无响应'));
                return;
            }
            resolve(response);
        });
    });
}

// ============= 青龙 API 调用 =============

/**
 * 调用青龙 API 并处理响应
 */
async function callQinglongApi(config, token, endpoint, options = {}) {
    const url = `${config.qlUrl}${endpoint}`;
    const headers = {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    };

    const requestOptions = {
        url,
        headers,
        _respType: 'all',
        ...options
    };

    if (options.body) {
        requestOptions.body = JSON.stringify(options.body);
    }

    const response = await httpRequest(requestOptions);
    return JSON.parse(response.body);
}

/**
 * 获取青龙 Token
 */
async function getQinglongToken(config) {
    const endpoint = `/open/auth/token?client_id=${config.clientId}&client_secret=${config.clientSecret}`;

    try {
        const body = await callQinglongApi(config, null, endpoint);

        if (body.code === 200 && body.data?.token) {
            $.log('✅ 获取青龙 Token 成功');
            return { success: true, token: body.data.token };
        }

        $.log(`❌ 获取青龙 Token 失败: ${body.message || 'Unknown error'}`);
        return { success: false, message: body.message || 'Failed to get token' };
    } catch (error) {
        $.log(`❌ 获取青龙 Token 异常: ${error.message || error}`);
        return { success: false, message: error.message || String(error) };
    }
}

/**
 * 查询青龙环境变量列表
 */
async function getEnvList(config, token) {
    try {
        const body = await callQinglongApi(config, token, '/open/envs?searchValue=JD_COOKIE');

        if (body.code === 200 && body.data) {
            $.log(`✅ 查询环境变量成功，共 ${body.data.length} 条`);
            return { success: true, data: body.data };
        }

        $.log(`❌ 查询环境变量失败: ${body.message || 'Unknown error'}`);
        return { success: false, message: body.message || 'Failed to get env list' };
    } catch (error) {
        $.log(`❌ 查询环境变量异常: ${error.message || error}`);
        return { success: false, message: error.message || String(error) };
    }
}

/**
 * 删除青龙环境变量
 */
async function deleteEnv(config, token, envId) {
    const requestBody = [Number(envId)];
    $.log(`🔍 删除请求: ${JSON.stringify(requestBody)}`);

    try {
        const body = await callQinglongApi(config, token, '/open/envs', {
            method: 'DELETE',
            body: requestBody
        });

        $.log(`🔍 删除响应: ${JSON.stringify(body)}`);

        if (body.code === 200) {
            $.log('✅ 删除环境变量成功');
            return { success: true };
        }

        $.log(`⚠️ 删除环境变量失败: ${body.message || 'Unknown error'}`);
        return { success: false, message: body.message || 'Failed to delete env' };
    } catch (error) {
        $.log(`⚠️ 删除环境变量异常: ${error.message || error}`);
        return { success: false, message: error.message || String(error) };
    }
}

/**
 * 新增青龙环境变量
 */
async function addEnv(config, token, name, value, remarks) {
    const data = [{
        name,
        value,
        remarks: remarks || `Added by ${$.getEnv()} at ${new Date().toLocaleString()}`
    }];

    $.log(`🔍 新增请求: ${JSON.stringify(data)}`);

    try {
        const body = await callQinglongApi(config, token, '/open/envs', { body: data });

        $.log(`🔍 新增响应: ${JSON.stringify(body)}`);

        if (body.code === 200) {
            $.log(`✅ 新增环境变量成功: ${name}`);
            return { success: true };
        }

        // 检查重复值错误
        const isDuplicate = body.errors?.some(
            err => err.type === 'unique violation' && err.path === 'value'
        );

        if (isDuplicate) {
            $.log('ℹ️ 环境变量值已存在，无需更新');
            return { success: true, isDuplicate: true };
        }

        $.log(`❌ 新增环境变量失败: ${body.message || 'Unknown error'}`);
        return { success: false, message: body.message || 'Failed to add env' };
    } catch (error) {
        $.log(`❌ 新增环境变量异常: ${error.message || error}`);
        return { success: false, message: error.message || String(error) };
    }
}

// ============= 环境变量同步逻辑 =============

/**
 * 从环境变量中提取 pt_pin
 */
function extractPtPinFromEnv(env) {
    if (env.name !== 'JD_COOKIE' || !env.value) {
        return null;
    }
    const match = env.value.match(/pt_pin=([^;]+)/);
    return match ? decodeURIComponent(match[1]) : null;
}

/**
 * 查找匹配指定 ptPin 的环境变量
 */
function findMatchingEnvs(envList, ptPin) {
    return envList.filter(env => extractPtPinFromEnv(env) === ptPin);
}

/**
 * 获取环境变量 ID
 */
function getEnvId(env) {
    return env._id || env.id;
}

/**
 * 删除多个环境变量（排除指定 ID）
 */
async function deleteEnvsExcept(config, token, envs, excludeId) {
    for (const env of envs) {
        const envId = getEnvId(env);
        if (envId !== excludeId) {
            $.log(`🔍 删除重复环境变量: ID=${envId}`);
            const result = await deleteEnv(config, token, envId);
            $.log(result.success ? '✅ 已删除重复环境变量' : '⚠️ 删除重复环境变量失败');
        }
    }
}

/**
 * 删除所有环境变量
 */
async function deleteAllEnvs(config, token, envs) {
    let allSuccess = true;
    for (const env of envs) {
        const envId = getEnvId(env);
        $.log(`🔍 删除环境变量: ID=${envId}`);
        const result = await deleteEnv(config, token, envId);
        if (result.success) {
            $.log('✅ 已删除旧的环境变量');
        } else {
            $.log('⚠️ 删除旧的环境变量失败');
            allSuccess = false;
        }
    }
    return allSuccess;
}

/**
 * 处理已存在的环境变量
 */
async function handleExistingEnvs(config, token, existingEnvs, cookie, ptPin) {
    $.log(`📝 找到 ${existingEnvs.length} 个匹配账号 ${ptPin}`);

    const exactMatch = existingEnvs.find(env => env.value === cookie);

    // 只有一个且值相同，无需操作
    if (exactMatch && existingEnvs.length === 1) {
        $.log('✅ Cookie 值未变化且无重复，跳过更新');
        return { success: true, noChange: true };
    }

    // 有值相同的但存在重复，清理多余的
    if (exactMatch) {
        $.log(`🧹 发现 ${existingEnvs.length - 1} 个重复环境变量，清理中...`);
        await deleteEnvsExcept(config, token, existingEnvs, getEnvId(exactMatch));
        return { success: true, noChange: true };
    }

    // 没有值匹配，删除所有旧的并添加新的
    $.log('🔄 Cookie 值已变化，需要更新');
    const deleteSuccess = await deleteAllEnvs(config, token, existingEnvs);

    $.log('➕ 添加新的环境变量 JD_COOKIE');
    const result = await addEnv(config, token, 'JD_COOKIE', cookie, `Account: ${ptPin}`);

    // 删除失败但添加成功（检测到重复），视为成功
    if (!deleteSuccess && result.success && result.isDuplicate) {
        $.log('✅ 虽然删除失败，但环境变量值正确，视为更新成功');
    }

    return result;
}

/**
 * 清除绕过检查标志
 */
function clearBypassFlag() {
    if ($.getval(CONFIG_KEYS.BYPASS_CHECK) === 'true') {
        $.setval('false', CONFIG_KEYS.BYPASS_CHECK);
        $.log('✅ 已清除缓存绕过标志，恢复正常时间间隔检查');
    }
}

/**
 * 同步 Cookie 到青龙
 */
async function syncToQinglong(cookie, ptPin) {
    const config = getConfig();

    // 检查是否需要更新
    const updateCheck = shouldUpdate(ptPin, cookie, config);
    if (!updateCheck.should) {
        $.log(`⏭️ 跳过更新，原因: ${updateCheck.reason}`);
        return;
    }

    // 检查配置
    const configCheck = validateConfig(config);
    if (!configCheck.valid) {
        $.msg('JD Cookie Sync', '配置错误', configCheck.message);
        return;
    }

    // 提前更新缓存，防止重复触发
    updateCache(ptPin, cookie);

    // 获取 Token
    const tokenResult = await getQinglongToken(config);
    if (!tokenResult.success) {
        $.msg('JD Cookie Sync', '获取 Token 失败', tokenResult.message);
        return;
    }

    // 查询现有环境变量
    const envListResult = await getEnvList(config, tokenResult.token);
    if (!envListResult.success) {
        $.msg('JD Cookie Sync', '查询环境变量失败', envListResult.message);
        return;
    }

    // 处理环境变量同步
    const existingEnvs = findMatchingEnvs(envListResult.data, ptPin);
    let result;

    if (existingEnvs.length > 0) {
        result = await handleExistingEnvs(config, tokenResult.token, existingEnvs, cookie, ptPin);
    } else {
        $.log(`➕ 新增账号 ${ptPin}，创建环境变量 JD_COOKIE`);
        result = await addEnv(config, tokenResult.token, 'JD_COOKIE', cookie, `Account: ${ptPin}`);
    }

    // 处理结果
    if (result.success) {
        clearBypassFlag();
        // 静默处理重复值或未变化的情况
        if (!result.isDuplicate && !result.noChange) {
            $.msg('JD Cookie Sync', '✅ 同步成功', `账号: ${ptPin}\n已同步到青龙面板`);
        }
    } else {
        $.msg('JD Cookie Sync', '❌ 同步失败', result.message);
    }
}

// ============= 主函数 =============

(async () => {
    try {
        const headers = $request.headers;

        // 检查 User-Agent，只处理京东主App的请求
        const userAgent = headers['User-Agent'] || headers['user-agent'] || '';
        if (!userAgent.startsWith('JD4iPhone')) {
            $.log(`⏭️ 跳过非京东主App请求: ${userAgent.substring(0, 30)}...`);
            $.done({});
            return;
        }

        // 提取并验证 Cookie
        const cookieResult = extractCookie(headers);

        if (!cookieResult.valid) {
            $.log(`⚠️ Cookie 提取失败: ${cookieResult.message}`);
            $.done({});
            return;
        }

        $.log(`✅ 成功提取 Cookie，账号: ${cookieResult.ptPin}`);

        // 同步到青龙
        await syncToQinglong(cookieResult.cookie, cookieResult.ptPin);

    } catch (error) {
        $.log(`❌ 脚本执行异常: ${error.message || error}`);
        $.msg('JD Cookie Sync', '脚本执行异常', String(error));
    } finally {
        $.done({});
    }
})();

// ============= 环境适配器 =============

function Env(t, e) { class s { constructor(t) { this.env = t } send(t, e = "GET") { t = "string" == typeof t ? { url: t } : t; let s = this.get; "POST" === e && (s = this.post); const i = new Promise(((e, i) => { s.call(this, t, ((t, s, o) => { t ? i(t) : e(s) })) })); return t.timeout ? ((t, e = 1e3) => Promise.race([t, new Promise(((t, s) => { setTimeout((() => { s(new Error("请求超时")) }), e) }))]))(i, t.timeout) : i } get(t) { return this.send.call(this.env, t) } post(t) { return this.send.call(this.env, t, "POST") } } return new class { constructor(t, e) { this.logLevels = { debug: 0, info: 1, warn: 2, error: 3 }, this.logLevelPrefixs = { debug: "[DEBUG] ", info: "[INFO] ", warn: "[WARN] ", error: "[ERROR] " }, this.logLevel = "info", this.name = t, this.http = new s(this), this.data = null, this.dataFile = "box.dat", this.logs = [], this.isMute = !1, this.isNeedRewrite = !1, this.logSeparator = "\n", this.encoding = "utf-8", this.startTime = (new Date).getTime(), Object.assign(this, e), this.log("", `🔔${this.name}, 开始!`) } getEnv() { return "undefined" != typeof $environment && $environment["surge-version"] ? "Surge" : "undefined" != typeof $environment && $environment["stash-version"] ? "Stash" : "undefined" != typeof module && module.exports ? "Node.js" : "undefined" != typeof $task ? "Quantumult X" : "undefined" != typeof $loon ? "Loon" : "undefined" != typeof $rocket ? "Shadowrocket" : void 0 } isNode() { return "Node.js" === this.getEnv() } isQuanX() { return "Quantumult X" === this.getEnv() } isSurge() { return "Surge" === this.getEnv() } isLoon() { return "Loon" === this.getEnv() } isShadowrocket() { return "Shadowrocket" === this.getEnv() } isStash() { return "Stash" === this.getEnv() } toObj(t, e = null) { try { return JSON.parse(t) } catch { return e } } toStr(t, e = null, ...s) { try { return JSON.stringify(t, ...s) } catch { return e } } getjson(t, e) { let s = e; if (this.getdata(t)) try { s = JSON.parse(this.getdata(t)) } catch { } return s } setjson(t, e) { try { return this.setdata(JSON.stringify(t), e) } catch { return !1 } } getScript(t) { return new Promise((e => { this.get({ url: t }, ((t, s, i) => e(i))) })) } runScript(t, e) { return new Promise((s => { let i = this.getdata("@chavy_boxjs_userCfgs.httpapi"); i = i ? i.replace(/\n/g, "").trim() : i; let o = this.getdata("@chavy_boxjs_userCfgs.httpapi_timeout"); o = o ? 1 * o : 20, o = e && e.timeout ? e.timeout : o; const [r, a] = i.split("@"), n = { url: `http://${a}/v1/scripting/evaluate`, body: { script_text: t, mock_type: "cron", timeout: o }, headers: { "X-Key": r, Accept: "*/*" }, policy: "DIRECT", timeout: o }; this.post(n, ((t, e, i) => s(i))) })).catch((t => this.logErr(t))) } loaddata() { if (!this.isNode()) return {}; { this.fs = this.fs ? this.fs : require("fs"), this.path = this.path ? this.path : require("path"); const t = this.path.resolve(this.dataFile), e = this.path.resolve(process.cwd(), this.dataFile), s = this.fs.existsSync(t), i = !s && this.fs.existsSync(e); if (!s && !i) return {}; { const i = s ? t : e; try { return JSON.parse(this.fs.readFileSync(i)) } catch (t) { return {} } } } } writedata() { if (this.isNode()) { this.fs = this.fs ? this.fs : require("fs"), this.path = this.path ? this.path : require("path"); const t = this.path.resolve(this.dataFile), e = this.path.resolve(process.cwd(), this.dataFile), s = this.fs.existsSync(t), i = !s && this.fs.existsSync(e), o = JSON.stringify(this.data); s ? this.fs.writeFileSync(t, o) : i ? this.fs.writeFileSync(e, o) : this.fs.writeFileSync(t, o) } } lodash_get(t, e, s) { const i = e.replace(/\[(\d+)\]/g, ".$1").split("."); let o = t; for (const t of i) if (o = Object(o)[t], void 0 === o) return s; return o } lodash_set(t, e, s) { return Object(t) !== t || (Array.isArray(e) || (e = e.toString().match(/[^.[\]]+/g) || []), e.slice(0, -1).reduce(((t, s, i) => Object(t[s]) === t[s] ? t[s] : t[s] = Math.abs(e[i + 1]) >> 0 == +e[i + 1] ? [] : {}), t)[e[e.length - 1]] = s), t } getdata(t) { let e = this.getval(t); if (/^@/.test(t)) { const [, s, i] = /^@(.*?)\.(.*?)$/.exec(t), o = s ? this.getval(s) : ""; if (o) try { const t = JSON.parse(o); e = t ? this.lodash_get(t, i, "") : e } catch (t) { e = "" } } return e } setdata(t, e) { let s = !1; if (/^@/.test(e)) { const [, i, o] = /^@(.*?)\.(.*?)$/.exec(e), r = this.getval(i), a = i ? "null" === r ? null : r || "{}" : "{}"; try { const e = JSON.parse(a); this.lodash_set(e, o, t), s = this.setval(JSON.stringify(e), i) } catch (e) { const r = {}; this.lodash_set(r, o, t), s = this.setval(JSON.stringify(r), i) } } else s = this.setval(t, e); return s } getval(t) { switch (this.getEnv()) { case "Surge": case "Loon": case "Stash": case "Shadowrocket": return $persistentStore.read(t); case "Quantumult X": return $prefs.valueForKey(t); case "Node.js": return this.data = this.loaddata(), this.data[t]; default: return this.data && this.data[t] || null } } setval(t, e) { switch (this.getEnv()) { case "Surge": case "Loon": case "Stash": case "Shadowrocket": return $persistentStore.write(t, e); case "Quantumult X": return $prefs.setValueForKey(t, e); case "Node.js": return this.data = this.loaddata(), this.data[e] = t, this.writedata(), !0; default: return this.data && this.data[e] || null } } initGotEnv(t) { this.got = this.got ? this.got : require("got"), this.cktough = this.cktough ? this.cktough : require("tough-cookie"), this.ckjar = this.ckjar ? this.ckjar : new this.cktough.CookieJar, t && (t.headers = t.headers ? t.headers : {}, t && (t.headers = t.headers ? t.headers : {}, void 0 === t.headers.cookie && void 0 === t.headers.Cookie && void 0 === t.cookieJar && (t.cookieJar = this.ckjar))) } get(t, e = (() => { })) { switch (t.headers && (delete t.headers["Content-Type"], delete t.headers["Content-Length"], delete t.headers["content-type"], delete t.headers["content-length"]), t.params && (t.url += "?" + this.queryStr(t.params)), void 0 === t.followRedirect || t.followRedirect || ((this.isSurge() || this.isLoon()) && (t["auto-redirect"] = !1), this.isQuanX() && (t.opts ? t.opts.redirection = !1 : t.opts = { redirection: !1 })), this.getEnv()) { case "Surge": case "Loon": case "Stash": case "Shadowrocket": default: this.isSurge() && this.isNeedRewrite && (t.headers = t.headers || {}, Object.assign(t.headers, { "X-Surge-Skip-Scripting": !1 })), $httpClient.get(t, ((t, s, i) => { !t && s && (s.body = i, s.statusCode = s.status ? s.status : s.statusCode, s.status = s.statusCode), e(t, s, i) })); break; case "Quantumult X": this.isNeedRewrite && (t.opts = t.opts || {}, Object.assign(t.opts, { hints: !1 })), $task.fetch(t).then((t => { const { statusCode: s, statusCode: i, headers: o, body: r, bodyBytes: a } = t; e(null, { status: s, statusCode: i, headers: o, body: r, bodyBytes: a }, r, a) }), (t => e(t && t.error || "UndefinedError"))); break; case "Node.js": let s = require("iconv-lite"); this.initGotEnv(t), this.got(t).on("redirect", ((t, e) => { try { if (t.headers["set-cookie"]) { const s = t.headers["set-cookie"].map(this.cktough.Cookie.parse).toString(); s && this.ckjar.setCookieSync(s, null), e.cookieJar = this.ckjar } } catch (t) { this.logErr(t) } })).then((t => { const { statusCode: i, statusCode: o, headers: r, rawBody: a } = t, n = s.decode(a, this.encoding); e(null, { status: i, statusCode: o, headers: r, rawBody: a, body: n }, n) }), (t => { const { message: i, response: o } = t; e(i, o, o && s.decode(o.rawBody, this.encoding)) })); break } } post(t, e = (() => { })) { const s = t.method ? t.method.toLocaleLowerCase() : "post"; switch (t.body && t.headers && !t.headers["Content-Type"] && !t.headers["content-type"] && (t.headers["content-type"] = "application/x-www-form-urlencoded"), t.headers && (delete t.headers["Content-Length"], delete t.headers["content-length"]), void 0 === t.followRedirect || t.followRedirect || ((this.isSurge() || this.isLoon()) && (t["auto-redirect"] = !1), this.isQuanX() && (t.opts ? t.opts.redirection = !1 : t.opts = { redirection: !1 })), this.getEnv()) { case "Surge": case "Loon": case "Stash": case "Shadowrocket": default: this.isSurge() && this.isNeedRewrite && (t.headers = t.headers || {}, Object.assign(t.headers, { "X-Surge-Skip-Scripting": !1 })), $httpClient[s](t, ((t, s, i) => { !t && s && (s.body = i, s.statusCode = s.status ? s.status : s.statusCode, s.status = s.statusCode), e(t, s, i) })); break; case "Quantumult X": t.method = s, this.isNeedRewrite && (t.opts = t.opts || {}, Object.assign(t.opts, { hints: !1 })), $task.fetch(t).then((t => { const { statusCode: s, statusCode: i, headers: o, body: r, bodyBytes: a } = t; e(null, { status: s, statusCode: i, headers: o, body: r, bodyBytes: a }, r, a) }), (t => e(t && t.error || "UndefinedError"))); break; case "Node.js": let i = require("iconv-lite"); this.initGotEnv(t); const { url: o, ...r } = t; this.got[s](o, r).then((t => { const { statusCode: s, statusCode: o, headers: r, rawBody: a } = t, n = i.decode(a, this.encoding); e(null, { status: s, statusCode: o, headers: r, rawBody: a, body: n }, n) }), (t => { const { message: s, response: o } = t; e(s, o, o && i.decode(o.rawBody, this.encoding)) })); break } } time(t, e = null) { const s = e ? new Date(e) : new Date; let i = { "M+": s.getMonth() + 1, "d+": s.getDate(), "H+": s.getHours(), "m+": s.getMinutes(), "s+": s.getSeconds(), "q+": Math.floor((s.getMonth() + 3) / 3), S: s.getMilliseconds() }; /(y+)/.test(t) && (t = t.replace(RegExp.$1, (s.getFullYear() + "").substr(4 - RegExp.$1.length))); for (let e in i) new RegExp("(" + e + ")").test(t) && (t = t.replace(RegExp.$1, 1 == RegExp.$1.length ? i[e] : ("00" + i[e]).substr(("" + i[e]).length))); return t } queryStr(t) { let e = ""; for (const s in t) { let i = t[s]; null != i && "" !== i && ("object" == typeof i && (i = JSON.stringify(i)), e += `${s}=${i}&`) } return e = e.substring(0, e.length - 1), e } msg(e = t, s = "", i = "", o = {}) { const r = t => { const { $open: e, $copy: s, $media: i, $mediaMime: o } = t; switch (typeof t) { case void 0: return t; case "string": switch (this.getEnv()) { case "Surge": case "Stash": default: return { url: t }; case "Loon": case "Shadowrocket": return t; case "Quantumult X": return { "open-url": t }; case "Node.js": return }case "object": switch (this.getEnv()) { case "Surge": case "Stash": case "Shadowrocket": default: { const r = {}; let a = t.openUrl || t.url || t["open-url"] || e; a && Object.assign(r, { action: "open-url", url: a }); let n = t["update-pasteboard"] || t.updatePasteboard || s; if (n && Object.assign(r, { action: "clipboard", text: n }), i) { let t, e, s; if (i.startsWith("http")) t = i; else if (i.startsWith("data:")) { const [t] = i.split(";"), [, o] = i.split(","); e = o, s = t.replace("data:", "") } else { e = i, s = (t => { const e = { JVBERi0: "application/pdf", R0lGODdh: "image/gif", R0lGODlh: "image/gif", iVBORw0KGgo: "image/png", "/9j/": "image/jpg" }; for (var s in e) if (0 === t.indexOf(s)) return e[s]; return null })(i) } Object.assign(r, { "media-url": t, "media-base64": e, "media-base64-mime": o ?? s }) } return Object.assign(r, { "auto-dismiss": t["auto-dismiss"], sound: t.sound }), r } case "Loon": { const s = {}; let o = t.openUrl || t.url || t["open-url"] || e; o && Object.assign(s, { openUrl: o }); let r = t.mediaUrl || t["media-url"]; return i?.startsWith("http") && (r = i), r && Object.assign(s, { mediaUrl: r }), console.log(JSON.stringify(s)), s } case "Quantumult X": { const o = {}; let r = t["open-url"] || t.url || t.openUrl || e; r && Object.assign(o, { "open-url": r }); let a = t["media-url"] || t.mediaUrl; i?.startsWith("http") && (a = i), a && Object.assign(o, { "media-url": a }); let n = t["update-pasteboard"] || t.updatePasteboard || s; return n && Object.assign(o, { "update-pasteboard": n }), console.log(JSON.stringify(o)), o } case "Node.js": return }default: return } }; if (!this.isMute) switch (this.getEnv()) { case "Surge": case "Loon": case "Stash": case "Shadowrocket": default: $notification.post(e, s, i, r(o)); break; case "Quantumult X": $notify(e, s, i, r(o)); break; case "Node.js": break }if (!this.isMuteLog) { let t = ["", "==============📣系统通知📣=============="]; t.push(e), s && t.push(s), i && t.push(i), console.log(t.join("\n")), this.logs = this.logs.concat(t) } } debug(...t) { this.logLevels[this.logLevel] <= this.logLevels.debug && (t.length > 0 && (this.logs = [...this.logs, ...t]), console.log(`${this.logLevelPrefixs.debug}${t.map((t => t ?? String(t))).join(this.logSeparator)}`)) } info(...t) { this.logLevels[this.logLevel] <= this.logLevels.info && (t.length > 0 && (this.logs = [...this.logs, ...t]), console.log(`${this.logLevelPrefixs.info}${t.map((t => t ?? String(t))).join(this.logSeparator)}`)) } warn(...t) { this.logLevels[this.logLevel] <= this.logLevels.warn && (t.length > 0 && (this.logs = [...this.logs, ...t]), console.log(`${this.logLevelPrefixs.warn}${t.map((t => t ?? String(t))).join(this.logSeparator)}`)) } error(...t) { this.logLevels[this.logLevel] <= this.logLevels.error && (t.length > 0 && (this.logs = [...this.logs, ...t]), console.log(`${this.logLevelPrefixs.error}${t.map((t => t ?? String(t))).join(this.logSeparator)}`)) } log(...t) { t.length > 0 && (this.logs = [...this.logs, ...t]), console.log(`[${this.name}] ${t.map((t => t ?? String(t))).join(this.logSeparator)}`) } logErr(t, e) { switch (this.getEnv()) { case "Surge": case "Loon": case "Stash": case "Shadowrocket": case "Quantumult X": default: this.log("", `❗️${this.name}, 错误!`, e, t); break; case "Node.js": this.log("", `❗️${this.name}, 错误!`, e, void 0 !== t.message ? t.message : t, t.stack); break } } wait(t) { return new Promise((e => setTimeout(e, t))) } done(t = {}) { const e = ((new Date).getTime() - this.startTime) / 1e3; switch (this.log("", `🔔${this.name}, 结束! 🕛 ${e} 秒`), this.log(), this.getEnv()) { case "Surge": case "Loon": case "Stash": case "Shadowrocket": case "Quantumult X": default: $done(t); break; case "Node.js": process.exit(1) } } }(t, e) }
