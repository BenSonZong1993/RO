// ============================================================
//  FILE: AttributeMediator.js
//  LAYER: core（属性重算管线调度器）
//  权限：attribute:recalc（内部）；对外暴露 requestRecalc/forceRecalc
//  依赖：ArithmeticCore、CharRepository（活引用）、ConfigProfileManager、
//        InventoryService、EventBus、8 个处理器 + AttributeSystem(组装器)
//  契约（v4.0 变更）：
//    setOnUpdate(callback)    → 新增：重算完成后回调（AttributeGateway._updateCache 挂接点）
//    requestRecalc / forceRecalc / getFinalStats / getDerivedValue / getVersion ...
//  规则：A1 —— 重算结果经 setOnUpdate 回调写入 AttributeGateway，
//        由网关独占维护 char._finalStats；本模块不再直接写 char
// ============================================================
(function(global) {
    'use strict';

    var CONFIG = {
        DEBOUNCE_MS: 50,
        DEBUG: true,
        ENABLE_TRACING: true,
    };

    var _cachedStats = null;
    var _version = 0;
    var _recalcTimer = null;
    var _pendingRequests = [];
    var _isRecalculating = false;
    var _pipelineReady = false;   // v4.0.1：init() 前到达的重算请求排队等待，避免"组装器未就绪"
    var _onUpdateCallbacks = [];

    var _processors = {
        base: null,
        aspd: null,
        cast: null,
        skill: null,
        equip: null,
        status: null,
        config: null,
        conflict: null,
        assembler: null,
    };

    var _configProfileManager = null;
    var _inventoryService = null;
    var _eventBus = null;

    function _log(message, data) { if (CONFIG.DEBUG) console.log('[AttributeMediator] ' + message, data || ''); }
    function _warn(message, data) { console.warn('[AttributeMediator] ' + message, data || ''); }
    function _error(message, data) { console.error('[AttributeMediator] ' + message, data || ''); }

    // ---- 角色活引用（唯一来源：CharRepository） ----
    function _getChar() {
        if (global.CharRepository && typeof global.CharRepository.getLiveRef === 'function') {
            return global.CharRepository.getLiveRef();
        }
        return null;
    }

    function _getEquipBonuses() {
        if (!_inventoryService || typeof _inventoryService.getEquipBonuses !== 'function') {
            return {};
        }
        return _inventoryService.getEquipBonuses() || {};
    }

    function _getCurrentProfile() {
        if (!_configProfileManager || typeof _configProfileManager.getCurrentProfile !== 'function') {
            return null;
        }
        return _configProfileManager.getCurrentProfile() || null;
    }

    function _getStatusSc(char) {
        if (!char) return null;
        return char.sc || null;
    }

    // ---- v4.0 新增：重算完成回调注册 ----
    function setOnUpdate(callback) {
        if (typeof callback !== 'function') return false;
        _onUpdateCallbacks.push(callback);
        return true;
    }

    function _notifyUpdate(finalStats, char) {
        for (var i = 0; i < _onUpdateCallbacks.length; i++) {
            try {
                _onUpdateCallbacks[i](finalStats, char);
            } catch (e) {
                _error('onUpdate 回调异常:', e);
            }
        }
    }

    function _executeRecalc() {
        if (!_pipelineReady) return; // 防御：管线就绪前不执行空装配
        if (_isRecalculating) {
            _log('重算进行中，请求入队等待');
            _pendingRequests.push({ source: 'queued', payload: {}, timestamp: Date.now() });
            return;
        }

        var char = _getChar();
        if (!char) {
            _warn('角色数据不存在，跳过重算');
            return;
        }

        _isRecalculating = true;
        _log('开始属性重算，版本: ' + (_version + 1));

        try {
            var baseResult = _processors.base ? _processors.base.process(char) : null;
            var aspdResult = _processors.aspd ? _processors.aspd.process(char) : null;
            var castResult = _processors.cast ? _processors.cast.process(char) : null;
            var skillResult = _processors.skill ? _processors.skill.process(char) : null;
            var equipBonuses = _getEquipBonuses();
            var equipResult = _processors.equip ? _processors.equip.process(equipBonuses, char) : null;
            var sc = _getStatusSc(char);
            var statusResult = _processors.status ? _processors.status.process(sc, char) : null;
            var profile = _getCurrentProfile();
            var configResult = _processors.config ? _processors.config.process(profile, char) : null;

            var allResults = [baseResult, aspdResult, castResult, skillResult, equipResult, statusResult, configResult]
                .filter(function(r) { return r !== null; });

            var resolved = _processors.conflict ? _processors.conflict.resolve(allResults) : null;

            if (_processors.assembler && typeof _processors.assembler.assemble === 'function') {
                var finalStats = _processors.assembler.assemble(resolved, char);
                _cachedStats = finalStats;
                _version++;

                // ---- v4.0：结果经回调推送（AttributeGateway 独占写 char._finalStats） ----
                _notifyUpdate(finalStats, char);

                if (_eventBus) {
                    setTimeout(function() {
                        _eventBus.emit('char:statsRecalculated', { version: _version, finalStats: finalStats });
                        _eventBus.emit('char:changed', { char: char });
                    }, 0);
                }

                _log('属性重算完成，版本: ' + _version);
            } else {
                _error('组装器未就绪，无法完成重算');
            }
        } catch (e) {
            _error('属性重算异常:', e);
        } finally {
            _isRecalculating = false;
            if (_pendingRequests.length > 0) {
                _pendingRequests = [];
                setTimeout(function() { _executeRecalc(); }, 10);
            }
        }
    }

    function init(deps) {
        _configProfileManager = (deps && deps.configProfileManager) || global.ConfigProfileManager;
        _inventoryService = (deps && deps.inventoryService) || global.InventoryService;
        _eventBus = (deps && deps.eventBus) || global.EventBus;

        _processors.base = (deps && deps.baseProcessor) || global.BaseStatsProcessor || null;
        _processors.aspd = (deps && deps.aspdProcessor) || global.ASPDProcessor || null;
        _processors.cast = (deps && deps.castProcessor) || global.CastProcessor || null;
        _processors.skill = (deps && deps.skillProcessor) || global.SkillProcessor || null;
        _processors.equip = (deps && deps.equipProcessor) || global.EquipProcessor || null;
        _processors.status = (deps && deps.statusProcessor) || global.StatusProcessor || null;
        _processors.config = (deps && deps.configProcessor) || global.ConfigProcessor || null;
        _processors.conflict = (deps && deps.conflictResolver) || global.ConflictResolver || null;
        _processors.assembler = (deps && deps.assembler) || global.AttributeSystem || null;

        if (!global.CharRepository) {
            _error('CharRepository 未加载');
            return false;
        }
        if (!global.ArithmeticCore) {
            _error('ArithmeticCore 未加载');
            return false;
        }

        _log('初始化完成，处理器状态:', {
            base: !!_processors.base,
            aspd: !!_processors.aspd,
            cast: !!_processors.cast,
            skill: !!_processors.skill,
            equip: !!_processors.equip,
            status: !!_processors.status,
            config: !!_processors.config,
            conflict: !!_processors.conflict,
            assembler: !!_processors.assembler,
        });

        // ---- 监听 attribute:invalidate 事件，触发属性重算 ----
if (_eventBus) {
    _eventBus.on('attribute:invalidate', function(payload) {
        _log('收到 attribute:invalidate 事件，触发重算', payload);
        requestRecalc('attribute:invalidate', payload);
    });
}

        // 管线就绪：排队的早期请求（如 UI 首帧读取）在此统一放行
        _pipelineReady = true;
        requestRecalc('init', {});
        return true;


    }

    function requestRecalc(source, payload) {
        // 管线未就绪（处理器/组装器尚未注入）：入队等待，不执行空管线
        if (!_pipelineReady) {
            _pendingRequests.push({ source: source || 'early', payload: payload || {}, timestamp: Date.now() });
            _log('管线未就绪，重算请求已排队: ' + source);
            return;
        }
        _log('收到重算请求: ' + source, payload);
        _pendingRequests.push({ source: source, payload: payload || {}, timestamp: Date.now() });

        if (_recalcTimer) {
            clearTimeout(_recalcTimer);
            _recalcTimer = null;
        }

        _recalcTimer = setTimeout(function() {
            _recalcTimer = null;
            var sources = _pendingRequests.map(function(r) { return r.source; });
            _pendingRequests = [];
            _log('执行防抖合并后的重算，来源: ' + sources.join(', '));
            _executeRecalc();
        }, CONFIG.DEBOUNCE_MS);
    }

    function getFinalStats() {
        if (!_cachedStats && _pipelineReady) _executeRecalc();
        return _cachedStats ? JSON.parse(JSON.stringify(_cachedStats)) : null;
    }

    function getDerivedValue(key) {
        var stats = getFinalStats();
        if (!stats) return undefined;
        return stats[key];
    }

    function getVersion() { return _version; }
    function getDebugInfo() {
        return {
            version: _version,
            hasCache: !!_cachedStats,
            pendingRequests: _pendingRequests.length,
            isRecalculating: _isRecalculating,
            onUpdateCallbacks: _onUpdateCallbacks.length,
            processors: {
                base: !!_processors.base,
                aspd: !!_processors.aspd,
                cast: !!_processors.cast,
                skill: !!_processors.skill,
                equip: !!_processors.equip,
                status: !!_processors.status,
                config: !!_processors.config,
                conflict: !!_processors.conflict,
                assembler: !!_processors.assembler,
            },
        };
    }
    function forceRecalc() {
        if (!_pipelineReady) {
            _pendingRequests.push({ source: 'force-early', payload: {}, timestamp: Date.now() });
            return;
        }
        if (_recalcTimer) { clearTimeout(_recalcTimer); _recalcTimer = null; }
        _pendingRequests = [];
        _executeRecalc();
    }

    function registerProcessor(type, processor) {
        if (_processors.hasOwnProperty(type)) {
            _processors[type] = processor;
            _log('注册处理器: ' + type);
            return true;
        }
        _warn('未知处理器类型: ' + type);
        return false;
    }

    var AttributeMediator = {
        init: init,
        requestRecalc: requestRecalc,
        getFinalStats: getFinalStats,
        getDerivedValue: getDerivedValue,
        getVersion: getVersion,
        getDebugInfo: getDebugInfo,
        forceRecalc: forceRecalc,
        registerProcessor: registerProcessor,
        setOnUpdate: setOnUpdate,
        CONFIG: CONFIG,
        _getChar: _getChar,
    };

    global.AttributeMediator = AttributeMediator;
    console.log('[AttributeMediator] ✅ 已加载（v4.0：onUpdate 回调 + CharRepository 活引用）');
})(window);
