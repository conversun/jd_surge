# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Surge iOS proxy automation project that automatically captures JingDong (JD.com) cookies from the JD mobile app and syncs them to a Qinglong (青龙) automation panel. The project consists of:

- **jd_cookie_sync.js**: Main script that intercepts JD API requests, extracts cookies, and syncs to Qinglong
- **config_helper.js**: Configuration management and testing utility
- **jd_cookie_sync.sgmodule**: Surge module configuration for cookie interception
- **config_panel.sgmodule**: Optional Surge panel UI for configuration management

## Architecture

### Core Workflow

1. **Cookie Capture**: Surge intercepts JD API requests (via MITM) matching pattern `^https?://api\.m\.jd\.com/client\.action\?functionId=(wareBusiness|basicConfig)`
2. **Cookie Extraction**: Extract `pt_key` and `pt_pin` from Cookie header
3. **Cache Management**: Check if cookie needs updating based on time interval (default 30min) and cache
4. **Qinglong Sync**: Authenticate with Qinglong API → Query existing env vars → Update/Add `JD_COOKIE` environment variable
5. **Multi-Account Support**: Multiple JD accounts identified by `pt_pin`, all stored as `JD_COOKIE` (not numbered)

### Key Components

#### Surge Environment Adapter (`Env` class)
- Provides unified interface for Surge's native APIs
- Wraps `$httpClient`, `$notification`, `$persistentStore`
- Used by both main script and config helper

#### Configuration Management
- **Storage**: Uses Surge's `$persistentStore` for persistence
- **Keys**: `ql_url`, `ql_client_id`, `ql_client_secret`, `ql_update_interval`
- **Cache Keys**: `jd_cookie_cache_{ptPin}`, `jd_cookie_last_update_{ptPin}`

#### Qinglong API Integration
- **Auth**: `/open/auth/token` with client credentials
- **Query**: `/open/envs?searchValue=JD_COOKIE` to find existing cookies
- **Update**: Delete old env var (POST with `X-HTTP-Method-Override: DELETE`) then add new one
- **Add**: POST to `/open/envs` with array of env objects

### Important Design Decisions

1. **Unified Cookie Naming**: All accounts use `JD_COOKIE` (not `JD_COOKIE_2`, `JD_COOKIE_3`). Script finds duplicates by matching `pt_pin` in values
2. **Update Strategy**: Due to Surge lacking native PUT support, updates are done via DELETE then ADD
3. **Bypass Mechanism**: `jd_bypass_interval_check` flag allows immediate sync after cache clear (bypasses time interval)
4. **Duplicate Handling**: Script detects and removes all duplicate entries for same `pt_pin` before adding updated cookie

## Development Commands

### Testing Scripts Locally

Since this runs in Surge iOS environment, direct testing requires:
1. Surge iOS app with MITM configured
2. Module installed from GitHub URL or local file
3. View logs: Surge → Home → Recent Requests → Find `api.m.jd.com` requests

### Configuration via Script Editor

Test configuration setup in Surge → Tools → Scripts → Editor:

```javascript
// Set Qinglong credentials
$persistentStore.write('http://192.168.1.100:5700', 'ql_url');
$persistentStore.write('your_client_id', 'ql_client_id');
$persistentStore.write('your_client_secret', 'ql_client_secret');
$persistentStore.write('600', 'ql_update_interval'); // 10 minutes

$done()
```

Clear configuration:

```javascript
$persistentStore.write('', 'ql_url');
$persistentStore.write('', 'ql_client_id');
$persistentStore.write('', 'ql_client_secret');
$persistentStore.write('', 'ql_update_interval');
$persistentStore.write('false', 'jd_bypass_interval_check');

$done()
```

### Debugging

Enable detailed logging by checking Surge logs during JD app usage. Look for:
- `✅ 成功提取 Cookie` - Cookie extraction successful
- `⏰ 距离上次更新未满` - Update skipped due to interval
- `🔄 Cookie 值已变化` - Cookie changed, updating
- API request/response logs with `🔍` prefix

## Code Conventions

### Logging
- Use emoji prefixes for log categorization: ✅ (success), ❌ (error), ⚠️ (warning), 🔄 (processing), 🔍 (debug)
- All logs go through `$.log()` method
- Structure: `$.log(\`emoji message: details\`)`

### Async Patterns
- All HTTP operations use Promises wrapped around Surge's callback-based `$httpClient`
- Main execution in async IIFE: `(async () => { ... })();`
- Always end with `$done({})` to signal completion

### Error Handling
- Try-catch blocks around all API calls
- Graceful degradation: return `{ success: false, message: error }` objects
- User notifications via `$.notify()` for important errors

### Configuration Validation
- Always validate config completeness before API calls
- Check URL format (must start with `http://` or `https://`)
- Strip trailing slashes from URLs

## Important Constraints

### Surge API Limitations
- **No PUT requests**: Must use POST with `X-HTTP-Method-Override: DELETE` header
- **No enumeration**: Can't list all persistent store keys, so cache clearing uses bypass flag
- **Async only for HTTP**: Synchronous operations use callbacks, HTTP operations use Promises

### Security Considerations
- Cookie values contain authentication tokens (`pt_key`, `pt_pin`)
- Qinglong credentials stored in plaintext in persistent store
- MITM certificate required - sensitive data intercepted over network
- Always validate URL schemes to prevent injection

## Module File Structure

### sgmodule Format
```
#!name=Module Name
#!desc=Module Description
#!system=ios

[Script]
script_name = type=http-request|generic, pattern=regex, script-path=url, argument=args

[MITM]
hostname = %APPEND% domain.com

[Panel]
panel_name = script-name=script_name, title="Title", content="Content"
```

### Pattern Matching
- Main script triggers on specific JD API `functionId` values: `wareBusiness`, `basicConfig`
- Reduces unnecessary script executions while capturing most common JD app usage

## Working with Qinglong API

### Expected Response Format
```javascript
// Success
{ "code": 200, "data": { "token": "..." } }
{ "code": 200, "data": [{ "_id": "...", "name": "JD_COOKIE", "value": "..." }] }

// Failure
{ "code": 400, "message": "error description" }
```

### Environment Variable Structure
```javascript
{
  name: "JD_COOKIE",
  value: "pt_key=xxx;pt_pin=xxx;",
  remarks: "Account: {ptPin}" or "Added by Surge at {timestamp}"
}
```

### Authentication Flow
1. GET `/open/auth/token?client_id={id}&client_secret={secret}`
2. Extract `token` from response
3. Use `Authorization: Bearer {token}` header for subsequent requests
4. Token expires - no refresh logic, gets new token each sync

### DELETE API Requirements
**Critical**: DELETE `/open/envs` expects **integer array**, not string array
```javascript
// Correct
[28, 29, 30]

// Incorrect (will fail with "must be of type object" error)
["28", "29", "30"]
```

### Error Handling Patterns
**Unique Violation Errors**: When adding env vars with duplicate values, API returns:
```javascript
{
  code: 400,
  message: "Validation error",
  errors: [{
    type: "unique violation",
    path: "value",
    message: "value must be unique"
  }]
}
```
- Script detects this error and treats it as success (value already exists correctly)
- No user notification shown for duplicate value errors (silent handling)
- Updates cache as if sync succeeded

## Git Workflow

This is a public repository hosting Surge modules. Changes should:
1. Test locally in Surge before committing
2. Ensure GitHub raw URLs work (`https://raw.githubusercontent.com/conversun/jd_surge/main/{file}`)
3. Module installations reference raw GitHub URLs, so main branch changes affect all users immediately
