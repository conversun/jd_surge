/**
 * 测试夹具：在 Node 的 vm 沙箱中模拟 Surge / Quantumult X 运行时。
 *
 * 这些脚本没有导出任何东西——它们是立即执行的 IIFE，依赖 $request、
 * $persistentStore、$httpClient 等宿主全局变量。要在 Node 里跑，只能
 * 造一套假的宿主环境，然后把源码整体丢进 vm 执行。
 *
 * 关键点（踩过的坑）：
 * Env.post() 内部按 `$httpClient[opts.method.toLowerCase()]` 分发，
 * 所以 DELETE 请求落到 $httpClient.delete 而不是 .post。桩必须提供
 * 全部动词，否则会得到 "$httpClient[s] is not a function" 的假失败。
 */

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '../..');

const FILES = {
    sync: path.join(ROOT, 'jd_cookie_sync.js'),
    helper: path.join(ROOT, 'config_helper.js'),
    sgmodule: path.join(ROOT, 'jd_cookie_sync.sgmodule'),
    snippet: path.join(ROOT, 'jd_cookie_sync.snippet'),
    panel: path.join(ROOT, 'config_panel.sgmodule'),
    qxClear: path.join(ROOT, 'Scripts/QuantumultX/clear.js'),
    qxClearCache: path.join(ROOT, 'Scripts/QuantumultX/clear_cache.js'),
    qxSmartCheck: path.join(ROOT, 'Scripts/QuantumultX/smart_check.js')
};

function readSource(key) {
    return fs.readFileSync(FILES[key], 'utf8');
}

const VALID_COOKIE = 'pt_key=AAJoNEWKEY1234567890;pt_pin=testuser;wskey=x';
const JD_UA = 'JD4iPhone/167783 (iPhone; iOS 17.0; Scale/3.00)';
// 2026-09 抓包里的新形态：原生栈改用 CFNetwork UA，App 内 H5 改用 jdapp; 前缀
const JD_UA_CFNETWORK = 'JD4iPhone/16.0.0 CFNetwork/1492.0.1 Darwin/23.3.0';
const JD_UA_H5 =
    'jdapp;iPhone;16.0.0;;;M/5.0;appBuild/170980;jdSupportDarkMode/0;lang/zh_CN;ctype/0;site/CN';
// 2026-09 起 pt_key 带 app_open 渠道前缀
const APP_OPEN_COOKIE = 'pt_key=app_openAAJoAPP1234567890;pt_pin=testuser;wskey=x';

const FULL_CONFIG = {
    ql_url: 'http://ql.local:5700',
    ql_client_id: 'id&with=specials',
    ql_client_secret: 'sec&ret=/+x'
};

/**
 * 构造一个假的青龙服务端。
 *
 * 默认全部成功；通过 opts 可以让任意一步失败，用来覆盖异常分支。
 */
function createQinglongStub(opts = {}) {
    const {
        envs = [],
        tokenFails = false,
        envListFails = false,
        addFails = false,
        addDuplicate = false,
        deleteFails = false,
        hang = null // 'token' | 'add' 等：让该步永不回调，用于验证超时
    } = opts;

    const requests = [];

    function respond(cb, payload) {
        const body = JSON.stringify(payload);
        cb(null, { status: 200, statusCode: 200 }, body);
    }

    return {
        requests,
        get(options, cb) {
            const url = typeof options === 'string' ? options : options.url;
            requests.push({ method: 'GET', url });

            if (url.includes('/open/auth/token')) {
                if (hang === 'token') return;
                if (tokenFails) return respond(cb, { code: 401, message: 'bad credentials' });
                return respond(cb, { code: 200, data: { token: 'TOKEN123' } });
            }
            if (url.includes('/open/envs')) {
                if (hang === 'envs') return;
                if (envListFails) return respond(cb, { code: 500, message: 'db down' });
                return respond(cb, { code: 200, data: envs });
            }
            return cb(`unexpected GET ${url}`);
        },
        write(options, cb) {
            const method = (options.method || 'POST').toUpperCase();
            requests.push({ method, url: options.url, body: options.body });

            if (method === 'DELETE') {
                if (hang === 'delete') return;
                if (deleteFails) return respond(cb, { code: 500, message: 'delete failed' });
                return respond(cb, { code: 200 });
            }
            if (hang === 'add') return;
            if (addFails) return respond(cb, { code: 500, message: 'add failed' });
            if (addDuplicate) {
                return respond(cb, {
                    code: 400,
                    message: 'Validation error',
                    errors: [{ type: 'unique violation', path: 'value', message: 'value must be unique' }]
                });
            }
            return respond(cb, { code: 200 });
        }
    };
}

/**
 * 在模拟的 Surge 环境中执行一个脚本，返回其副作用。
 *
 * 返回的 promise 在脚本调用 $done() 时 resolve —— 每个入口都必须
 * 在 finally 里调用它，所以这同时也是对该约定的隐式断言。
 */
