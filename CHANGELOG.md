# Changelog

All notable changes to this project will be documented in this file.

## [1.0.0] - 2024-11-18

### Added
- 🎉 Initial release
- ✅ Auto-capture JD cookies from JD app
- ✅ Sync cookies to Qinglong panel via OpenAPI
- ✅ Multi-account support
- ✅ Configurable update interval (default 30 minutes)
- ✅ Persistent configuration storage
- ✅ Comprehensive error handling and logging
- ✅ Configuration helper script
- ✅ Configuration panel (optional module)
- ✅ Detailed documentation

### Features
- Cookie extraction and validation
- Qinglong API integration (auth, query, update, add)
- Smart caching mechanism to prevent duplicate updates
- User-friendly notifications
- Support for multiple JD accounts
- MITM configuration included

### Security
- Secure storage of credentials using Surge persistent store
- HTTPS support for Qinglong panel
- No credentials in code or logs

