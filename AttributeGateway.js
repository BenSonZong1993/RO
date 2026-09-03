// ============================================================
//  FILE: AttributeGateway.js
//  LAYER: gateway（属性收费站——最终属性唯一读取入口）
//  权限：attribute:invalidate（外部失效请求需过 AccessControl）
//        _updateCache 仅 AttributeMediator 回调调用
//  依赖：AttributeMediator（回调注册）、AccessControl、AttributeNormalizer
//  契约：
//    AttributeGateway.get(key, caller)            → any（基础类型直返，对象深拷贝）
//    AttributeGateway.getAll(caller)              → object（全量深拷贝，已标准化）
//    AttributeGateway.invalidate(source,payload,caller) → boolean
//    AttributeGateway.getAttackRange(caller)      → number（像素）
//    AttributeGateway.getCastReduction(caller)    → number（0~1）
//    AttributeGateway._updateCache(newStats)      → 仅 Mediator 调用
//  规则：CTX-1 / A1 —— _finalStats 由本网关独占维护（镜像到 char 仅供旧代码兼容读取）
// ============================================================
(function(global) {
    'use strict';

    var _cache = null;          // 最新标准化 finalStats（Mediator 推送）
    var _version = 0;
    var _auditLog = [];         // 审计日志（环形，最近 60 条）
    var _initialized = false;

    var AUDIT_LIMIT = 60;

    function _audit(kind, detail, caller) {
        _auditLog.push({ t: Date.now(), kind: kind, caller: caller || '?', detail: detail });
        if (_auditLog.length > AUDIT_LIMIT) _auditLog.shift();
    }

    // ---- 初始化：向 AttributeMediator 注册重算完成回调 ----
    function init() {
        if (_initialized) return true;
        if (!global.AttributeMediator || typeof global.AttributeMediator.setOnUpdate !== 'function') {
            console.error('[AttributeGateway] AttributeMediator.setOnUpdate 不可用，请先加载新版 AttributeMediator');
            return false;
        }
        global.AttributeMediator.setOnUpdate(function(finalStats, charRef) {
            AttributeGateway._updateCache(finalStats, charRef);
        });
        _initialized = true;
        console.log('[AttributeGateway] ✅ 已初始化（已挂接 AttributeMediator 回调）');
        return true;
    }

    // ---- 缓存更新（仅 Mediator 回调进入） ----
    function _updateCache(newStats, charRef) {
        var normalized = global.AttributeNormalizer
            ? global.AttributeNormalizer.normalizeFinalStats(newStats)
            : newStats;
        _cache = normalized || newStats;
        _version++;

        // 网关独占维护 char._finalStats（旧代码兼容读取；禁止其他模块直接赋值）
        if (charRef && typeof charRef === 'object') {
            charRef._finalStats = _cache;
        } else if (global.CharRepository && typeof global.CharRepository.getLiveRef === 'function') {
            var live = global.CharRepository.getLiveRef();
            if (live) live._finalStats = _cache;
        }
        _audit('update', { version: _version }, 'AttributeMediator');
    }

    function _ensureCache() {
        if (_cache) return _cache;
        if (global.AttributeMediator && typeof global.AttributeMediator.forceRecalc === 'function') {
            global.AttributeMediator.forceRecalc();
        }
        return _cache;
    }

    function _clone(value) {
        return JSON.parse(JSON.stringify(value));
    }

    // ---- 读接口 ----
    function get(key, caller) {
        var stats = _ensureCache();
        if (!stats) return undefined;
        var value = stats[key];
        _audit('get', key, caller);
        return (value !== null && typeof value === 'object') ? _clone(value) : value;
    }

    function getAll(caller) {
        var stats = _ensureCache();
        _audit('getAll', '*', caller);
        return stats ? _clone(stats) : null;
    }

    // 新增：稳定只读访问器，处理常见别名/大小写差异，保证对外返回标准值（不要直接修改 _cache）
    function getFinalStat(key, caller) {
        var stats = _ensureCache();
        _audit('getFinalStat', key, caller);
        if (!stats) return 0;
        if (!key || typeof key !== 'string') return 0;

        // 规范化键（转小写、去除非字母数字）
        var norm = key.toString().toLowerCase().replace(/[^a-z0-9]/g, '');

        // 常见映射（优先 panel 开头的面板值）
        var candidates = [];
        if (norm === 'flee' || norm === 'panelflee') {
            candidates = ['panelFLEE', 'panelFlee', 'panel_flee', 'panelflee', 'flee'];
        } else if (norm === 'hit' || norm === 'panelhit') {
            candidates = ['panelHIT', 'panelHit', 'panel_hit', 'panelhit', 'hit'];
        } else {
            // 一般尝试：直接按原键、大小写变体与下划线变体
            candidates = [key, key.replace(/_/g, ''), key.toLowerCase(), key.toUpperCase()];
        }

        for (var i = 0; i < candidates.length; i++) {
            var k = candidates[i];
            if (Object.prototype.hasOwnProperty.call(stats, k)) {
                var v = stats[k];
                if (typeof v === 'number') return v;
                // 若是对象/复杂结构，返回保守 0 或尝试读取 value 字段
                if (v && typeof v === 'object' && v.value !== undefined && typeof v.value === 'number') return v.value;
            }
        }

        // 回退：尝试直接读取常用短键
        if (Object.prototype.hasOwnProperty.call(stats, 'flee') && typeof stats.flee === 'number') return stats.flee;
        if (Object.prototype.hasOwnProperty.call(stats, 'panelFLEE') && typeof stats.panelFLEE === 'number') return stats.panelFLEE;

        return 0;
    }

    function getAttackRange(caller) {
        var v = get('attackRange', caller || 'AttributeGateway');
        return (typeof v === 'number' && v > 0) ? v : ((global.SKILL_CONFIG && global.SKILL_CONFIG.PIXELS_PER_CELL) || RO_CONSTANTS.DEFAULT_ATTACK_RANGE);
    }

    function getCastReduction(caller) {
        var v = get('variableCastReduction', caller || 'AttributeGateway');
        if (typeof v !== 'number' || isNaN(v)) return 0;
        return Math.max(0, Math.min(1, v));
    }

    // ---- 失效请求（收费站入口：一切重算请求从这里过闸） ----
    function invalidate(source, payload, caller) {
        if (global.AccessControl && !global.AccessControl.check('attribute:invalidate', caller || source)) {
            console.error('[AttributeGateway] 拒绝：', caller, '无权触发 attribute:invalidate');
            return false;
        }
        _audit('invalidate', { source: source, payload: payload || {} }, caller);
        if (global.AttributeMediator && typeof global.AttributeMediator.requestRecalc === 'function') {
            global.AttributeMediator.requestRecalc(source || 'gateway', payload || {});
            return true;
        }
        return false;
    }

    function getVersion() { return _version; }
    function getAuditLog() { return _auditLog.slice(); }

    var AttributeGateway = {
        init: init,
        get: get,
        getAll: getAll,
        getFinalStat: getFinalStat,
        getAttackRange: getAttackRange,
        getCastReduction: getCastReduction,
        invalidate: invalidate,
        getVersion: getVersion,
        getAuditLog: getAuditLog,
        _updateCache: _updateCache,
    };

    global.AttributeGateway = AttributeGateway;
    console.log('[AttributeGateway] ✅ 已加载（属性收费站 v1.0）');
})(window);
