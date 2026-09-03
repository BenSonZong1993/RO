// ============================================================
//  FILE: SocialService.js
//  LAYER: services（社交/组队——在场心跳、邀请、队伍状态、佣兵快照）
//  权限：无（业务模块禁止直连网络；所有 fetch 经 CloudAdapter，NET-1）
//  依赖：CloudAdapter（网络）、CloudStorageService（模式判定）、
//        AttributeGateway/CharRepository（自快照构建）、EventBus
//  契约（蓝图 10.2.2 + v1 实装；详见 docs/组队功能实施方案.md）：
//    sendInvite(toCharId) / respondInvite(inviteId, accept) / leaveParty()
//    inParty() / getParty() / getInviteCount() / getPartnerSnapshot()
//    getRanking(callback)（透传 CloudStorageService.getRankings）
//    getPlayerSnapshot(playerId) / checkTeammates(ids)（v1 仍为占位，佣兵走 getPartnerSnapshot）
//  心跳：云模式每 45s 上报自快照，响应捎带待处理邀请与队伍状态；
//        每次心跳 emit 'social:state' {invites, party}；队伍解散 emit 'social:party-ended'。
// ============================================================
(function(global) {
    'use strict';

    var HEARTBEAT_MS = 45 * 1000;
    var _timer = null;
    var _party = null;          // {partyId, role, partner:{charId,name,level,online}}
    var _invites = [];          // [{id, from, fromName, fromLevel}]
    var _leaving = false;       // 防退出请求与心跳竞争
    var _initialized = false;

    function _cloud() {
        return !!(global.CloudStorageService && global.CloudStorageService.getMode() === 'cloud' && global.CloudAdapter);
    }

    // 复用 CloudStorageService 已连接的适配器实例（NET-1；含正确的 baseURL）
    function _adapter() {
        return (global.CloudStorageService && typeof global.CloudStorageService.getAdapter === 'function')
            ? global.CloudStorageService.getAdapter() : null;
    }

    // ---- 自快照（佣兵属性来源；字段与服务器白名单一一对应） ----
    function buildSelfSnapshot() {
        var char = global.CharRepository ? global.CharRepository.getLiveRef() : null;
        if (!char) return null;
        var final = {};
        if (global.AttributeGateway && typeof global.AttributeGateway.getAll === 'function') {
            final = global.AttributeGateway.getAll('SocialService') || {};
        }
        function pick(key, dft) {
            var v = final[key];
            return (typeof v === 'number') ? v : dft;
        }
        return {
            name: String(char.name || '玩家').slice(0, 32),
            level: char.level || 1,
            jobKey: char.jobKey || 'Novice',
            gender: (char.gender === 'female') ? 'female' : 'male',
            hp: char.hp || 1,
            sp: char.sp || 0,
            finalStats: {
                finalATK: pick('finalATK', 5),
                finalDEF: pick('finalDEF', 0),
                panelHIT: pick('panelHIT', 100),
                panelFLEE: pick('panelFLEE', 100),
                finalMaxHP: pick('finalMaxHP', 100),
                finalMaxSP: pick('finalMaxSP', 50),
                attackRange: pick('attackRange', RO_CONSTANTS.PIXELS_PER_CELL),
                attackInterval: pick('attackInterval', 0.8),
                attackElement: final.attackElement || 'Neutral',
                weaponType: final.weaponType || 'None',   // 站位判定用（PartnerConfig.rangedWeapons）
            },
            learnedSkills: char.learnedSkills || {},
            autoSkill: char._autoSkillConfig || { skills: [], strategy: 'priority', enabled: true },
        };
    }

    function _identity() {
        return (global.CloudAdapter && typeof global.CloudAdapter.getIdentity === 'function')
            ? global.CloudAdapter.getIdentity() : null;   // 构造器静态（读 RO_Cloud_Auth，无需实例）
    }

    function _emitState() {
        if (!global.EventBus) return;
        global.EventBus.emit('social:state', {
            invites: _invites.slice(0),
            party: _party ? JSON.parse(JSON.stringify(_party)) : null,
        });
    }

    // ---- 心跳循环 ----
    function _tick() {
        if (!_cloud()) return;
        var id = _identity();
        if (!id || !id.charId) return;
        if (_leaving) return;
        var adapter = _adapter();
        if (!adapter) return;
        adapter.socialHeartbeat(id.charId, id.token, buildSelfSnapshot()).then(function(res) {
            if (!res || res.unavailable) return;
            var prevPartyId = _party ? _party.partyId : null;
            _invites = res.invites || [];
            _party = res.party || null;
            // 队伍在服务器侧被解散（对方超时/重启）：本地感知并广播
            if (prevPartyId && !_party) {
                if (global.EventBus) global.EventBus.emit('social:party-ended', { reason: 'offline' });
                if (global.PartnerManager && global.PartnerManager.isSummoned &&
                    global.PartnerManager.isSummoned()) {
                    global.PartnerManager.despawn('party-ended');
                }
            }
            _emitState();
        }).catch(function() { /* 网络抖动：下个周期再试 */ });
    }

    function _startHeartbeat() {
        if (_timer) return;
        _timer = setInterval(_tick, HEARTBEAT_MS);
        setTimeout(_tick, 3000);   // 启动后尽快建立在场
    }

    // ============================================================
    //  公开 API
    // ============================================================
    function sendInvite(toCharId) {
        if (!_cloud()) return Promise.resolve({ success: false, message: '离线模式无法组队' });
        var id = _identity();
        var adapter = _adapter();
        if (!id || !adapter) return Promise.resolve({ success: false, message: '尚未连接存档身份' });
        return adapter.socialInvite(id.charId, toCharId, id.token).then(function(res) {
            if (!res || res.unavailable) return { success: false, message: (res && res.message) || '网络异常' };
            if (res.ok) return { success: true, message: '邀请已发送，等待对方同意' };
            return { success: false, message: res.error || '邀请失败' };
        });
    }

    function respondInvite(inviteId, accept) {
        if (!_cloud()) return Promise.resolve({ success: false, message: '离线模式' });
        var id = _identity();
        var adapter = _adapter();
        if (!id || !adapter) return Promise.resolve({ success: false, message: '尚未连接存档身份' });
        return adapter.socialRespond(id.charId, id.token, inviteId, accept).then(function(res) {
            if (!res || res.unavailable) return { success: false, message: (res && res.message) || '网络异常' };
            if (res.accepted) {
                _tick();   // 立即刷新队伍状态
                return { success: true, message: '已加入队伍' };
            }
            return { success: !!res.ok, message: res.ok ? '已拒绝' : (res.error || '操作失败') };
        });
    }

    function leaveParty() {
        if (!_cloud() || !_party) return Promise.resolve({ success: false, message: '你不在队伍中' });
        var id = _identity();
        var adapter = _adapter();
        _leaving = true;
        var done = function(res) {
            _leaving = false;
            var hadParty = !!_party;
            _party = null;
            if (hadParty && global.EventBus) global.EventBus.emit('social:party-ended', { reason: 'left' });
            if (global.PartnerManager && global.PartnerManager.isSummoned && global.PartnerManager.isSummoned()) {
                global.PartnerManager.despawn('party-ended');
            }
            _emitState();
            return res;
        };
        if (!id || !adapter) return Promise.resolve(done({ success: false, message: '身份无效' }));
        return adapter.socialLeave(id.charId, id.token).then(function(res) {
            if (!res || res.unavailable) return done({ success: false, message: (res && res.message) || '网络异常' });
            return done({ success: !!res.ok, message: res.ok ? '已退出队伍' : (res.error || '退出失败') });
        });
    }

    function inParty() { return !!_party; }
    function getParty() { return _party ? JSON.parse(JSON.stringify(_party)) : null; }
    function getInviteCount() { return _invites.length; }

    // 对方快照（佣兵属性来源；供 PartnerManager 召唤时调用）
    function getPartnerSnapshot() {
        if (!_cloud() || !_party) return Promise.resolve({ ok: false, message: '不在队伍中' });
        var id = _identity();
        var adapter = _adapter();
        if (!id || !adapter) return Promise.resolve({ ok: false, message: '身份无效' });
        return adapter.socialPartnerSnapshot(id.charId, id.token).then(function(res) {
            if (!res || res.unavailable) return { ok: false, message: (res && res.message) || '网络异常' };
            if (!res.ok) return { ok: false, message: res.error || '对方数据尚未同步' };
            return { ok: true, partner: res.partner, snapshot: res.snapshot };
        });
    }

    // ---- 蓝图 10.2.2 旧契约（保持签名）----
    function getRanking(callback) {
        if (global.CloudStorageService && typeof global.CloudStorageService.getRankings === 'function') {
            global.CloudStorageService.getRankings(50, 0).then(function(res) {
                if (typeof callback === 'function') callback((res && res.rankings) || []);
            }).catch(function() {
                if (typeof callback === 'function') callback([]);
            });
        } else if (typeof callback === 'function') {
            callback([]);
        }
    }
    // 他人战力快照（占位保留：v1 佣兵走 getPartnerSnapshot；开放查询他人快照时再实装）
    function getPlayerSnapshot(playerId) {
        console.warn('[SocialService] getPlayerSnapshot 尚未开放（v1 仅限队友快照）');
        return null;
    }
    // 定时检测队友状态（占位保留：v1 由心跳响应统一捎带队伍状态）
    function checkTeammates(teammateIds) {
        console.warn('[SocialService] checkTeammates 由心跳流程取代');
        return [];
    }
    function updateMyStats(stats) { /* v1：自快照由心跳捎带，此入口保留 */ }

    var SocialService = {
        // v1 实装
        sendInvite: sendInvite,
        respondInvite: respondInvite,
        leaveParty: leaveParty,
        inParty: inParty,
        getParty: getParty,
        getInviteCount: getInviteCount,
        getPartnerSnapshot: getPartnerSnapshot,
        buildSelfSnapshot: buildSelfSnapshot,
        tickNow: _tick,   // 手动触发一次心跳（测试/调试；正常由 45s 定时器驱动）
        // 蓝图 10.2.2 契约
        getRanking: getRanking,
        getPlayerSnapshot: getPlayerSnapshot,
        checkTeammates: checkTeammates,
        updateMyStats: updateMyStats,
    };

    global.SocialService = SocialService;

    if (!_initialized) {
        _initialized = true;
        _startHeartbeat();
        console.log('[SocialService] ✅ 已加载（组队心跳/邀请/快照；离线模式自动静默）');
    }
})(window);
