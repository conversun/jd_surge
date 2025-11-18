# JD Cookie Sync to Qinglong

自动抓取京东 APP Cookie 并同步到青龙面板的 Surge Module。

## 快速安装

### 从 GitHub 一键安装（推荐 ⭐）

在 Surge 中添加 Module：

```
https://raw.githubusercontent.com/YOUR_USERNAME/jd_surge/main/jd_cookie_sync.sgmodule
```

或在 Safari 中打开一键安装：

```
surge:///install-module?url=https://raw.githubusercontent.com/YOUR_USERNAME/jd_surge/main/jd_cookie_sync.sgmodule
```

> 💡 将 `YOUR_USERNAME` 替换为你的 GitHub 用户名

📖 **详细文档**：
- [5 分钟快速开始](QUICK_START.md)
- [GitHub 远程安装指南](GITHUB_INSTALL.md)

## 功能特点

- ✅ 自动拦截京东 APP 请求，提取 Cookie
- ✅ 智能同步到青龙面板环境变量
- ✅ 支持多账号管理
- ✅ 防重复更新机制（可配置更新间隔）
- ✅ 详细的日志和通知
- ✅ 配置持久化存储

## 工作原理

```
京东APP发起请求 → Surge拦截 → 提取Cookie → 验证有效性 → 调用青龙API → 更新环境变量 → 通知结果
```

## 安装步骤

### 1. 准备青龙面板

确保你的青龙面板：
- 已部署并可通过公网访问（或手机能访问的网络）
- 已创建应用并获取 `Client ID` 和 `Client Secret`

#### 获取 Client ID 和 Client Secret

1. 登录青龙面板
2. 进入 **系统设置** → **应用设置**
3. 点击 **新建应用**
4. 设置应用名称（如 `Surge Cookie Sync`）
5. 权限选择：**环境变量**
6. 保存后会显示 `Client ID` 和 `Client Secret`，请妥善保存

### 2. 安装 Surge Module

#### 方式一：远程安装（推荐 ⭐）

从 GitHub 直接安装，自动获取更新：

1. 在 Surge 中：
   - 点击底部 **模块** 标签
   - 点击右上角 **安装新模块**
   - 输入 Module URL：
   ```
   https://raw.githubusercontent.com/YOUR_USERNAME/jd_surge/main/jd_cookie_sync.sgmodule
   ```
   - 点击 **确定**

2. 或在 Safari 中打开一键安装链接：
   ```
   surge:///install-module?url=https://raw.githubusercontent.com/YOUR_USERNAME/jd_surge/main/jd_cookie_sync.sgmodule
   ```

> 💡 将 `YOUR_USERNAME` 替换为实际的 GitHub 用户名

**优势**：
- ✅ 一次配置，长期使用
- ✅ Surge 自动检查更新
- ✅ 无需手动下载文件

详细说明请查看：[GitHub 安装指南](GITHUB_INSTALL.md)

#### 方式二：本地安装

如果无法访问 GitHub 或需要自定义修改：

1. 下载 `jd_cookie_sync.sgmodule` 和 `jd_cookie_sync.js` 到本地
2. 在 Surge 中：
   - 点击底部 **模块** 标签
   - 点击右上角 **安装新模块**
   - 选择 **从文件安装**，选择 `jd_cookie_sync.sgmodule`

### 3. 配置 MITM

确保 Surge 已启用 MITM 并信任证书：

1. Surge → **更多** → **MITM**
2. 开启 **MITM**
3. 安装并信任证书（按照提示操作）
4. 确认 `api.m.jd.com` 在 MITM 主机名列表中（Module 已自动添加）

### 4. 配置青龙连接信息

Module 安装后需要配置青龙面板连接信息。有三种配置方式：

#### 方式一：通过脚本编辑器（推荐）

1. Surge → **首页** → 点击模块名称
2. 在脚本编辑器中找到配置初始化部分
3. 直接运行以下代码配置（在 Surge 的脚本编辑器或 Safari 中）：

```javascript
// 打开 Safari，访问以下 URL（替换为你的信息）
surge:///write-persistent-store?key=ql_url&value=https://your-qinglong-domain.com

surge:///write-persistent-store?key=ql_client_id&value=YOUR_CLIENT_ID

surge:///write-persistent-store?key=ql_client_secret&value=YOUR_CLIENT_SECRET

// 可选：设置更新间隔（秒），默认 1800 秒（30分钟）
surge:///write-persistent-store?key=ql_update_interval&value=1800
```

