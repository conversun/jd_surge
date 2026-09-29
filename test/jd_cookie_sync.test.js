/**
 * jd_cookie_sync.js 主脚本回归测试
 *
 * 重点锁定三条来之不易的不变量（见 AGENTS.md）：
 *   1. 先加后删——顺序颠倒会在脚本被杀时导致账号 Cookie 归零
 *   2. 单账号同步锁——触发正则匹配每个 /client.action 请求，京东 App 启动时会并发
 *   3. 凭证 URL 编码——secret 含 & 或 = 时认证会莫名失败
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const {
    runInSurge,
    createQinglongStub,
    methodSequence,
    envRow,
    VALID_COOKIE,
    APP_OPEN_COOKIE,
    JD_UA,
    JD_UA_CFNETWORK,
    JD_UA_H5,
    FULL_CONFIG
} = require('./helpers/harness');

const OLD_COOKIE = 'pt_key=OLDKEY0000000;pt_pin=testuser;';
const oldEnvs = () => [envRow(7, OLD_COOKIE)];

function config(extra = {}) {
    return { ...FULL_CONFIG, ...extra };
}

test('先加后删：Cookie 变化时必须先新增再删除旧变量', async () => {
    const qinglong = createQinglongStub({ envs: oldEnvs() });
    const { requests } = await runInSurge('sync', { store: config(), qinglong });

    const seq = methodSequence(requests);
    const addIdx = seq.indexOf('POST');
    const delIdx = seq.indexOf('DELETE');

    assert.notEqual(addIdx, -1, '应当发出新增请求');
    assert.notEqual(delIdx, -1, '应当发出删除请求');
    assert.ok(
        addIdx < delIdx,
        `新增必须早于删除，否则脚本被杀时账号会没有任何 Cookie（实际 add@${addIdx} delete@${delIdx}）`
    );
});

test('先加后删：删除请求体必须是整数数组', async () => {
    const qinglong = createQinglongStub({ envs: oldEnvs() });
    const { requests } = await runInSurge('sync', { store: config(), qinglong });

    const del = requests.find((r) => r.method === 'DELETE');
    assert.equal(del.body, '[7]', '青龙 DELETE /open/envs 要求整数数组，字符串 ID 会报类型错误');
});

test('新增失败时保留旧变量，不发删除请求', async () => {
    const qinglong = createQinglongStub({ envs: oldEnvs(), addFails: true });
    const { requests, notifications } = await runInSurge('sync', { store: config(), qinglong });

    assert.ok(!methodSequence(requests).includes('DELETE'), '新增失败后删除旧变量会导致账号彻底失去 Cookie');
    assert.ok(
        notifications.some((n) => n.subtitle.includes('同步失败')),
        '失败应当通知用户'
    );
});

test('新值撞上 unique violation 时跳过清理', async () => {
    // 新值已存在于「其他」env 行，本次并未真正写入 JD_COOKIE，
    // 此时删除旧变量会让该账号无变量可用。
    const qinglong = createQinglongStub({ envs: oldEnvs(), addDuplicate: true });
    const { requests, notifications } = await runInSurge('sync', { store: config(), qinglong });

    assert.ok(!methodSequence(requests).includes('DELETE'), '值落在别处时不得清理旧变量');
    assert.equal(notifications.length, 0, '重复值属于正常情况，不应打扰用户');
});

test('新增失败时不写缓存，保证下次触发会重试', async () => {
    const store = config();
    const qinglong = createQinglongStub({ envs: oldEnvs(), addFails: true });
    await runInSurge('sync', { store, qinglong });

    assert.equal(store.jd_cookie_cache_testuser, undefined, '同步失败却写缓存会让脚本在间隔内不再重试');
});

test('同步成功后写入缓存与时间戳', async () => {
    const store = config();
    const qinglong = createQinglongStub({ envs: oldEnvs() });
    await runInSurge('sync', { store, qinglong });

    assert.equal(store.jd_cookie_cache_testuser, 'pt_key=AAJoNEWKEY1234567890;pt_pin=testuser;');
    assert.ok(Number(store.jd_cookie_last_update_testuser) > 0, '应记录本次同步时间');
});

test('同步锁：已被占用时完全跳过，不发任何请求', async () => {
    const store = config({ jd_cookie_syncing_testuser: String(Date.now()) });
    const qinglong = createQinglongStub({ envs: oldEnvs() });
    const { requests } = await runInSurge('sync', { store, qinglong });

    assert.equal(requests.length, 0, '并发触发必须在拿锁阶段就退出');
});

test('同步锁：过期锁不阻塞（防止脚本被杀后永久卡死）', async () => {
    const stale = String(Date.now() - 120000);
    const store = config({ jd_cookie_syncing_testuser: stale });
    const qinglong = createQinglongStub({ envs: oldEnvs() });
    const { requests } = await runInSurge('sync', { store, qinglong });

    assert.ok(requests.length > 0, 'TTL 过期后必须放行，否则崩溃一次就永久锁死该账号');
});

test('同步锁：正常结束后释放', async () => {
    const store = config();
    await runInSurge('sync', { store, qinglong: createQinglongStub({ envs: oldEnvs() }) });

    assert.equal(store.jd_cookie_syncing_testuser, '0');
});

test('同步锁：中途失败也要释放（finally 保障）', async () => {
    const store = config();
    await runInSurge('sync', {
        store,
        qinglong: createQinglongStub({ envs: oldEnvs(), tokenFails: true })
    });

    assert.equal(store.jd_cookie_syncing_testuser, '0', '拿不到 token 也必须释放锁');
});

test('凭证包含 & 与 = 时必须 URL 编码', async () => {
    const qinglong = createQinglongStub({ envs: oldEnvs() });
    const { requests } = await runInSurge('sync', { store: config(), qinglong });

    const token = requests.find((r) => r.url.includes('/open/auth/token'));
    assert.match(token.url, /client_id=id%26with%3Dspecials/);
    assert.match(token.url, /client_secret=sec%26ret%3D%2F%2Bx/);
});

test('值未变化且无重复时不发写请求', async () => {
    const qinglong = createQinglongStub({ envs: [envRow(7, 'pt_key=AAJoNEWKEY1234567890;pt_pin=testuser;')] });
    const { requests } = await runInSurge('sync', { store: config(), qinglong });

    const seq = methodSequence(requests);
    assert.ok(!seq.includes('POST') && !seq.includes('DELETE'), '无变化时应当是纯读操作');
});

test('存在重复行时清理多余项，保留精确匹配那条', async () => {
    const current = 'pt_key=AAJoNEWKEY1234567890;pt_pin=testuser;';
    const qinglong = createQinglongStub({
        envs: [envRow(7, current), envRow(8, current), envRow(9, OLD_COOKIE)]
    });
    const { requests } = await runInSurge('sync', { store: config(), qinglong });

    const deleted = requests.filter((r) => r.method === 'DELETE').map((r) => r.body);
    assert.equal(deleted.length, 2, '应删除另外两条');
    assert.ok(!deleted.includes('[7]'), '精确匹配的那条必须保留');
});

test('账号隔离：不同 pt_pin 的环境变量互不干扰', async () => {
    const qinglong = createQinglongStub({
        envs: [envRow(7, OLD_COOKIE), envRow(8, 'pt_key=OTHERKEY123;pt_pin=otheruser;')]
    });
    const { requests } = await runInSurge('sync', { store: config(), qinglong });

    const deleted = requests.filter((r) => r.method === 'DELETE').map((r) => r.body);
    assert.ok(!deleted.includes('[8]'), '绝不能删除其他账号的 Cookie');
});

test('账号隔离：同步锁按 pt_pin 分账号', async () => {
    // 锁住 otheruser 不应妨碍 testuser 同步
    const store = config({ jd_cookie_syncing_otheruser: String(Date.now()) });
    const { requests } = await runInSurge('sync', {
        store,
        qinglong: createQinglongStub({ envs: oldEnvs() })
    });

    assert.ok(requests.length > 0, '锁必须是按账号的，不能变成全局锁');
});

test('跳过非京东 App 的请求', async () => {
    const qinglong = createQinglongStub({ envs: oldEnvs() });
    const { requests } = await runInSurge('sync', {
        store: config(),
        headers: { 'User-Agent': 'Mozilla/5.0 Safari', Cookie: VALID_COOKIE },
        qinglong
    });

    assert.equal(requests.length, 0, '浏览器与第三方客户端的请求必须跳过');
});

test('跳过 guest 与 fake_ 游客 Cookie', async () => {
    for (const cookie of ['pt_key=fake_abcdefghij;pt_pin=someone;', 'pt_key=AAJoREALKEY123;pt_pin=guest;']) {
        const qinglong = createQinglongStub({ envs: oldEnvs() });
        const { requests } = await runInSurge('sync', {
            store: config(),
            headers: { 'User-Agent': JD_UA, Cookie: cookie },
            qinglong
        });
        assert.equal(requests.length, 0, `游客 Cookie 不应同步: ${cookie}`);
    }
});

test('放行 App 内 H5 的 jdapp; User-Agent（2026-09 新形态）', async () => {
    const qinglong = createQinglongStub({ envs: oldEnvs() });
    const { requests } = await runInSurge('sync', {
        store: config(),
        headers: { 'User-Agent': JD_UA_H5, Cookie: VALID_COOKIE },
        qinglong
    });

    assert.ok(requests.length > 0, 'jdapp; 前缀属于京东主 App 的 H5 容器，不能被当成浏览器过滤掉');
});

test('新形态 UA JD4iPhone/16.0.0 CFNetwork 也要放行', async () => {
    const qinglong = createQinglongStub({ envs: oldEnvs() });
    const { requests } = await runInSurge('sync', {
        store: config(),
        headers: { 'User-Agent': JD_UA_CFNETWORK, Cookie: VALID_COOKIE },
        qinglong
    });

    assert.ok(requests.length > 0, 'CFNetwork 形态仍是 JD4iPhone 前缀，不应被过滤');
});

test('默认保留 pt_key 的 app_open 前缀', async () => {
    // 原值就是京东服务器刚刚接受过的完整凭证，默认不该改动
    const qinglong = createQinglongStub({ envs: oldEnvs() });
    const { requests } = await runInSurge('sync', {
        store: config(),
        headers: { 'User-Agent': JD_UA, Cookie: APP_OPEN_COOKIE },
        qinglong
    });

    const add = requests.find((r) => r.method === 'POST');
    assert.ok(add.body.includes('pt_key=app_open'), '未配置开关时不得改动抓到的原值');
});

test('置 jd_strip_app_open=true 时去掉前缀', async () => {
    const qinglong = createQinglongStub({ envs: oldEnvs() });
    const { requests } = await runInSurge('sync', {
        store: config({ jd_strip_app_open: 'true' }),
        headers: { 'User-Agent': JD_UA, Cookie: APP_OPEN_COOKIE },
        qinglong
    });

    const add = requests.find((r) => r.method === 'POST');
    assert.ok(add.body.includes('pt_key=AAJoAPP'), '应当同步去掉前缀后的经典格式');
    assert.ok(!add.body.includes('app_open'), '前缀不应残留在同步值里');
});

test('缺少 Cookie 头时安全退出', async () => {
    const qinglong = createQinglongStub({ envs: oldEnvs() });
    const { requests } = await runInSurge('sync', {
        store: config(),
        headers: { 'User-Agent': JD_UA },
        qinglong
    });

    assert.equal(requests.length, 0);
});

test('配置缺失时提示用户且不发请求', async () => {
    const qinglong = createQinglongStub();
    const { requests, notifications } = await runInSurge('sync', {
        store: { ql_url: 'http://ql.local:5700' },
        qinglong
    });

    assert.equal(requests.length, 0);
    assert.ok(notifications.some((n) => n.body.includes('配置不完整')));
});

test('青龙地址协议非法时拒绝请求', async () => {
    const qinglong = createQinglongStub();
    const { requests, notifications } = await runInSurge('sync', {
        store: config({ ql_url: 'ql.local:5700' }),
        qinglong
    });

    assert.equal(requests.length, 0);
    assert.ok(notifications.some((n) => n.body.includes('格式错误')));
});

test('时间间隔内跳过同步', async () => {
    const store = config({
        jd_cookie_cache_testuser: 'pt_key=AAJoNEWKEY1234567890;pt_pin=testuser;',
        jd_cookie_last_update_testuser: String(Date.now())
    });
    const qinglong = createQinglongStub({ envs: oldEnvs() });
    const { requests } = await runInSurge('sync', { store, qinglong });

    assert.equal(requests.length, 0, '默认 1800 秒内不应重复同步');
});

test('Cookie 变化可绕过时间间隔', async () => {
    const store = config({
        jd_cookie_cache_testuser: OLD_COOKIE, // 与当前抓到的值不同
        jd_cookie_last_update_testuser: String(Date.now())
    });
    const qinglong = createQinglongStub({ envs: oldEnvs() });
    const { requests } = await runInSurge('sync', { store, qinglong });

    assert.ok(requests.length > 0, '登录换号后必须立刻同步，不能等间隔');
});

test('bypass 标志绕过间隔并在成功后自动复位', async () => {
    const store = config({
        jd_bypass_interval_check: 'true',
        jd_cookie_cache_testuser: 'pt_key=AAJoNEWKEY1234567890;pt_pin=testuser;',
        jd_cookie_last_update_testuser: String(Date.now())
    });
    const qinglong = createQinglongStub({ envs: oldEnvs() });
    const { requests } = await runInSurge('sync', { store, qinglong });

    assert.ok(requests.length > 0, '清缓存后应立即同步');
    assert.equal(store.jd_bypass_interval_check, 'false', '标志必须被消费掉，否则永久绕过间隔');
});

test('token 获取失败时不继续后续调用', async () => {
    const qinglong = createQinglongStub({ envs: oldEnvs(), tokenFails: true });
    const { requests, notifications } = await runInSurge('sync', { store: config(), qinglong });

    assert.equal(requests.length, 1, '拿不到 token 就不应再查询环境变量');
    assert.ok(notifications.some((n) => n.subtitle.includes('Token')));
});

test('查询环境变量失败时不写任何数据', async () => {
    const store = config();
    const qinglong = createQinglongStub({ envListFails: true });
    const { requests } = await runInSurge('sync', { store, qinglong });

    assert.ok(!methodSequence(requests).includes('POST'));
    assert.equal(store.jd_cookie_cache_testuser, undefined);
});

test('日志与通知中绝不出现明文 pt_key', async () => {
    const qinglong = createQinglongStub({ envs: oldEnvs() });
    const { logs, notifications } = await runInSurge('sync', { store: config(), qinglong });

    const surfaced = [...logs, ...notifications.map((n) => `${n.title}${n.subtitle}${n.body}`)].join('\n');
    assert.ok(!surfaced.includes('AAJoNEWKEY1234567890'), 'pt_key 属于凭证，不得出现在日志或通知中');
    assert.ok(!surfaced.includes('sec&ret'), 'client_secret 不得泄漏');
});
