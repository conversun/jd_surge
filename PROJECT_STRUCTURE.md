# Project Structure

项目文件结构说明

## 核心文件（必需）

### `jd_cookie_sync.sgmodule`
Surge Module 配置文件，这是项目的入口文件。

**功能**：
- 定义拦截规则（`api.m.jd.com`）
- 引用主脚本 `jd_cookie_sync.js`
- 配置 MITM 主机名

**安装方式**：
- Surge → 模块 → 安装新模块

### `jd_cookie_sync.js`
核心处理脚本，包含所有主要逻辑。

**功能模块**：
1. **配置管理**
   - `getConfig()` - 读取配置
   - `checkConfig()` - 验证配置

2. **Cookie 处理**
   - `extractCookie()` - 提取 Cookie
   - `shouldUpdate()` - 判断是否更新
   - `updateCache()` - 更新缓存

3. **青龙 API**
   - `getQinglongToken()` - 获取认证 Token
   - `getEnvList()` - 查询环境变量
   - `updateEnv()` - 更新环境变量
   - `addEnv()` - 新增环境变量

4. **主流程**
   - `syncToQinglong()` - 同步到青龙
   - 主函数 - 请求拦截处理

## 辅助文件（可选）

### `config_helper.js`
配置助手脚本，提供配置管理功能。

**功能**：
- `showCurrentConfig()` - 显示当前配置
- `configWizard()` - 配置向导
- `testConfig()` - 测试配置
- `clearConfig()` - 清除配置

**使用方式**：
```
Surge 脚本编辑器中运行，或通过 config_panel.sgmodule 使用
```

### `config_panel.sgmodule`
配置面板 Module，提供可视化配置界面。

**功能**：
- 在 Surge 首页显示配置状态
- 提供快捷配置操作
- 一键测试连接

**安装方式**：
```
Surge → 模块 → 安装新模块（可选安装）
```

## 文档文件

### `README.md`
完整的使用说明文档。

**内容**：
- 功能介绍
- 详细的安装步骤
- 配置方法
- 常见问题
- 故障排查
- 技术细节

### `QUICK_START.md`
快速开始指南，5 分钟快速配置。

**内容**：
- 简化的安装步骤
- 配置示例
- 快速验证方法

### `CHANGELOG.md`
更新日志，记录版本变更。

## 配置文件

### `.gitignore`
Git 忽略文件列表。

**忽略内容**：
- macOS 系统文件
- IDE 配置
- 私有配置文件
- 计划文件

### `LICENSE`
MIT 开源协议。

## 目录结构

```
jd_surge/
├── jd_cookie_sync.sgmodule      # [核心] 主 Module 配置
├── jd_cookie_sync.js            # [核心] 主处理脚本
├── config_helper.js             # [可选] 配置助手脚本
├── config_panel.sgmodule        # [可选] 配置面板 Module
├── README.md                    # [文档] 完整使用说明
├── QUICK_START.md               # [文档] 快速开始指南
├── CHANGELOG.md                 # [文档] 更新日志
├── PROJECT_STRUCTURE.md         # [文档] 项目结构说明（本文件）
├── LICENSE                      # [协议] MIT 开源协议
└── .gitignore                   # [配置] Git 忽略规则
```

## 安装组合建议

### 最小安装（推荐新手）
```
jd_cookie_sync.sgmodule
jd_cookie_sync.js
```

只需这两个文件即可正常工作。

### 完整安装（推荐进阶用户）
```
jd_cookie_sync.sgmodule      # 主功能
jd_cookie_sync.js           # 主脚本
config_panel.sgmodule        # 配置面板
config_helper.js            # 配置助手
```

提供更好的配置管理体验。

## 数据流向

```
京东 APP
    ↓ HTTP Request
Surge 拦截 (jd_cookie_sync.sgmodule)
    ↓ 触发脚本
jd_cookie_sync.js
    ↓ 提取 Cookie
验证 & 缓存检查
    ↓ 需要更新
读取配置 ($persistentStore)
    ↓ 调用 API
青龙面板 (/open/auth/token)
    ↓ 获取 Token
青龙面板 (/open/envs)
    ↓ 查询现有变量
青龙面板 (/open/envs PUT/POST)
    ↓ 更新/新增
更新缓存 & 通知用户
```

## 配置存储

所有配置使用 Surge 持久化存储 (`$persistentStore`)：

| Key | 说明 | 必需 | 示例 |
|-----|------|------|------|
| `ql_url` | 青龙面板地址 | ✅ | `https://ql.example.com` |
| `ql_client_id` | Client ID | ✅ | `abc123-def456` |
| `ql_client_secret` | Client Secret | ✅ | `xyz789uvw456` |
| `ql_update_interval` | 更新间隔（秒） | ❌ | `1800` |
| `jd_cookie_cache_{ptPin}` | Cookie 缓存 | 自动 | `pt_key=...` |
| `jd_cookie_last_update_{ptPin}` | 上次更新时间 | 自动 | `1700000000000` |

## 青龙 API 端点

脚本使用以下青龙 OpenAPI v2.0 端点：

| 端点 | 方法 | 功能 |
|------|------|------|
| `/open/auth/token` | GET | 获取认证 Token |
| `/open/envs` | GET | 查询环境变量列表 |
| `/open/envs` | PUT | 更新环境变量 |
| `/open/envs` | POST | 新增环境变量 |

## 开发说明

### 修改拦截规则

编辑 `jd_cookie_sync.sgmodule`：

```ini
[Script]
jd_cookie_sync = type=http-request,pattern=你的正则表达式,script-path=jd_cookie_sync.js
```

### 调整更新间隔默认值

编辑 `jd_cookie_sync.js`：

```javascript
updateInterval: parseInt($persistentStore.read('ql_update_interval') || '你的默认值')
```

### 添加更多 Cookie 字段

修改 `extractCookie()` 函数：

```javascript
const additionalField = cookieHeader.match(/field_name=([^;]+)/);
```

### 调试

在脚本中添加更多日志：

```javascript
$.log(`调试信息: ${variable}`);
```

查看日志：
```
Surge → 最近请求 → 找到对应请求 → 查看详情
```

## 依赖说明

- **Surge iOS**: 必需（v4.0+）
- **青龙面板**: 必需（v2.10+）
- **MITM 证书**: 必需
- **网络连接**: 手机需能访问青龙面板

## 安全建议

1. **保护配置**：不要将含有 Client Secret 的配置文件上传到公开仓库
2. **使用 HTTPS**：青龙面板务必使用 HTTPS
3. **定期更换**：定期更换 Client ID 和 Secret
4. **最小权限**：青龙应用只授予必要权限

## 性能优化

1. **缓存机制**：避免频繁 API 调用
2. **更新间隔**：默认 30 分钟，可根据需要调整
3. **异步处理**：使用 async/await 避免阻塞
4. **超时控制**：HTTP 请求设置 10 秒超时

## 常见修改

### 修改通知内容

编辑 `jd_cookie_sync.js` 中的 `$.notify()` 调用。

### 添加更多青龙操作

参考现有的 API 调用函数，添加新的操作函数。

### 支持其他平台 Cookie

复制项目并修改：
1. 拦截规则（域名）
2. Cookie 提取逻辑
3. 环境变量名称

## 更多信息

- 查看 [README.md](README.md) 了解详细使用说明
- 查看 [QUICK_START.md](QUICK_START.md) 快速开始
- 查看 [CHANGELOG.md](CHANGELOG.md) 了解版本历史