#### 方式二：使用 Surge 的开发者工具

1. 在 Mac 上打开 Surge Dashboard
2. 切换到 **工具** → **脚本编辑器**
3. 运行以下代码：

```javascript
$persistentStore.write('https://your-qinglong-domain.com', 'ql_url');
$persistentStore.write('YOUR_CLIENT_ID', 'ql_client_id');
$persistentStore.write('YOUR_CLIENT_SECRET', 'ql_client_secret');
$persistentStore.write('1800', 'ql_update_interval'); // 可选
```

#### 方式三：通过快捷指令（iOS）

创建一个 iOS 快捷指令，使用 URL Scheme 写入配置：

```
打开 URL: surge:///write-persistent-store?key=ql_url&value=https://your-qinglong-domain.com
打开 URL: surge:///write-persistent-store?key=ql_client_id&value=YOUR_CLIENT_ID
打开 URL: surge:///write-persistent-store?key=ql_client_secret&value=YOUR_CLIENT_SECRET
```

### 5. 测试配置

1. 打开京东 APP
2. 随便浏览一些页面（如首页、我的等）
3. 查看 Surge 通知，应该会显示同步成功或配置错误的提示
4. 登录青龙面板，在 **环境变量** 中查看是否已添加/更新 `JD_COOKIE`

## 使用说明

### 日常使用

安装配置完成后，只需：

1. 确保 Surge 处于运行状态
2. 正常使用京东 APP
3. Cookie 会自动在后台同步到青龙面板
4. 首次同步或距离上次同步超过配置的时间间隔时才会执行更新

### 多账号支持

如果你有多个京东账号：

1. 在京东 APP 中切换账号
2. 随便浏览一些页面
3. 脚本会自动识别不同的 `pt_pin` 并创建不同的环境变量：
   - 第一个账号：`JD_COOKIE`
   - 第二个账号：`JD_COOKIE_2`
   - 第三个账号：`JD_COOKIE_3`
   - 以此类推...

### 查看日志

在 Surge 中查看详细日志：

1. Surge → **最近请求**
2. 找到 `api.m.jd.com` 的请求
3. 点击查看详情，可以看到脚本执行日志

## 配置参数说明

| 参数 | 说明 | 必填 | 默认值 |
|-----|------|------|--------|
| `ql_url` | 青龙面板地址（含协议，不含末尾斜杠）| ✅ | 无 |
| `ql_client_id` | 青龙应用 Client ID | ✅ | 无 |
| `ql_client_secret` | 青龙应用 Client Secret | ✅ | 无 |
| `ql_update_interval` | 更新间隔（秒） | ❌ | 1800 (30分钟) |

### 配置示例

```
ql_url: https://ql.example.com
ql_client_id: abcd1234-efgh-5678-ijkl-9012mnop3456
ql_client_secret: Xyzabc123DEFghi456JKLmno789PQRstu
ql_update_interval: 1800
```

## 常见问题

### Q1: 提示"配置不完整"

**A:** 请确保已正确配置 `ql_url`、`ql_client_id` 和 `ql_client_secret` 三个参数。可以通过上述任一配置方式重新设置。

### Q2: 提示"获取 Token 失败"

**A:** 可能的原因：
- 青龙面板地址不正确或无法访问
- Client ID 或 Client Secret 错误
- 青龙面板应用权限不足

**解决方案：**
1. 检查青龙面板地址是否可访问（在手机浏览器中测试）
2. 重新检查 Client ID 和 Secret 是否正确
3. 确认应用已授予 **环境变量** 权限

### Q3: 提示"同步失败"

**A:** 查看详细错误信息，常见原因：
- 网络问题（青龙面板无法访问）
- Token 过期（重新获取即可）
- API 调用限制

### Q4: Cookie 没有自动更新

**A:** 检查以下几点：
1. Surge 是否正常运行
2. MITM 是否已启用并信任证书
3. 是否在更新间隔时间内（默认 30 分钟）
4. 京东 APP 是否有网络请求（可以刷新页面）

