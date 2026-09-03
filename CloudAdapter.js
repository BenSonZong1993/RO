// ============================================================
//  FILE: CloudAdapter.js
//  LAYER: services/adapters（云存储适配器——骨架，购买服务器后即插即用）
//  权限：无（仅被 CloudStorageService 调度）
//  依赖：fetch（浏览器原生）、localStorage（deviceId/token 持久化）
//  契约（异步，全部返回 Promise）：
//    init(config { baseURL, apiKey, timeout })
//    ping()                          → { status, serverTime }
//    register(deviceId, name)        → { charId, token }
//    login(deviceId)                 → { charId, token }
//    pull(charId, token)             → { data, version }
//    push(charId, token, data, ver)  → { success, version }
//    rankings(limit, offset)         → { rankings }
//    updateScore(charId, token, s)   → { success }
//  账号统一管理（username + password；RO_Cloud_Auth 扩展字段）：
//    hasAccount()                    → bool（是否处于账号登录态）
//    getAccountInfo()                → { username, charId, bound } | null
//    accountRegister(u, p)           → { success, username } | { success:false, message }
//    accountLogin(u, p, localSummary)→ { token, charId, summary, pull, conflict, bindCandidate }
//    accountBind()                   → { success, charId }（认领本设备既有角色）
//    accountLogout()                 → void（回到纯设备层）
//    charSummary()                   → { charId, summary:{level,jobKey,updatedAt,version} }
//    getSyncMeta() / saveSyncMeta()  → 同步版本/时间戳持久化（跨刷新保留）
//  生效认证解析（_auth）：账号层优先——已绑定→账号 charId+token；
//    未绑定→回退设备层（老玩家 push 不中断）；无账号→设备层（原语义）。
//  状态：请求实现已完整编写；未配置 baseURL 时所有方法返回
//        { unavailable: true }，由 CloudStorageService 决定降级。
//  对应服务端：server/server.js（零依赖 Node 服务，含账号统一管理路由）
// ============================================================
(function(global) {
    'use strict';

    var TOKEN_KEY = 'RO_Cloud_Auth';

    function _rawAuth() {
        try {
            return JSON.parse(localStorage.getItem(TOKEN_KEY) || 'null') || null;
        } catch (e) { return null; }
    }

    function _saveAuth(auth) {
        try { localStorage.setItem(TOKEN_KEY, JSON.stringify(auth)); } catch (e) {}
    }

    // 生效认证（解析视图）：账号层优先；未绑定账号回退设备层，保证推送不中断
    function _auth() {
        var a = _rawAuth();
        if (!a) return null;
        if (a.username && a.accountToken) {
            if (a.accountCharId) {
                return { charId: a.accountCharId, token: a.accountToken, account: true, username: a.username, bound: true };
            }
            if (a.devCharId && a.devToken) {
                return { charId: a.devCharId, token: a.devToken, account: true, username: a.username, bound: false };
            }
            return null;
        }
        if (a.charId && a.token) return { charId: a.charId, token: a.token, account: false };
        return null;
    }

    // 设备层登录/注册结果写盘时保留账号层扩展字段（防止覆盖丢失登录态）
    function _mergeDeviceAuth(auth) {
        if (!auth || !auth.charId || !auth.token) return auth;
        var prev = _rawAuth() || {};
        if (!(prev.username && prev.accountToken)) return auth;
        return {
            charId: auth.charId,
            token: auth.token,
            username: prev.username,
            accountToken: prev.accountToken,
            accountCharId: prev.accountCharId || null,
            devCharId: auth.charId,
            devToken: auth.token,
            syncVersion: prev.syncVersion || 0,
            syncAt: prev.syncAt || 0,
        };
    }

    function _deviceId() {
        var d = localStorage.getItem('RO_DeviceId');
        if (!d) {
            d = 'dev-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
            localStorage.setItem('RO_DeviceId', d);
        }
        return d;
    }

    function CloudAdapter(config) {
        this._baseURL = (config && config.baseURL) || '';
        this._apiKey = (config && config.apiKey) || '';
        this._timeout = (config && config.timeout) || 5000;
    }

    CloudAdapter.prototype._request = function(method, path, body) {
        var self = this;
        var controller = new AbortController();
        var timer = setTimeout(function() { controller.abort(); }, this._timeout);
        var headers = { 'Content-Type': 'application/json' };
        if (this._apiKey) headers['X-API-Key'] = this._apiKey;

        var p = fetch(this._baseURL + path, {
            method: method,
            headers: headers,
            body: body ? JSON.stringify(body) : undefined,
            signal: controller.signal,
        }).then(function(res) {
            clearTimeout(timer);
            // 先解析响应体再判状态：409 等错误需要 errCode（如 device_takeover）供上层分流
            return res.json().catch(function() { return null; }).then(function(data) {
                if (!res.ok) {
                    var err = new Error((data && data.error) || ('HTTP ' + res.status));
                    err.status = res.status;
                    err.body = data || {};
                    throw err;
                }
                return data;
            });
        }).catch(function(e) {
            clearTimeout(timer);
            throw e;
        });
        return p;
    };

    // ---- 健康检查 ----
    CloudAdapter.prototype.ping = function() {
        return this._request('GET', '/api/ping');
    };

    // ---- 注册 / 登录（deviceId 自动设备标识；写盘时保留账号层扩展字段） ----
    CloudAdapter.prototype.register = function(deviceId, name) {
        var self = this;
        return this._request('POST', '/api/auth/register', { deviceId: deviceId, name: name })
            .then(function(auth) { _saveAuth(_mergeDeviceAuth(auth)); return auth; })
            .catch(function(e) { self._lastError = e.message; return { unavailable: true }; });
    };

    CloudAdapter.prototype.login = function(deviceId) {
        var self = this;
        return this._request('POST', '/api/auth/login', { deviceId: deviceId })
            .then(function(auth) { _saveAuth(_mergeDeviceAuth(auth)); return auth; })
            .catch(function(e) { self._lastError = e.message; return { unavailable: true }; });
    };

    CloudAdapter.prototype._ensureAuth = function() {
        var auth = _auth();
        if (auth && auth.charId) return Promise.resolve(auth);
        var self = this;
        var deviceId = _deviceId();
        return this.login(deviceId).then(function(auth2) {
            if (auth2 && auth2.unavailable) return self.register(deviceId);
            return auth2;
        });
    };

    // ---- 存档拉取 / 推送 ----
    CloudAdapter.prototype.pull = function() {
        var self = this;
        return this._ensureAuth().then(function(auth) {
            if (!auth || !auth.charId) return { unavailable: true };
            return self._request('GET', '/api/char/load?charId=' + encodeURIComponent(auth.charId) +
                '&token=' + encodeURIComponent(auth.token));
        });
    };

    CloudAdapter.prototype.push = function(data, version) {
        var self = this;
        return this._ensureAuth().then(function(auth) {
            if (!auth || !auth.charId) return { unavailable: true };
            return self._request('POST', '/api/char/save', {
                charId: auth.charId, token: auth.token, data: data, version: version || 0,
                deviceId: _deviceId(),   // 账号模式服务器用它做 activeDevice 接管检查
            });
        });
    };

    // ---- 删除云端角色（存档 + 排行榜一并清除；需服务端支持） ----
    CloudAdapter.prototype.deleteAccount = function() {
        var self = this;
        return this._ensureAuth().then(function(auth) {
            if (!auth || !auth.charId) return { unavailable: true };
            return self._request('DELETE', '/api/char/delete?charId=' +
                encodeURIComponent(auth.charId) + '&token=' + encodeURIComponent(auth.token));
        });
    };

    // ---- 排行榜 ----
    CloudAdapter.prototype.rankings = function(limit, offset) {
        return this._request('GET', '/api/rankings?limit=' + (limit || 10) + '&offset=' + (offset || 0));
    };

    CloudAdapter.prototype.updateScore = function(score, level, job) {
        var self = this;
        return this._ensureAuth().then(function(auth) {
            if (!auth || !auth.charId) return { unavailable: true };
            return self._request('POST', '/api/rankings/update', {
                charId: auth.charId, token: auth.token, score: score, level: level, job: job,
            });
        });
    };

    // ============================================================
    //  账号统一管理（账号 = 自动化的导入导出；登录=自动拉取，绑定=认领旧角色）
    // ============================================================
    CloudAdapter.prototype.hasAccount = function() {
        var a = _rawAuth();
        return !!(a && a.username && a.accountToken);
    };

    CloudAdapter.prototype.getAccountInfo = function() {
        var a = _rawAuth();
        if (!a || !a.username || !a.accountToken) return null;
        return { username: a.username, charId: a.accountCharId || null, bound: !!a.accountCharId };
    };

    // 注册（服务器只建账号不建角色；客户端随后自动调用 accountLogin 走冲突流程）
    CloudAdapter.prototype.accountRegister = function(username, password) {
        var self = this;
        return this._request('POST', '/api/auth/register', { username: username, password: password })
            .then(function(res) { return { success: true, username: (res && res.username) || username }; })
            .catch(function(e) {
                self._lastError = e.message;
                return { success: false, message: e.message, status: e.status };
            });
    };

    // 登录：服务器做冲突检查（pull/conflict/bindCandidate），token 复用不轮换
    CloudAdapter.prototype.accountLogin = function(username, password, localSummary) {
        var self = this;
        return this._request('POST', '/api/auth/login', {
            username: username,
            password: password,
            deviceId: _deviceId(),
            local: localSummary || {},
        }).then(function(res) {
            var prev = _rawAuth() || {};
            var wasAccount = !!(prev.username && prev.accountToken);
            _saveAuth({
                charId: res.charId || (wasAccount ? (prev.accountCharId || prev.devCharId || null) : (prev.charId || null)),
                token: res.token,
                username: res.username,
                accountToken: res.token,
                accountCharId: res.charId || null,
                devCharId: wasAccount ? (prev.devCharId || null) : (prev.charId || null),
                devToken: wasAccount ? (prev.devToken || null) : (prev.token || null),
                syncVersion: prev.syncVersion || 0,
                syncAt: prev.syncAt || 0,
            });
            return res;
        }).catch(function(e) {
            self._lastError = e.message;
            return { success: false, message: e.message, status: e.status };
        });
    };

    // 老角色认领：把账号绑到当前设备的既有角色（charId 取设备层）
    CloudAdapter.prototype.accountBind = function() {
        var self = this;
        var a = _rawAuth();
        if (!a || !a.accountToken) return Promise.resolve({ success: false, message: '尚未登录账号' });
        if (!a.devCharId) return Promise.resolve({ success: false, message: '本设备没有既有角色可绑定' });
        return this._request('POST', '/api/auth/bind', {
            token: a.accountToken, charId: a.devCharId, deviceId: _deviceId(),
        }).then(function(res) {
            a.accountCharId = res.charId;
            a.charId = res.charId;
            _saveAuth(a);
            return { success: true, charId: res.charId };
        }).catch(function(e) {
            self._lastError = e.message;
            return { success: false, message: e.message, status: e.status };
        });
    };

    // 退出账号：恢复纯设备层（未登录玩家语义），不请求服务器
    CloudAdapter.prototype.accountLogout = function() {
        var a = _rawAuth();
        if (!a) return;
        if (a.devCharId && a.devToken) {
            _saveAuth({ charId: a.devCharId, token: a.devToken });
        } else {
            _saveAuth(null);   // 无设备层可回退：清空登录态（_rawAuth 解析 null 即视为未登录）
        }
    };

    // 云端档摘要（冲突面板/冲突比对用）
    CloudAdapter.prototype.charSummary = function() {
        var auth = _auth();
        if (!auth || !auth.account || !auth.bound) return Promise.resolve({ unavailable: true });
        return this._request('GET', '/api/char/summary?token=' + encodeURIComponent(auth.token));
    };

    // 同步元数据（版本/时间戳）持久化在 RO_Cloud_Auth 扩展字段，跨刷新保留（冲突比对依据）
    CloudAdapter.prototype.getSyncMeta = function() {
        var a = _rawAuth() || {};
        return { version: a.syncVersion || 0, updatedAt: a.syncAt || 0 };
    };

    CloudAdapter.prototype.saveSyncMeta = function(version, updatedAt) {
        var a = _rawAuth() || {};
        a.syncVersion = version || 0;
        a.syncAt = updatedAt || Date.now();
        _saveAuth(a);
    };

    // 生效身份（社交/组队用）：解析视图里的 charId+token；无任何认证时返回 null。
    // 提供两种形态：实例方法（原型）+ 构造器静态（UI/服务层免实例调用，直接读 RO_Cloud_Auth）。
    CloudAdapter.prototype.getIdentity = function() {
        var a = _auth();
        return (a && a.charId) ? { charId: a.charId, token: a.token, account: !!a.account } : null;
    };
    CloudAdapter.getIdentity = function() {
        var a = _auth();
        return (a && a.charId) ? { charId: a.charId, token: a.token, account: !!a.account } : null;
    };

    // ============================================================
    //  社交/组队（NET-1：组队相关 fetch 收口在适配器；路由见 server.js /api/social/*）
    // ============================================================
    function _socialCall(self, promise) {
        return promise.catch(function(e) {
            self._lastError = e.message;
            return { unavailable: true, message: e.message, status: e.status, body: e.body };
        });
    }

    CloudAdapter.prototype.socialHeartbeat = function(charId, token, snapshot) {
        return _socialCall(this, this._request('POST', '/api/social/heartbeat', {
            charId: charId, token: token, snapshot: snapshot || null,
        }));
    };

    CloudAdapter.prototype.socialInvite = function(fromChar, toChar, token) {
        return _socialCall(this, this._request('POST', '/api/social/invite', {
            fromChar: fromChar, toChar: toChar, token: token,
        }));
    };

    CloudAdapter.prototype.socialRespond = function(charId, token, inviteId, accept) {
        return _socialCall(this, this._request('POST', '/api/social/invite/respond', {
            charId: charId, token: token, inviteId: inviteId, accept: !!accept,
        }));
    };

    CloudAdapter.prototype.socialLeave = function(charId, token) {
        return _socialCall(this, this._request('POST', '/api/social/leave', {
            charId: charId, token: token,
        }));
    };

    CloudAdapter.prototype.socialPartnerSnapshot = function(charId, token) {
        return _socialCall(this, this._request('GET', '/api/social/partner-snapshot?charId=' +
            encodeURIComponent(charId) + '&token=' + encodeURIComponent(token)));
    };

    global.CloudAdapter = CloudAdapter;
    console.log('[CloudAdapter] ✅ 已加载（云存储适配器：deviceId 流 + 账号统一管理层）');
})(window);
