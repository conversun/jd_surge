/**
 * 模块配置与 QX loader stub 的静态/端到端校验。
 *
 * 这些文件没有语法检查器兜底，改错了只有用户设备上才会暴露，
 * 因此把「两处必须一致」「预算必须嵌套」这类约定固化成测试。
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const { readSource, runQxStub, FULL_CONFIG } = require('./helpers/harness');

const TRIGGER_REGEX = '^https?:\\/\\/api\\.m\\.jd\\.com\\/client\\.action';

test('触发正则在 sgmodule 与 snippet 中保持一致', () => {
    // 两个文件各自硬编码一份，改一个忘改另一个 = QX 用户静默失效
    assert.ok(readSource('sgmodule').includes(TRIGGER_REGEX), 'sgmodule 触发正则已漂移');
    assert.ok(readSource('snippet').includes(TRIGGER_REGEX), 'snippet 触发正则已漂移');
});

test('触发正则不依赖 URL 里的 functionId', () => {
    // 京东 2026-09 起把 functionId 挪进了 POST 请求体，URL 只剩 /client.action?。
    // 一旦有人把 functionId 白名单加回来，QX 用户的命中数会再次变成 0 而毫无提示。
    for (const key of ['sgmodule', 'snippet']) {
        assert.ok(!readSource(key).includes('functionId='), `${key} 又依赖 URL 里的 functionId 了`);
    }
});

test('触发正则能匹配 2026-09 抓包里的真实 URL 形态', () => {
    const patterns = [
        readSource('snippet').match(/^(\^https\?:[^ ]+) url script-request-header/m)[1],
        readSource('sgmodule').match(/pattern=(\^https\?:[^,]+),/)[1]
    ];

    const realUrls = [
        'https://api.m.jd.com/client.action?', // functionId 已被挪进 POST 体
        'https://api.m.jd.com/client.action?functionId=logConfig', // 老形态仍在
        'https://api.m.jd.com/client.action?functionId=babelGetGuideTips',
        'https://api.m.jd.com/client.action?functionId=uploadPageView'
    ];

    for (const [i, raw] of patterns.entries()) {
        const re = new RegExp(raw);
        for (const u of realUrls) {
            assert.ok(re.test(u), `第 ${i + 1} 处正则需要匹配: ${u}`);
        }
    }
});

test('超时预算必须嵌套：内部超时 × 串行请求数 < 模块超时', () => {
    // 模块超时曾是 10s 而内部是 15s，导致内部超时保护永远不触发——
    // Surge 先杀脚本，恰好落进「写到一半」的窗口。
    const moduleTimeout = Number(readSource('sgmodule').match(/timeout=(\d+)/)[1]);
    const requestTimeout = Number(readSource('sync').match(/REQUEST_TIMEOUT = (\d+)/)[1]) / 1000;

    assert.ok(
        requestTimeout < moduleTimeout,
        `内部超时 ${requestTimeout}s 必须小于模块超时 ${moduleTimeout}s`
    );
    assert.ok(
        requestTimeout * 2 <= moduleTimeout,
        `一次完整同步最多 4 次串行往返，模块超时 ${moduleTimeout}s 对内部 ${requestTimeout}s 而言过紧`
    );
});

test('同步锁 TTL 必须大于脚本可能的最长存活时间', () => {
    const src = readSource('sync');
    const lockTtl = Number(src.match(/SYNC_LOCK_TTL = (\d+)/)[1]);
    const moduleTimeout = Number(readSource('sgmodule').match(/timeout=(\d+)/)[1]) * 1000;

    assert.ok(
        lockTtl > moduleTimeout,
        `TTL ${lockTtl}ms 必须大于模块超时 ${moduleTimeout}ms，否则锁会在脚本仍在运行时提前过期`
    );
});

test('sgmodule 声明了 MITM hostname', () => {
    assert.match(readSource('sgmodule'), /\[MITM\][\s\S]*hostname\s*=\s*%APPEND%\s*api\.m\.jd\.com/);
});

test('sgmodule 使用 requires-body=0（脚本只读请求头）', () => {
    assert.match(readSource('sgmodule'), /requires-body=0/);
});

test('config_panel 只接线 smart-check 与 clear-cache', () => {
    // clear 会删掉全部青龙配置，太危险，不放进面板一键触发
    const panel = readSource('panel');
    const args = [...panel.matchAll(/argument=([a-z-]+)/g)].map((m) => m[1]);

    assert.deepEqual(args.sort(), ['clear-cache', 'smart-check']);
});

test('所有远程脚本 URL 都指向本仓库 main 分支', () => {
    // QX stub 曾指向 W-Webber/jd_surge@feature-qx 这个 fork，
    // 导致本仓库对 config_helper.js 的修改永远到不了 QX 用户。
    const files = ['sgmodule', 'snippet', 'panel', 'qxClear', 'qxClearCache', 'qxSmartCheck'];

    for (const key of files) {
        const src = readSource(key);
        assert.ok(!src.includes('W-Webber'), `${key} 仍指向 fork 仓库，这是回归`);

        for (const url of src.match(/https:\/\/raw\.githubusercontent\.com\/\S+/g) || []) {
            assert.match(url, /conversun\/jd_surge/, `${key} 中存在外部仓库 URL: ${url}`);
        }
    }
});

const QX_STUBS = [
    ['qxSmartCheck', 'smart-check'],
    ['qxClearCache', 'clear-cache'],
    ['qxClear', 'clear']
];

for (const [key, expectedArg] of QX_STUBS) {
    test(`QX stub ${expectedArg}：拉取本仓库 config_helper 并正确分派`, async () => {
        const store = { ...FULL_CONFIG };
        const { fetched } = await runQxStub(key, { store });

        // QX 下 $task.fetch 承担全部 HTTP，所以 smart-check 会再发一次
        // token 请求；这里只关心第一次拉的是本仓库的 config_helper
        assert.ok(fetched.length >= 1, '应当拉取远程脚本');
        assert.match(fetched[0], /conversun\/jd_surge\/main\/config_helper\.js/);
        assert.match(readSource(key), new RegExp(`\\$argument\\s*=\\s*["']${expectedArg}["']`));
    });
}

test('QX stub：clear-cache 端到端设置 bypass 标志', async () => {
    // 端到端验证「stub → eval → helper 分派 → 写 $prefs」整条链路
    const store = { ...FULL_CONFIG };
    await runQxStub('qxClearCache', { store });

    assert.equal(store.jd_bypass_interval_check, 'true');
});

test('QX stub：clear 端到端清空配置', async () => {
    const store = { ...FULL_CONFIG };
    await runQxStub('qxClear', { store });

    assert.equal(store.ql_url, '');
    assert.equal(store.ql_client_secret, '');
});

test('QX stub：远程拉取失败时通知用户并结束', async () => {
    const { notifications } = await runQxStub('qxSmartCheck', { fetchFails: true });

    assert.ok(notifications.length > 0, '加载失败必须让用户看到，而不是静默');
});
