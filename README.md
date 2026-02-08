# JD Cookie Sync for Surge

自动抓取京东 APP 的 Cookie 并同步到青龙面板，实现京东 Cookie 的自动化管理。

## ✨ 功能特性

- 🚀 **自动抓取** - 打开京东 APP 自动抓取最新 Cookie
- 🔄 **智能同步** - 自动同步到青龙面板环境变量
- ⏰ **防重复更新** - 默认 30 分钟更新间隔，避免频繁同步
- 👥 **多账号支持** - 自动识别并管理多个京东账号
- 🔐 **安全可靠** - Cookie 本地缓存，敏感信息加密存储

## 📋 前置要求

- iOS 设备已安装 [Surge](https://nssurge.com/)
- 已部署 [青龙面板](https://github.com/whyour/qinglong)
- Surge 已配置 MITM 证书

## 🚀 安装步骤

### 1. 安装 Module

#### 安装主模块（必选）

在 Surge 中添加以下模块：

```
https://raw.githubusercontent.com/conversun/jd_surge/main/jd_cookie_sync.sgmodule
```

在 Quantumult X 的 `[rewrite_remote]` 中添加以下模块：

> **⚠️ 前提条件**：Quantumult X 需要先配置**资源解析器**才能解析 Surge 的 `.sgmodule` 格式。
> 
> 打开 Quantumult X 配置文件，找到 `[general]` 位置，添加以下代码：
> ```
> resource_parser_url=https://raw.githubusercontent.com/KOP-XIAO/QuantumultX/master/Scripts/resource-parser.js
> ```
> 备用地址：
> ```
> resource_parser_url=https://fastly.jsdelivr.net/gh/KOP-XIAO/QuantumultX@master/Scripts/resource-parser.js
> ```
> 参考：[QuantumultX 资源解析器说明](https://github.com/kjfx/QuantumultX)

配置好资源解析器后，在 `[rewrite_remote]` 中添加：

```
[rewrite_remote]

https://raw.githubusercontent.com/conversun/jd_surge/main/jd_cookie_sync.sgmodule, tag=自动同步京东cookie(qinglong), update-interval=86400, opt-parser=true, enabled=true
```

#### 安装配置面板（可选）

如需在 Surge 面板中查看配置状态，可安装配置面板模块：

```
https://raw.githubusercontent.com/conversun/jd_surge/main/config_panel.sgmodule
```

如需在 Quantumult X 面板中查看配置状态，可在`[task_local]`中添加：

```
[task_local]

#可进入 设置 -> HTTP请求，在请求列表中手动执行
#如需定时执行，可在设置好时间后，将enabled设置为true

#查看配置信息和状态
0 0 * * * https://raw.githubusercontent.com/conversun/jd_surge/refs/heads/main/Scripts/QuantumultX/smart_check.js, tag=smart-check, enabled=false
# 点击后不会立即清理，需重新启动JD自动替换
0 0 * * * https://raw.githubusercontent.com/conversun/jd_surge/refs/heads/main/Scripts/QuantumultX/clear_cache.js, tag=清理Cookie缓存, enabled=false
# [!慎点!] 删除青龙相关配置参数(ql_url、ql_client_id、ql_client_secret、ql_update_interval等)，清理后需重新配置
0 0 * * * https://raw.githubusercontent.com/conversun/jd_surge/refs/heads/main/Scripts/QuantumultX/clear.js, tag=清理青龙配置参数, enabled=false

```

### 2. 配置青龙面板信息

在 Surge App 中：

1. 点击底部 **"工具"** 标签
2. 选择 **"脚本"** → **"编辑器"**
3. 在编辑器中输入以下代码并执行：

**示例：**

```javascript
// Surge
$persistentStore.write('http://192.168.1.100:5700', 'ql_url');
$persistentStore.write('abc123', 'ql_client_id');
$persistentStore.write('xyz789', 'ql_client_secret');

$done()
```

在 Quantumult X 中：

1. 点击底部 **"构造请求"** 按钮或点击右下角 **"风车"** 按钮进入设置页面，打开 **"HTTP请求"**
2. 点击 **"右下角按钮"** → **"编辑器"**
3. 在编辑器中输入以下代码并执行：

**示例：**

```javascript
// Quantumult X
$prefs.setValueForKey('http://192.168.1.100:5700', 'ql_url');
$prefs.setValueForKey('abc123', 'ql_client_id');
$prefs.setValueForKey('xyz789', 'ql_client_secret');

$done()
```


**参数说明：**

- `ql_url`: 青龙面板地址（如：`http://192.168.1.100:5700` 或 `https://ql.example.com`）
- `ql_client_id`: 青龙应用的 Client ID
- `ql_client_secret`: 青龙应用的 Client Secret


### 3. 获取 Cookie

打开京东 APP，随意浏览商品或进入"我的"页面，脚本会自动抓取 Cookie 并同步到青龙面板。

首次同步成功后会收到通知：

```
✅ 同步成功
账号: your_jd_account
已同步到青龙面板
```

## 🔑 获取青龙应用凭证

1. 登录青龙面板
2. 进入 **"系统设置"** → **"应用设置"**
3. 点击 **"新建应用"**
4. 输入应用名称（如：`Surge`），选择权限（需要 **环境变量** 权限）
5. 保存后获得 `Client ID` 和 `Client Secret`

## ⚙️ 可选配置

### 自定义更新间隔

默认更新间隔为 30 分钟（1800 秒），可自定义：

```javascript
// Surge
// 设置为 10 分钟（600 秒）
$persistentStore.write('600', 'ql_update_interval');

$done()

// Quantumult X
// 设置为 10 分钟（600 秒）
$prefs.setValueForKey('600', 'ql_update_interval');

$done()
```

### 清除配置

如需清除所有配置：

```javascript
// Surge
$persistentStore.write('', 'ql_url');
$persistentStore.write('', 'ql_client_id');
$persistentStore.write('', 'ql_client_secret');
$persistentStore.write('', 'ql_update_interval');

$done()

// Quantumult X
$prefs.setValueForKey('', 'ql_url');
$prefs.setValueForKey('', 'ql_client_id');
$prefs.setValueForKey('', 'ql_client_secret');
$prefs.setValueForKey('', 'ql_update_interval');

$done()
```

## 📱 使用配置面板（可选）

如果安装了 `config_panel.sgmodule`，可在 Surge 面板中：

- **查看配置状态** - 显示当前配置信息
- **配置向导** - 查看配置步骤说明
- **测试连接** - 测试青龙面板连接是否正常

## 🔍 常见问题

### 为什么没有同步？

1. 检查是否正确配置了青龙面板信息
2. 确认青龙面板地址可以访问
3. 查看 Surge 日志中是否有错误信息
4. 确认 Surge 已启用 MITM 并信任证书

### Cookie 多久更新一次？

默认 30 分钟内不会重复同步相同账号，可通过 `ql_update_interval` 自定义。

### 支持多账号吗？

支持。脚本会自动识别不同的京东账号（pt_pin），并分别管理。青龙面板中会创建 `JD_COOKIE`、`JD_COOKIE_2`、`JD_COOKIE_3` 等环境变量。

### 如何查看同步日志？

在 Surge 中：**首页** → **最近请求** → 找到 `api.m.jd.com` 的请求 → 查看日志。

## 🛡️ 隐私与安全

- Cookie 仅存储在本地 Surge 持久化存储和您的青龙面板中
- 不会上传到任何第三方服务器
- 建议使用 HTTPS 连接青龙面板
- 定期检查并更新 Cookie

## 📄 License

MIT License

## 🙏 致谢

感谢所有为京东自动化脚本做出贡献的开发者。

---

如有问题或建议，欢迎提交 Issue 或 Pull Request。