function runInSurge(sourceKey, options = {}) {
    const {
        store = {},
        headers = { 'User-Agent': JD_UA, Cookie: VALID_COOKIE },
        argument,
        qinglong = createQinglongStub(),
        timeoutMs = 3000
    } = options;

    const notifications = [];
    const logs = [];
    let doneCalled = false;

    const sandbox = {
        console: { log: (...a) => logs.push(a.join(' ')) },
        setTimeout,
        clearTimeout,
        Date,
        Promise,
        JSON,
        Number,
        String,
        Object,
        Array,
        Error,
        RegExp,
        Math,
        parseInt,
        parseFloat,
        encodeURIComponent,
        decodeURIComponent,
        $environment: { 'surge-version': '5.0.0' },
        $request: { headers },
        $persistentStore: {
            read: (k) => (k in store ? store[k] : null),
            write: (v, k) => {
                store[k] = v;
                return true;
            }
        },
        $notification: {
            post: (title, subtitle, body) => notifications.push({ title, subtitle, body })
        },
        $httpClient: {
            get: (o, cb) => qinglong.get(o, cb),
            post: (o, cb) => qinglong.write(o, cb),
            delete: (o, cb) => qinglong.write(o, cb),
            put: (o, cb) => qinglong.write(o, cb),
            patch: (o, cb) => qinglong.write(o, cb)
        }
    };
    if (argument !== undefined) sandbox.$argument = argument;
    sandbox.global = sandbox;

    const result = { store, notifications, logs, requests: qinglong.requests };

    return new Promise((resolve, reject) => {
        const timer = setTimeout(
            () => reject(new Error(`script did not call $done() within ${timeoutMs}ms`)),
            timeoutMs
        );

        sandbox.$done = () => {
            if (doneCalled) return; // Surge 会忽略重复调用
            doneCalled = true;
            clearTimeout(timer);
            // 让挂起的 promise 回调先跑完再交回控制权
            setTimeout(() => resolve(result), 0);
        };

        vm.createContext(sandbox);
        try {
            vm.runInContext(readSource(sourceKey), sandbox, { timeout: timeoutMs });
        } catch (err) {
            clearTimeout(timer);
            reject(err);
        }
    });
}

/**
 * 在模拟的 Quantumult X 环境中执行 QX loader stub。
 *
 * stub 会 $task.fetch 远端 config_helper.js 再 eval，这里把网络换成
 * 本地磁盘上的真实文件，从而端到端验证「stub → helper」这条链路。
 */
function runQxStub(sourceKey, options = {}) {
    const { store = {}, remoteBody = readSource('helper'), fetchFails = false, timeoutMs = 3000 } = options;

    const notifications = [];
    const fetched = [];
    let doneCalled = false;

    const sandbox = {
        console: { log: () => {} },
        setTimeout,
        clearTimeout,
        Date,
        Promise,
        JSON,
        Number,
        String,
        Object,
        Array,
        Error,
        RegExp,
        Math,
        parseInt,
        encodeURIComponent,
        decodeURIComponent,
        // 不设置 $environment：Env.getEnv() 依靠 $task 判定为 Quantumult X
        $task: {
            fetch: (o) => {
                fetched.push(o.url);
                return fetchFails
                    ? Promise.reject(new Error('network down'))
                    : Promise.resolve({ statusCode: 200, body: remoteBody });
            }
        },
        $prefs: {
            valueForKey: (k) => (k in store ? store[k] : null),
            setValueForKey: (v, k) => {
                store[k] = v;
                return true;
            }
        },
        $notify: (title, subtitle, body) => notifications.push({ title, subtitle, body })
    };
    sandbox.global = sandbox;

    const result = { store, notifications, fetched };

    return new Promise((resolve, reject) => {
        const timer = setTimeout(
            () => reject(new Error(`QX stub did not call $done() within ${timeoutMs}ms`)),
            timeoutMs
        );
        sandbox.$done = () => {
            if (doneCalled) return;
            doneCalled = true;
            clearTimeout(timer);
            setTimeout(() => resolve(result), 0);
        };

        vm.createContext(sandbox);
        // vm 中间接 eval 走全局作用域，与 QX 里的行为一致
        vm.runInContext(readSource(sourceKey).replace('eval(resp.body)', '(0, eval)(resp.body)'), sandbox, {
            timeout: timeoutMs
        });
    });
}

/** 从青龙请求记录中筛出实际发生的写操作序列 */
function methodSequence(requests) {
    return requests.map((r) => r.method);
}

function envRow(id, value) {
    return { id, name: 'JD_COOKIE', value };
}

module.exports = {
    FILES,
    readSource,
    runInSurge,
    runQxStub,
    createQinglongStub,
    methodSequence,
    envRow,
    VALID_COOKIE,
    APP_OPEN_COOKIE,
    JD_UA,
    JD_UA_CFNETWORK,
    JD_UA_H5,
    FULL_CONFIG
};
