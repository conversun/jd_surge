/**
 * JD Cookie Sync - 配置助手
 * 帮助用户快速配置青龙面板连接信息
 */

const $ = new Env('JD Config Helper');

// ============= 配置助手 =============

/**
 * 显示当前配置
 */
function showCurrentConfig() {
    const qlUrl = $persistentStore.read('ql_url') || '未配置';
    const clientId = $persistentStore.read('ql_client_id') || '未配置';
    const clientSecret = $persistentStore.read('ql_client_secret') || '未配置';
    const updateInterval = $persistentStore.read('ql_update_interval') || '1800 (默认)';
    
    const message = `当前配置信息：
    
📍 青龙地址: ${qlUrl}
🔑 Client ID: ${maskString(clientId)}
🔐 Client Secret: ${maskString(clientSecret)}
⏰ 更新间隔: ${updateInterval} 秒

${(qlUrl === '未配置' || clientId === '未配置' || clientSecret === '未配置') ? '⚠️ 配置不完整，请完成配置' : '✅ 配置完整'}`;
    
    $.notify('JD Cookie Sync', '当前配置', message);
}

/**
 * 智能配置检查（合并显示配置、配置向导、测试配置）
 */
async function smartConfigCheck() {
    const qlUrl = $persistentStore.read('ql_url');
    const clientId = $persistentStore.read('ql_client_id');
    const clientSecret = $persistentStore.read('ql_client_secret');
    const updateInterval = $persistentStore.read('ql_update_interval') || '1800';
    
    // 情况1：配置不完整，显示配置向导
    if (!qlUrl || !clientId || !clientSecret) {
        const instructions = `⚠️ 配置不完整，请先配置

📋 配置方法（URL Scheme）：

1️⃣ 设置青龙地址：
surge:///write-persistent-store?key=ql_url&value=https://your-domain.com

2️⃣ 设置 Client ID：
surge:///write-persistent-store?key=ql_client_id&value=YOUR_CLIENT_ID

3️⃣ 设置 Client Secret：
surge:///write-persistent-store?key=ql_client_secret&value=YOUR_SECRET

复制以上链接到 Safari 打开（替换为你的信息）`;
        
        $.notify('JD Cookie Sync', '配置向导', instructions);
        return;
    }
    
    // 情况2：配置完整，执行测试
    $.notify('JD Cookie Sync', '正在测试配置', '请稍候...');
    
    const url = `${qlUrl}/open/auth/token?client_id=${clientId}&client_secret=${clientSecret}`;
    
    try {
        const response = await $.http.get({
            url: url,
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        const body = JSON.parse(response.body);
        
        if (body.code === 200 && body.data && body.data.token) {
            // 测试成功，显示配置信息
            const message = `✅ 连接测试成功

📍 青龙地址: ${qlUrl}
🔑 Client ID: ${maskString(clientId)}
🔐 Client Secret: ${maskString(clientSecret)}
⏰ 更新间隔: ${updateInterval} 秒

一切正常，可以正常使用！`;
            
            $.notify('JD Cookie Sync', '配置状态', message);
        } else {
            // Token获取失败
            const message = `❌ 连接失败

📍 青龙地址: ${qlUrl}
🔑 Client ID: ${maskString(clientId)}
🔐 Client Secret: ${maskString(clientSecret)}

错误: ${body.message || '未知错误'}

请检查 Client ID 和 Secret 是否正确`;
            
            $.notify('JD Cookie Sync', '配置错误', message);
        }
    } catch (error) {
        // 网络错误
        const message = `❌ 连接失败

📍 青龙地址: ${qlUrl}

网络错误: ${error.message || error}

请检查青龙面板地址是否正确且可访问`;
        
        $.notify('JD Cookie Sync', '配置错误', message);
    }
}

/**
 * 掩码显示敏感信息
 */
function maskString(str) {
    if (!str || str === '未配置') return str;
    if (str.length <= 8) return '****';
    return str.substring(0, 4) + '****' + str.substring(str.length - 4);
}

/**
 * 配置向导
 */
function configWizard() {
    const instructions = `配置步骤：

1️⃣ 准备青龙面板信息
   - 面板地址（如 https://ql.example.com）
   - Client ID
   - Client Secret

2️⃣ 使用以下方式之一配置：

方式一：URL Scheme（推荐）
复制以下链接到 Safari 打开（替换为你的信息）：

surge:///write-persistent-store?key=ql_url&value=https://your-domain.com

surge:///write-persistent-store?key=ql_client_id&value=YOUR_CLIENT_ID

surge:///write-persistent-store?key=ql_client_secret&value=YOUR_SECRET

方式二：脚本编辑器
在 Surge 脚本编辑器中运行：

$persistentStore.write('你的地址', 'ql_url');
$persistentStore.write('你的ID', 'ql_client_id');
$persistentStore.write('你的密钥', 'ql_client_secret');

3️⃣ 配置完成后再次运行本脚本查看配置`;

    $.notify('JD Cookie Sync', '配置向导', instructions);
}

/**
 * 测试配置
 */
async function testConfig() {
    const qlUrl = $persistentStore.read('ql_url');
    const clientId = $persistentStore.read('ql_client_id');
    const clientSecret = $persistentStore.read('ql_client_secret');
    
    if (!qlUrl || !clientId || !clientSecret) {
        $.notify('JD Cookie Sync', '配置测试失败', '⚠️ 请先完成配置');
        return;
    }
    
    $.notify('JD Cookie Sync', '正在测试配置', '请稍候...');
    
    // 测试获取 Token
    const url = `${qlUrl}/open/auth/token?client_id=${clientId}&client_secret=${clientSecret}`;
    
    try {
        const response = await $.http.get({
            url: url,
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        const body = JSON.parse(response.body);
        
        if (body.code === 200 && body.data && body.data.token) {
            $.notify('JD Cookie Sync', '✅ 配置测试成功', '青龙面板连接正常，可以正常使用了！');
        } else {
            $.notify('JD Cookie Sync', '❌ 配置测试失败', `错误信息: ${body.message || '未知错误'}\n\n请检查 Client ID 和 Secret 是否正确`);
        }
    } catch (error) {
        $.notify('JD Cookie Sync', '❌ 配置测试失败', `网络错误: ${error.message || error}\n\n请检查青龙面板地址是否正确且可访问`);
    }
}

/**
 * 清除配置
 */
function clearConfig() {
    $persistentStore.write('', 'ql_url');
    $persistentStore.write('', 'ql_client_id');
    $persistentStore.write('', 'ql_client_secret');
    $persistentStore.write('', 'ql_update_interval');
    
    $.notify('JD Cookie Sync', '✅ 配置已清除', '所有配置数据已删除，请重新配置');
}

/**
 * 清除 Cookie 缓存
 * 由于 Surge 无法枚举所有存储键，这里使用全局标志来绕过时间检查
 */
function clearCookieCache() {
    // 设置全局标志，让下次同步时绕过时间间隔检查
    $persistentStore.write('true', 'jd_bypass_interval_check');
    
    const message = `✅ 缓存已重置\n\n现在请：\n1. 访问京东 App 或网页\n2. Cookie 将立即重新抓取并同步\n3. 无需等待时间间隔`;
    
    $.notify('JD Cookie Sync', '✅ 缓存已清除', message);
}


// ============= 主菜单 =============

(async () => {
    // 根据 URL 参数决定执行的操作
    const action = $argument || 'smart-check';
    
    switch (action) {
        case 'smart-check':
            await smartConfigCheck();
            break;
        case 'clear':
            clearConfig();
            break;
        case 'clear-cache':
            clearCookieCache();
            break;
        // 保留旧的操作以兼容
        case 'show':
        case 'wizard':
        case 'test':
            await smartConfigCheck();
            break;
        default:
            $.notify('JD Cookie Sync', '未知操作', `不支持的操作: ${action}\n\n支持的操作: smart-check, clear, clear-cache`);
    }
    
    $done({});
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
        }
    };
    
    return this;
}

