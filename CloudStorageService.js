// ============================================================
//  FILE: CloudStorageService.js
//  LAYER: services（存储调度中心——本地优先、云端同步、自动降级）
//  权限：无（仅被 Repository 层调用，业务模块禁止直连）
//  依赖：LocalStorageAdapter（镜像/降级后端）、CloudAdapter（云端，可选）、
//        PersistenceManager（经 LocalStorageAdapter 间接使用）、ConfigProfiles
//  设计（本地优先模式，Repository 同步接口零改动）：
//    - 本地适配器始终是同步主存储（离线可玩，读写在本地即时生效）；
//    - mode='cloud' 时：写操作标记脏分节，由防抖队列异步推送到服务器
//      （write-behind）；推送失败自动重试，绝不阻塞游戏；
//    - 首次云模式启动：自动拉取服务器存档写入本地后刷新一次页面
//      （一次性引导，换机/重装自动恢复进度）；
//    - 云不可达：自动降级纯本地，恢复后队列继续推送。
//  模式切换（任一即可，URL 参数优先）：
//    1) URL 参数：index.html?mode=cloud&server=http://your-server:3000
//    2) ConfigProfiles：default.network = { adapter:'cloud', cloud:{ baseURL... } }
//  契约（对 Repository 保持 v1 同步接口，零改动）：
//    init(deps) / save(data) / load() / saveSection / loadSection /
//    reset() / flush() / sync(patches) / getRemoteVersion(userId)
//  新增（云端能力）：
//    getMode() / pullRemoteSave() / getRankings(limit, offset) /
//    updateScore(score, level, job) / ping()
//  新增（账号统一管理；登录=自动拉取，绑定=认领旧角色）：
//    accountRegister(u, p) / accountLogin(u, p) / accountBindCurrentChar() /
//    accountLogout() / forcePushLocal() / pullCloudOverLocal() /
//    getAccountInfo() / getPendingConflict() / clearPendingConflict()
//  冲突语义（与服务器 compareSummaries 同规则，version 主判 + level 兜底）：
//    云端新 → 静默拉取；本地新 → 发 'cloud:conflict' 事件由 UISettings 弹选择框；
//    无云端档 → 视同 bind 候选（不打扰，面板内有绑定入口）；
//    推送收 409 device_takeover → 发 net:status 提示"账号已在别处登录"并暂停推送。
// ============================================================
(function(global) {
    'use strict';

    var SYNC_DEBOUNCE_MS = 600000;   // 脏分节推送防抖
    var RETRY_MS = 60000;          // 推送失败重试间隔
    var PULL_FLAG = 'RO_Cloud_Pulled';
    var _probeTimeoutMs = 1500;    // 单候选地址探测超时（ConfigProfiles.network.probeTimeoutMs 可覆盖）
    var _retryIntervalMs = 60000;  // 全部候选不可达时的重新探测间隔

    var _local = null;             // LocalStorageAdapter（镜像，始终激活）
    var _cloud = null;             // CloudAdapter（mode=cloud 时激活）
    var _mode = 'local';
    var _dirty = {};               // 脏分节表 { section: true }
    var _syncTimer = null;
    var _retryTimer = null;
    var _pushInFlight = false;
    var _pushPaused = false;       // 双开接管（409）后暂停推送；重新登录恢复
    var _pendingConflict = null;   // bootstrap 冲突弹窗数据（UISettings 未就绪时暂存）
    var _version = 0;
    var _initialized = false;
    var _lastSyncTime = 0;
    var _lastError = '';

    // ============================================================
    //  服务器自动探测：候选地址按序 ping，第一个可达者当选
    //  候选来源（按优先级）：URL server 参数 → 页面同源（http[s] 时）→
    //  ConfigProfiles default.network.candidates → localhost:3000 兜底
    // ============================================================
    function _collectCandidates(deps) {
        var list = [];
        try {
            var q = new URLSearchParams(global.location ? global.location.search : '');
            if (q.get('server')) list.push(q.get('server'));
            if (global.location && global.location.protocol.indexOf('http') === 0) {
                list.push(global.location.origin);   // 页面若由存档服务器托管，同源即命中
            }
        } catch (e) {}
        try {
            var profiles = global.ConfigProfiles || {};
            for (var key in profiles) {
                if (!profiles.hasOwnProperty(key)) continue;
                var net = profiles[key] && profiles[key].network;
                if (net && Array.isArray(net.candidates)) {
                    if (net.enabled === false) break;   // 显式关闭则跳过候选
                    net.candidates.forEach(function(u) {
                        if (list.indexOf(u) === -1) list.push(u);
                    });
                    if (typeof net.probeTimeoutMs === 'number') _probeTimeoutMs = net.probeTimeoutMs;
                    if (typeof net.retryIntervalMs === 'number') _retryIntervalMs = net.retryIntervalMs;
                    break;   // 只取第一个声明了 network 的配置组
                }
            }
        } catch (e2) {}
        if (list.indexOf('http://localhost:3000') === -1) list.push('http://localhost:3000');
        return list;
    }

    function _probeCandidates(list, idx) {
        if (idx >= list.length) return Promise.resolve(null);
        var probe = new global.CloudAdapter({ baseURL: list[idx], timeout: _probeTimeoutMs });
        return probe.ping().then(function(res) {
            if (res && res.status === 'ok') return list[idx];
            throw new Error('bad ping response');
        }).catch(function() {
            return _probeCandidates(list, idx + 1);
        });
    }

    // ---- 异步连接（探测期间为本地模式，不阻塞游戏启动） ----
    function _connectAsync(deps) {
        var candidates = _collectCandidates(deps);
        _probeCandidates(candidates, 0).then(function(serverURL) {
            if (_mode === 'cloud') return;   // 已连接（重入保护）
            if (!serverURL) {
                if (global.EventBus) {
                    global.EventBus.emit('net:status', { connected: false, server: null, mode: 'local', retrying: true });
                }
                console.warn('[CloudStorageService] 候选服务器均不可达，离线模式（' +
                    Math.round(_retryIntervalMs / 1000) + ' 秒后自动重试）');
                if (_retryTimer) clearTimeout(_retryTimer);
                _retryTimer = setTimeout(function() { _connectAsync(deps); }, _retryIntervalMs);
                return;
            }
            _mode = 'cloud';
            _cloud = new global.CloudAdapter({ baseURL: serverURL, timeout: 5000 });
            // 恢复跨刷新的同步元数据（上次推送版本/时间，冲突比对依据）
            var meta = _cloud.getSyncMeta();
            _version = meta.version || 0;
            _lastSyncTime = meta.updatedAt || 0;
            if (global.EventBus) {
                global.EventBus.emit('net:status', { connected: true, server: serverURL, mode: 'cloud' });
            }
            console.log('[CloudStorageService] ☁️ 已连接存档服务器:', serverURL);
            _bootstrapPull();   // 设备流：先补推再引导拉取；账号模式：先冲突比对再决定推送/拉取
        }).catch(function(e) {
            console.warn('[CloudStorageService] 探测异常:', e.message);
        });
    }

    // ============================================================
    //  初始化
    // ============================================================
    function init(deps) {
        // 粘性初始化：已进入 cloud 模式后，后续 legacy 调用不允许降级回 local
        if (_initialized && _mode === 'cloud') return true;
        _initialized = true;

        _local = global.LocalStorageAdapter || null;
        if (!_local || !_local.init({})) {
            console.error('[CloudStorageService] LocalStorageAdapter 不可用');
            return false;
        }

        _connectAsync(deps);
        console.log('[CloudStorageService] ✅ 已加载（本地优先；服务器探测中…）');
        return true;
    }

    // ============================================================
    //  首次云模式引导（设备流）：拉取服务器存档 → 写入本地 → 刷新一次页面
    //  （sessionStorage 防循环；无服务器数据则静默跳过）
    //  账号登录态：替换为冲突流程（云端新→静默拉取；本地新→弹选择框），
    //  不再无条件覆写本地——防止"覆盖方向吃进度"。
    // ============================================================
function _bootstrapPull() {
    // 防重复刷新标志：本次会话已经执行过引导拉取或刷新，则跳过
    try {
        if (sessionStorage.getItem('RO_Cloud_Pulled') === '1') return;
        if (sessionStorage.getItem('RO_Cloud_Reloaded') === '1') {
            console.warn('[CloudStorageService] 已刷新过，跳过引导');
            return;
        }
    } catch (e) {}

    // 延迟 10 秒再执行，确保页面完全初始化
    if (window._bootstrapTimer) return; // 避免多重定时器
    window._bootstrapTimer = setTimeout(function() {
        window._bootstrapTimer = null;
        _executeBootstrapPull();
    }, 10000);
}

// 将原有逻辑抽取到新函数 _executeBootstrapPull 中
function _executeBootstrapPull() {
    // 如果是账号模式，走冲突检查，不走设备流
    if (_cloud.hasAccount()) { _accountConflictCheck(); return; }

    var already = false;
    try { already = sessionStorage.getItem('RO_Cloud_Pulled') === '1'; } catch (e) {}
    if (already) return;

    _pushDirty();   // 探测期间的本地写入立即补推
    _cloud.pull().then(function(res) {
        if (!res || res.unavailable || !res.data) return;
        _applyPulledSave(res);
        console.log('[CloudStorageService] ☁️ 服务器存档已拉取到本地，刷新页面载入…');
        // 设置防重复标志，避免无限刷新
        try { sessionStorage.setItem('RO_Cloud_Reloaded', '1'); } catch (e) {}
        global.location.reload();
    }).catch(function(e) {
        console.warn('[CloudStorageService] 引导拉取失败（继续本地）:', e.message);
    });
}

    // ---- 拉取结果落本地（写入分节 + flush + 记住云端版本） ----
    function _applyPulledSave(res) {
        try { sessionStorage.setItem(PULL_FLAG, '1'); } catch (e2) {}
        var sections = ['char', 'inventory', 'map', 'ui', 'extras'];
        for (var i = 0; i < sections.length; i++) {
            var sec = sections[i];
            if (res.data[sec] !== undefined) {
                global.PersistenceManager.set(sec, res.data[sec]);
            }
        }
        global.PersistenceManager.flush();
        if (res.version) {
            _version = res.version;
            _lastSyncTime = res.updatedAt || Date.now();
            _cloud.saveSyncMeta(_version, _lastSyncTime);
        }
    }

    // ---- 本地摘要（冲突比对用：level/jobKey 来自 PersistenceManager，version/时间来自同步元数据） ----
    function _localSummary() {
        var level = 1, jobKey = 'Novice';
        try {
            var ch = global.PersistenceManager.get('char');
            if (ch) { level = ch.level || 1; jobKey = ch.jobKey || 'Novice'; }
        } catch (e) {}
        return { level: level, jobKey: jobKey, updatedAt: _lastSyncTime, version: _version };
    }

    // ---- 冲突方向判定（与服务器 compareSummaries 同规则）----
    function _compareSummaries(local, cloud) {
        var lv = (local && Number(local.version)) || 0;
        var cv = (cloud && Number(cloud.version)) || 0;
        if (cv > lv) return 'pull';
        if (lv > cv) return 'conflict';
        var ll = (local && Number(local.level)) || 0;
        var cl = (cloud && Number(cloud.level)) || 0;
        if (ll > cl) return 'conflict';
        if (cl > ll) return 'pull';
        return 'none';
    }

    // ---- 账号模式引导：先取云端摘要比对，再决定静默拉取 / 弹冲突面板 ----
function _accountConflictCheck() {
    // 防重复
    try {
        if (sessionStorage.getItem('RO_Cloud_Reloaded') === '1') {
            console.warn('[CloudStorageService] 已刷新过，跳过冲突检查');
            return;
        }
    } catch (e) {}

    // 延迟 10 秒
    if (window._conflictTimer) return;
    window._conflictTimer = setTimeout(function() {
        window._conflictTimer = null;
        _executeConflictCheck();
    }, 10000);
}

function _executeConflictCheck() {
    _cloud.charSummary().then(function(res) {
        var cloud = (res && !res.unavailable) ? res.summary : null;
        if (!cloud) {
            _pushDirty();
            return;
        }
        var verdict = _compareSummaries(_localSummary(), cloud);
        if (verdict === 'pull') {
            _silentPullAccount();
        } else if (verdict === 'conflict') {
            _pendingConflict = { local: _localSummary(), cloud: cloud };
            console.warn('[CloudStorageService] ⚠️ 检测到两端存档冲突（本地较新），等待用户选择');
            if (global.EventBus) global.EventBus.emit('cloud:conflict', _pendingConflict);
        } else {
            _pushDirty();
        }
    }).catch(function(e) {
        console.warn('[CloudStorageService] 冲突检查失败（继续本地）:', e.message);
        _pushDirty();
    });
}

    // ---- 云端较新：静默拉取（覆盖本地后刷新；记住版本避免重复判定） ----
    function _silentPullAccount() {
        return _cloud.pull().then(function(res) {
            if (!res || res.unavailable || !res.data) return false;
            _applyPulledSave(res);
            console.log('[CloudStorageService] ☁️ 云端存档较新，已静默拉取（v' + _version + '），刷新页面载入…');
            try { sessionStorage.setItem('RO_Cloud_Reloaded', '1'); } catch (e) {}
global.location.reload();
            global.location.reload();
            return true;
        }).catch(function(e) {
            console.warn('[CloudStorageService] 拉取失败（继续本地）:', e.message);
            return false;
        });
    }

    // ============================================================
    //  同步（本地镜像始终即时写；云端走脏队列推送）
    // ============================================================
    function save(data) {
        if (!_local) return false;
        var sections = ['char', 'inventory', 'map', 'ui', 'extras'];
        var ok = true;
        for (var i = 0; i < sections.length; i++) {
            var sec = sections[i];
            if (data[sec] !== undefined) {
                if (!saveSection(sec, data[sec])) ok = false;
            }
        }
        return ok;
    }

    function load() {
        return _local ? _local.loadAll() : null;
    }

    function saveSection(section, value) {
        if (!_local) return false;
        var ok = _local.saveSection(section, value);
        if (ok && _mode === 'cloud') {
            _dirty[section] = true;
            _scheduleSync();
        }
        return ok;
    }

    function loadSection(section) {
        return _local ? _local.loadSection(section) : undefined;
    }

    function reset() {
        if (!_local) return false;
        _dirty = {};
        if (_syncTimer) { clearTimeout(_syncTimer); _syncTimer = null; }
        if (_retryTimer) { clearTimeout(_retryTimer); _retryTimer = null; }
        return _local.reset();
    }

    function flush() {
        if (_local) _local.flush();
    }

    // ---- 云推送（write-behind：合并全部脏分节一次性整档推送） ----
    function _scheduleSync() {
        if (_syncTimer) clearTimeout(_syncTimer);
        _syncTimer = setTimeout(function() {
            _syncTimer = null;
            _pushDirty();
        }, SYNC_DEBOUNCE_MS);
    }

    function _pushDirty(retry) {
        if (_pushInFlight) return;
        if (_pushPaused) return;               // 接管暂停：不再推送（本地镜像不受影响）
        var dirtyKeys = Object.keys(_dirty);
        if (dirtyKeys.length === 0) return;
        if (!_cloud) { _dirty = {}; return; }

        _pushInFlight = true;
        var snapshot = _local.loadAll();
        _cloud.push(snapshot, _version).then(function(res) {
            _pushInFlight = false;
            if (res && res.unavailable) {
                _scheduleRetry();
                return;
            }
            _dirty = {};
            _version = (res && res.version) || (_version + 1);
            _lastSyncTime = Date.now();
            _cloud.saveSyncMeta(_version, _lastSyncTime);
            console.log('[CloudStorageService] ☁️ 存档已同步到服务器 v' + _version);
        }).catch(function(e) {
            _pushInFlight = false;
            _lastError = e.message;
            if (e && e.status === 409 && e.body && e.body.errCode === 'device_takeover') {
                _handleTakeover();
                return;
            }
            _scheduleRetry();
        });
    }

    // ---- 双开接管：账号已在其他设备登录 → 提示并暂停推送 ----
    function _handleTakeover() {
        _pushPaused = true;
        if (_retryTimer) { clearTimeout(_retryTimer); _retryTimer = null; }
        console.warn('[CloudStorageService] ⚠️ 账号已在别处登录，本机推送已暂停');
        if (global.EventBus) {
            global.EventBus.emit('net:status', {
                connected: true,
                mode: 'cloud',
                takeover: true,
                message: '账号已在别处登录，本机推送已暂停',
            });
        }
    }

    function _scheduleRetry() {
        if (_retryTimer) clearTimeout(_retryTimer);
        _retryTimer = setTimeout(function() {
            _retryTimer = null;
            _pushDirty(true);
        }, RETRY_MS);
    }

    // ---- 预留：增量同步（当前整档推送已覆盖需求） ----
    function sync(patches) {
        console.warn('[CloudStorageService] sync 增量接口预留；当前为整档 write-behind 推送');
        return false;
    }

    function getRemoteVersion(userId) {
        return _mode === 'cloud' ? _version : null;
    }

    // ============================================================
    //  云端能力透传（排行/健康检查/手动拉取）
    // ============================================================
    function getMode() { return _mode; }
    function getLastSync() { return { time: _lastSyncTime, version: _version, error: _lastError, dirty: Object.keys(_dirty) }; }

    // 已连接的云适配器实例（社交/组队等服务复用同一连接；未连接返回 null）
    function getAdapter() { return (_mode === 'cloud') ? _cloud : null; }

    function getRankings(limit, offset) {
        if (!_cloud) return Promise.resolve({ unavailable: true });
        return _cloud.rankings(limit, offset);
    }

    function updateScore(score, level, job) {
        if (!_cloud) return Promise.resolve({ unavailable: true });
        return _cloud.updateScore(score, level, job);
    }

    function ping() {
        if (!_cloud) return Promise.resolve({ status: 'local-only' });
        return _cloud.ping();
    }

    // ---- 手动拉取服务器存档（换机/回档用；会刷新页面） ----
    function pullRemoteSave() {
        try { sessionStorage.removeItem(PULL_FLAG); } catch (e) {}
        _bootstrapPull();
        return true;
    }

    // ============================================================
    //  账号统一管理 API（UISettings 经此调用；所有 fetch 在 CloudAdapter）
    // ============================================================
    function getAccountInfo() {
        return (_cloud && _cloud.hasAccount && _cloud.hasAccount()) ? _cloud.getAccountInfo() : null;
    }

    function accountRegister(username, password) {
        if (!_cloud) return Promise.resolve({ success: false, message: '未连接服务器' });
        return _cloud.accountRegister(username, password);
    }

    function accountLogin(username, password) {
        if (!_cloud) return Promise.resolve({ success: false, message: '未连接服务器' });
        _pushPaused = false;   // 重新登录视为本机接管，恢复推送
        return _cloud.accountLogin(username, password, _localSummary()).then(function(res) {
            if (res && res.summary && !res.pull && !res.conflict) {
                // 两端一致：对齐本地版本号
                _version = res.summary.version || _version;
                _lastSyncTime = res.summary.updatedAt || _lastSyncTime;
                _cloud.saveSyncMeta(_version, _lastSyncTime);
                if (res.charId) _pushDirty();   // 恢复接管期间积压的待推送分节
            }
            return res;
        });
    }

    // 老角色认领：绑定本设备既有角色到当前账号
    function accountBindCurrentChar() {
        if (!_cloud) return Promise.resolve({ success: false, message: '未连接服务器' });
        return _cloud.accountBind();
    }

    // 退出账号：回到设备流语义（刷新页面重建本地状态）
    function accountLogout() {
        if (!_cloud) return;
        _cloud.accountLogout();
        _pushPaused = false;
        _pendingConflict = null;
        global.location.reload();
    }

    // 冲突面板·方向一：用本地覆盖云端（立即整档推送；安全默认方向）
    function forcePushLocal() {
        if (!_cloud) return Promise.resolve({ success: false, message: '未连接服务器' });
        var snapshot = _local.loadAll();
        return _cloud.push(snapshot, _version).then(function(res) {
            if (res && res.unavailable) return { success: false, message: '服务器不可达，稍后重试' };
            _dirty = {};
            _pushPaused = false;
            _version = (res && res.version) || (_version + 1);
            _lastSyncTime = Date.now();
            _cloud.saveSyncMeta(_version, _lastSyncTime);
            console.log('[CloudStorageService] ☁️ 已用本地存档覆盖云端 v' + _version);
            return { success: true, version: _version };
        }).catch(function(e) {
            if (e && e.status === 409 && e.body && e.body.errCode === 'device_takeover') {
                _handleTakeover();
                return { success: false, message: '账号已在别处登录，无法上传（重新登录可接管）' };
            }
            return { success: false, message: (e && e.message) || '推送失败' };
        });
    }

    // 冲突面板·方向二：拉取云端覆盖本地（覆盖后刷新页面）
    function pullCloudOverLocal() {
        if (!_cloud) return Promise.resolve(false);
        return _silentPullAccount();
    }

    function getPendingConflict() { return _pendingConflict; }
    function clearPendingConflict() { _pendingConflict = null; }

    var CloudStorageService = {
        init: init,
        save: save,
        load: load,
        saveSection: saveSection,
        loadSection: loadSection,
        reset: reset,
        flush: flush,
        sync: sync,
        getRemoteVersion: getRemoteVersion,
        getMode: getMode,
        getLastSync: getLastSync,
        getAdapter: getAdapter,
        getRankings: getRankings,
        updateScore: updateScore,
        ping: ping,
        pullRemoteSave: pullRemoteSave,
        // 账号统一管理
        accountRegister: accountRegister,
        accountLogin: accountLogin,
        accountBindCurrentChar: accountBindCurrentChar,
        accountLogout: accountLogout,
        forcePushLocal: forcePushLocal,
        pullCloudOverLocal: pullCloudOverLocal,
        getAccountInfo: getAccountInfo,
        getPendingConflict: getPendingConflict,
        clearPendingConflict: clearPendingConflict,
    };

    // 自动以本地适配器初始化（URL/配置含 cloud 时自动升级为云模式）
    if (global.LocalStorageAdapter) {
        CloudStorageService.init({});
    }

    global.CloudStorageService = CloudStorageService;
})(window);
