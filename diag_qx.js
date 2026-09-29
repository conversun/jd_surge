// JD Cookie Sync 诊断脚本（Quantumult X）
//
// 用法：Quantumult X → 设置 → HTTP 请求 → 右下角"编辑器" → 粘贴本文件全部内容 → 运行
// 结果会弹出一条通知；同时在 设置 → HTTP 请求 → 日志 里能看到同样的输出。
//
// 它检查四件事：
//   1) 远端脚本文件能不能下载（脚本下不来 = 改写规则永远不生效，这是"突然失效"最常见的原因）
//   2) 青龙三件套配置有没有写进 QX 的 $prefs
//   3) 本地缓存 / 同步锁 / 绕过标志的状态
//   4) 青龙面板能不能通（token 获取）

(async () => {
    const R = [];
    const line = (s) => { R.push(s); console.log(s); };
    const mask = (s) => (!s || !s.length ? '(空)' : s.length <= 8 ? '****' : s.slice(0, 4) + '****' + s.slice(-4));

    // ---------- 0. 运行环境 ----------
    const isQX = typeof $task !== 'undefined';
    const envName =
        typeof $environment !== 'undefined' && $environment['surge-version']
            ? 'Surge'
            : isQX
                ? 'Quantumult X'
                : '未知(既不是 Surge 也没有 $task)';
    line('🧭 环境: ' + envName + (isQX ? '' : '  ← 不是在 QX 的脚本环境里'));

    const fetchText = async (url) => {
        if (isQX) {
            try {
                const r = await $task.fetch({ url });
                return { ok: true, status: r.status || r.statusCode, body: r.body || '' };
            } catch (e) {
                return { ok: false, error: String(e && e.message || e) };
            }
        }
        return new Promise((resolve) => {
            $httpClient.get({ url }, (err, resp, data) =>
                err ? resolve({ ok: false, error: String(err) }) : resolve({ ok: true, status: resp.status, body: data || '' })
            );
        });
    };

    // ---------- 1. 远端脚本是否可下载 ----------
    const SCRIPT_URL = 'https://raw.githubusercontent.com/conversun/jd_surge/main/jd_cookie_sync.js';
    const got = await fetchText(SCRIPT_URL);
    if (!got.ok) {
        line('❌ 远端脚本【下载失败】: ' + got.error);
        line('   → 这就是"突然抓不到"的头号嫌疑：QX 下不了 jd_cookie_sync.js，改写规则命中了也没有任何效果。');
        line('   → 处理：把 raw.githubusercontent.com 走代理节点；或在 QX「设置→更多→资源解析器」里给 GitHub 配一个可用地址。');
    } else {
        const looksLikeScript = /new Env\('JD Cookie Sync'\)/.test(got.body);
        line('✅ 远端脚本可下载 [HTTP ' + got.status + ', ' + got.body.length + ' 字节]' + (looksLikeScript ? '' : ' ⚠️ 内容不像脚本(可能是 429/登录页/拦截页)'));
    }

    // ---------- 2. 青龙配置 ----------
    const v = (k) => (isQX ? $prefs.valueForKey(k) : $persistentStore.read(k));
    const qlUrl = v('ql_url');
    const clientId = v('ql_client_id');
    const clientSecret = v('ql_client_secret');
    line('📋 青龙地址: ' + (qlUrl || '(未配置)'));
    line('📋 Client ID: ' + (clientId ? mask(clientId) : '(未配置)'));
    line('📋 Client Secret: ' + (clientSecret ? mask(clientSecret) : '(未配置)'));
    line('⏰ 更新间隔: ' + (v('ql_update_interval') || '1800(默认30分钟)') + ' 秒');

    if (!qlUrl || !clientId || !clientSecret) {
        line('');
        line('❌ 配置不完整。注意 QX 里必须用 $prefs.setValueForKey 写，$persistentStore 在 QX 里是另一个东西。');
        line('   在编辑器里跑这三行(替换成你自己的值)：');
        line("$prefs.setValueForKey('http://你的青龙:5700','ql_url');");
        line("$prefs.setValueForKey('你的ID','ql_client_id');");
        line("$prefs.setValueForKey('你的SECRET','ql_client_secret');$done()");
        line('   ⚠️ 配置缺失时脚本照样会抓 cookie，只是同步到青龙会失败——所以这只会表现为"青龙里没有更新"，不会表现为"完全抓不到"。');
    }

    // ---------- 3. 缓存 / 同步锁 / 绕过标志 ----------
    const bypass = v('jd_bypass_interval_check');
    const now = Date.now();
    line('🔁 绕过间隔标志: ' + (bypass === 'true' ? '已设置(下次强制同步)' : '未设置'));
    line('⚠️ 说明：QX/Surge 的持久化存储不能枚举，所以这里看不到 jd_cookie_cache_xxx / jd_cookie_syncing_xxx 的明细。');
    line('   如果 30 分钟内 cookie 没变化，脚本会【静默跳过】且不写日志，看起来就像"没抓到"。');
    line('   想强制重试：跑 $prefs.setValueForKey(true,"jd_bypass_interval_check") 再打开京东 App。');

    // ---------- 4. 青龙连通性 ----------
    if (qlUrl && clientId && clientSecret) {
        const base = qlUrl.replace(/\/+$/, '');
        const u = base + '/open/auth/token?client_id=' + encodeURIComponent(clientId) + '&client_secret=' + encodeURIComponent(clientSecret);
        const r = await fetchText(u);
        if (!r.ok) {
            line('❌ 青龙连接失败: ' + r.error + '（手机当前网络能不能直接访问 ' + base + '？）');
        } else {
            try {
                const j = JSON.parse(r.body);
                line(j.code === 200 && j.data && j.data.token ? '✅ 青龙连通，token 获取成功' : '❌ 青龙返回异常 [' + j.code + ']: ' + (j.message || '未知'));
            } catch (e) {
                line('❌ 青龙返回了非 JSON 内容(可能被中间环节拦截)：' + String(r.body).slice(0, 80));
            }
        }
    }

    // ---------- 5. 该脚本在找什么 ----------
    line('');
    line('🔎 脚本的触发条件（改一处就静默失效）：');
    line('   域名: api.m.jd.com');
    line('   路径: /client.action?functionId=(getJDUserInfoUnion|queryJDUserInfo|myHomeV2|home|wareBusiness|basicConfig)');
    line('   UA:   必须以 JD4iPhone 开头');
    line('   → QX「首页→最近请求」里搜 api.m.jd.com，点开任意一条看 URL 和请求头 User-Agent，');
    line('     如果 functionId 换了名字或 UA 前缀变了，就需要改 snippet/sgmodule 的正则。');
    line('   → QX「设置→重写→规则」里找到本规则，点它，能看到最近命中次数；显示 0 就说明规则没命中。');

    $notify('JD Cookie 诊断结果', '', R.join('\n'));
    $done();
})().catch((e) => {
    console.log('诊断脚本自身出错: ' + (e && e.stack || e));
    $notify('JD Cookie 诊断结果', '脚本出错', String(e && e.message || e));
    $done();
});