### Q5: 如何修改更新间隔

**A:** 修改 `ql_update_interval` 的值，单位为秒：
- 15 分钟：900
- 30 分钟：1800（默认）
- 1 小时：3600
- 2 小时：7200

### Q6: 如何查看当前配置

**A:** 在 Surge 脚本编辑器中运行：

```javascript
console.log('ql_url:', $persistentStore.read('ql_url'));
console.log('ql_client_id:', $persistentStore.read('ql_client_id'));
console.log('ql_update_interval:', $persistentStore.read('ql_update_interval'));
```

### Q7: 青龙面板需要开放哪些端口

**A:** 只需要开放青龙面板的 Web 端口（通常是 5700），确保手机可以通过该端口访问青龙面板即可。

### Q8: 支持 Shadowrocket、Quantumult X 等其他工具吗

**A:** 本 Module 专为 Surge 设计，不支持其他工具。如需在其他工具使用，需要修改脚本适配对应的 API。

## 安全建议

1. **保护好你的 Client Secret**：不要分享给他人，不要上传到公开仓库
2. **使用 HTTPS**：确保青龙面板使用 HTTPS 协议（推荐使用 Cloudflare Tunnel 或反向代理）
3. **定期更换密钥**：建议定期在青龙面板重新生成 Client ID 和 Secret
4. **限制应用权限**：青龙应用只授予必要的权限（环境变量）

## 故障排查

如果遇到问题，按以下步骤排查：

1. **检查配置**：确认三个必填参数都已正确配置
2. **测试网络**：在手机浏览器访问青龙面板地址，确认可访问
3. **查看日志**：在 Surge 最近请求中查看脚本执行日志
4. **手动测试**：使用 Postman 或 curl 测试青龙 API 是否正常
5. **重新配置**：删除持久化数据并重新配置

### 清除配置数据

如需重新配置，可运行以下代码清除所有配置：

```javascript
$persistentStore.write('', 'ql_url');
$persistentStore.write('', 'ql_client_id');
$persistentStore.write('', 'ql_client_secret');
$persistentStore.write('', 'ql_update_interval');
```

## 技术细节

### 拦截规则

脚本拦截以下京东 API 请求：
```
^https?://api\.m\.jd\.com/client\.action.*
```

### Cookie 格式

京东 Cookie 主要包含两个关键字段：
- `pt_key`：用户凭证密钥
- `pt_pin`：用户标识（账号）

### 青龙 API

使用青龙 OpenAPI v2.0：
- `GET /open/auth/token` - 获取认证 Token
- `GET /open/envs` - 查询环境变量
- `PUT /open/envs` - 更新环境变量
- `POST /open/envs` - 新增环境变量

### 缓存机制

为避免频繁更新，脚本实现了缓存机制：
- 缓存每个账号的 Cookie
- 记录上次更新时间
- 只有超过配置的更新间隔才会执行同步

## 更新日志

### v1.0.0 (2024-11-18)

- 🎉 首次发布
- ✅ 支持自动抓取京东 Cookie
- ✅ 支持同步到青龙面板
- ✅ 支持多账号管理
- ✅ 支持配置更新间隔
- ✅ 完善的错误处理和日志

## 许可证

MIT License

## 免责声明

本项目仅供学习交流使用，请勿用于非法用途。使用本项目所产生的一切后果由使用者自行承担。

## 相关链接

- [项目主页](https://github.com/YOUR_USERNAME/jd_surge) - 替换为你的仓库地址
- [问题反馈](https://github.com/YOUR_USERNAME/jd_surge/issues)
- [版本发布](https://github.com/YOUR_USERNAME/jd_surge/releases)
- [青龙面板](https://github.com/whyour/qinglong)
- [Surge 官网](https://nssurge.com/)
- [Surge 脚本文档](https://manual.nssurge.com/scripting/common.html)

## 贡献

欢迎提交 Issue 和 Pull Request！

### 如何贡献

1. Fork 本项目
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 提交 Pull Request

### 问题反馈

如有问题或建议，请在 [GitHub Issues](https://github.com/YOUR_USERNAME/jd_surge/issues) 中反馈。

**反馈时请提供**：
- 问题描述和复现步骤
- Surge 版本
- 错误日志（如有）
- 相关配置信息

