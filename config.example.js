/**
 * 配置示例文件
 * 
 * 使用说明：
 * 1. 在 Surge 脚本编辑器中运行此脚本
 * 2. 或在 Safari 中使用 URL Scheme
 * 3. 或使用 iOS 快捷指令
 */

// ============= 方法 1: 直接在脚本编辑器运行 =============

// 第一步：配置青龙面板地址（必需）
// 注意：请使用完整的 URL，包含 http:// 或 https://，不要在末尾加斜杠
$persistentStore.write('https://your-qinglong-domain.com', 'ql_url');

// 第二步：配置 Client ID（必需）
// 从青龙面板 系统设置 → 应用设置 中获取
$persistentStore.write('your_client_id_here', 'ql_client_id');

// 第三步：配置 Client Secret（必需）
// 从青龙面板 系统设置 → 应用设置 中获取
$persistentStore.write('your_client_secret_here', 'ql_client_secret');

// 第四步：配置更新间隔（可选）
// 单位：秒，默认 1800 秒（30 分钟）
$persistentStore.write('1800', 'ql_update_interval');

// 完成后会在控制台输出
console.log('✅ 配置完成！');
console.log('青龙地址:', $persistentStore.read('ql_url'));
console.log('Client ID:', $persistentStore.read('ql_client_id'));
console.log('更新间隔:', $persistentStore.read('ql_update_interval'), '秒');

// ============= 方法 2: 使用 URL Scheme =============

/**
 * 在 Safari 中依次打开以下链接（替换为你的实际信息）：
 * 
 * 1. 配置青龙地址：
 *    surge:///write-persistent-store?key=ql_url&value=https://your-qinglong-domain.com
 * 
 * 2. 配置 Client ID：
 *    surge:///write-persistent-store?key=ql_client_id&value=your_client_id_here
 * 
 * 3. 配置 Client Secret：
 *    surge:///write-persistent-store?key=ql_client_secret&value=your_client_secret_here
 * 
 * 4. 配置更新间隔（可选）：
 *    surge:///write-persistent-store?key=ql_update_interval&value=1800
 */

// ============= 方法 3: iOS 快捷指令 =============

/**
 * 创建一个快捷指令，包含以下步骤：
 * 
 * 1. 添加动作：打开 URL
 *    URL: surge:///write-persistent-store?key=ql_url&value=https://your-qinglong-domain.com
 * 
 * 2. 添加动作：打开 URL
 *    URL: surge:///write-persistent-store?key=ql_client_id&value=your_client_id_here
 * 
 * 3. 添加动作：打开 URL
 *    URL: surge:///write-persistent-store?key=ql_client_secret&value=your_client_secret_here
 * 
 * 4. 添加动作：打开 URL（可选）
 *    URL: surge:///write-persistent-store?key=ql_update_interval&value=1800
 * 
 * 运行此快捷指令即可一键配置！
 */

// ============= 实际配置示例 =============

/**
 * 假设你的青龙面板信息如下：
 * - 地址：https://ql.example.com
 * - Client ID: abc123-def456-ghi789
 * - Client Secret: xyz789-uvw456-rst123
 * 
 * 那么配置代码为：
 */

/*
$persistentStore.write('https://ql.example.com', 'ql_url');
$persistentStore.write('abc123-def456-ghi789', 'ql_client_id');
$persistentStore.write('xyz789-uvw456-rst123', 'ql_client_secret');
$persistentStore.write('1800', 'ql_update_interval'); // 30 分钟
*/

// ============= 验证配置 =============

/**
 * 配置完成后，运行以下代码验证：
 */

/*
console.log('=== 当前配置 ===');
console.log('青龙地址:', $persistentStore.read('ql_url'));
console.log('Client ID:', $persistentStore.read('ql_client_id'));
console.log('Client Secret:', $persistentStore.read('ql_client_secret') ? '已设置（已隐藏）' : '未设置');
console.log('更新间隔:', $persistentStore.read('ql_update_interval') || '1800', '秒');

// 检查配置是否完整
const isComplete = $persistentStore.read('ql_url') && 
                   $persistentStore.read('ql_client_id') && 
                   $persistentStore.read('ql_client_secret');
                   
console.log('配置状态:', isComplete ? '✅ 完整' : '❌ 不完整');
*/

// ============= 清除配置 =============

/**
 * 如需清除所有配置，运行以下代码：
 */

/*
$persistentStore.write('', 'ql_url');
$persistentStore.write('', 'ql_client_id');
$persistentStore.write('', 'ql_client_secret');
$persistentStore.write('', 'ql_update_interval');
console.log('✅ 配置已清除');
*/

// ============= 更新间隔参考 =============

/**
 * 常用的更新间隔值：
 * - 15 分钟: 900
 * - 30 分钟: 1800 (默认)
 * - 1 小时: 3600
 * - 2 小时: 7200
 * - 6 小时: 21600
 * - 12 小时: 43200
 * - 24 小时: 86400
 */

