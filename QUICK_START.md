# Quick Start Guide

快速开始指南，5 分钟内完成配置。

## 前置要求

- ✅ 已安装 Surge for iOS
- ✅ 已部署青龙面板（可从手机访问）
- ✅ 已创建青龙应用并获取 Client ID 和 Secret

## 快速安装

### 步骤 1：获取青龙凭证（2 分钟）

1. 登录青龙面板
2. 进入 **系统设置** → **应用设置**
3. 点击 **新建应用**
4. 应用名称：`Surge Cookie Sync`
5. 权限勾选：**环境变量**
6. 保存后复制 `Client ID` 和 `Client Secret`

### 步骤 2：安装 Module（1 分钟）

#### 选项 A：本地安装

1. 将 `jd_cookie_sync.sgmodule` 和 `jd_cookie_sync.js` 保存到 iCloud Drive
2. Surge → **模块** → **安装新模块** → **从文件安装**

#### 选项 B：远程安装（如果你托管在 GitHub）

```
Surge → 模块 → 安装新模块 → 输入 URL
```

### 步骤 3：配置 MITM（30 秒）

1. Surge → **更多** → **MITM**
2. 开启 **MITM**
3. 如果是首次使用，安装并信任证书

### 步骤 4：配置青龙连接（1 分钟）

#### 方法 1：URL Scheme（推荐 - 最简单）

在 Safari 中依次打开以下链接（替换为你的信息）：

```
surge:///write-persistent-store?key=ql_url&value=https://你的青龙地址.com
```

```
surge:///write-persistent-store?key=ql_client_id&value=你的CLIENT_ID
```

```
surge:///write-persistent-store?key=ql_client_secret&value=你的CLIENT_SECRET
```

#### 方法 2：快捷指令

创建 iOS 快捷指令，包含以上三个 URL 操作，一键配置。

#### 方法 3：脚本编辑器（Mac）

在 Surge Dashboard 的脚本编辑器中运行：

```javascript
$persistentStore.write('https://你的青龙地址.com', 'ql_url');
$persistentStore.write('你的CLIENT_ID', 'ql_client_id');
$persistentStore.write('你的CLIENT_SECRET', 'ql_client_secret');
```

### 步骤 5：测试（30 秒）

1. 打开京东 APP
2. 随便浏览一下（首页、我的等）
3. 查看 Surge 通知
4. 登录青龙面板，检查 **环境变量** 是否有 `JD_COOKIE`

## 配置测试（可选）

### 安装配置助手

安装 `config_panel.sgmodule`（可选），提供可视化配置管理：

- 📊 查看当前配置状态
- 📖 配置向导
- 🧪 测试连接
- 🗑️ 清除配置

## 配置示例

假设你的青龙面板：
- 地址：`https://ql.example.com`
- Client ID: `abc123-def456-ghi789`
- Client Secret: `xyz789uvw456rst123`

### URL Scheme 配置

```
surge:///write-persistent-store?key=ql_url&value=https://ql.example.com

surge:///write-persistent-store?key=ql_client_id&value=abc123-def456-ghi789

surge:///write-persistent-store?key=ql_client_secret&value=xyz789uvw456rst123
```

### 脚本配置

```javascript
$persistentStore.write('https://ql.example.com', 'ql_url');
$persistentStore.write('abc123-def456-ghi789', 'ql_client_id');
$persistentStore.write('xyz789uvw456rst123', 'ql_client_secret');
```

## 常见配置错误

### ❌ 错误 1：青龙地址末尾有斜杠

```
❌ https://ql.example.com/
✅ https://ql.example.com
```

### ❌ 错误 2：青龙地址缺少协议

```
❌ ql.example.com
✅ https://ql.example.com
```

### ❌ 错误 3：Client ID/Secret 有空格

确保复制的凭证没有多余的空格。

## 验证配置

### 方法 1：使用配置助手（如果安装了）

Surge → 首页面板 → 点击 "JD Cookie Sync" → 点击 "测试配置"

### 方法 2：手动测试

在浏览器访问（替换为你的信息）：

```
https://你的青龙地址.com/open/auth/token?client_id=你的CLIENT_ID&client_secret=你的CLIENT_SECRET
```

如果返回包含 `token` 的 JSON，说明配置正确：

```json
{
  "code": 200,
  "data": {
    "token": "eyJhbGc...",
    "token_type": "Bearer",
    "expiration": 1234567890
  }
}
```

## 使用技巧

### 技巧 1：查看详细日志

Surge → 最近请求 → 找到 `api.m.jd.com` → 查看详情

### 技巧 2：调整更新间隔

如果想更频繁地更新（不推荐太频繁）：

```javascript
// 15 分钟
$persistentStore.write('900', 'ql_update_interval');

// 1 小时
$persistentStore.write('3600', 'ql_update_interval');
```

### 技巧 3：多账号管理

在京东 APP 中切换账号后，随便浏览一下，脚本会自动创建新的环境变量。

### 技巧 4：查看当前配置

在脚本编辑器中运行：

```javascript
console.log('URL:', $persistentStore.read('ql_url'));
console.log('ID:', $persistentStore.read('ql_client_id'));
```

## 下一步

配置完成后：

1. ✅ 正常使用京东 APP，Cookie 会自动同步
2. ✅ 在青龙面板查看和管理 Cookie
3. ✅ 享受自动化的便利！

## 需要帮助？

查看完整文档：[README.md](README.md)

遇到问题？查看：[常见问题](README.md#常见问题)

