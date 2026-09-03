// js/ui/UIBattleStats.js
(function(global) {
    'use strict';

    // ============================================================
    //  工具函数：从 UIConfig 读取面板配置（带降级兜底）
    // ============================================================
    function _getPanelConfig() {
        var defaultCfg = {
            refreshInterval: 1.0,
            expBarLowColor: '#FF4444',
            expBarMidColor: '#FFAA00',
            expBarHighColor: '#44FF44',
            showDecimal: false,
            showDetailedExp: true,
            killCounterFormat: 'int',
        };

        if (!global.UIConfig || !global.UIConfig.panels || !global.UIConfig.panels.battleStats) {
            return defaultCfg;
        }

        var cfg = global.UIConfig.panels.battleStats;
        var result = {};
        for (var key in defaultCfg) {
            result[key] = cfg[key] !== undefined ? cfg[key] : defaultCfg[key];
        }
        return result;
    }

    // ----- 统计状态 -----
    var _sessionStart = 0;
    var _battleDuration = 0;
    var _isRunning = false;
    var _totalKills = 0;
    var _lootMap = {};
    var _snapshot = { exp: 0, jobExp: 0, level: 1, jobLevel: 1 };

    var _listeners = [];
    var _initialized = false;
    var _elements = {};
    var _throttledUpdate = null;   // 节流版 update

    // ----- DOM 工具 -----
    function _getEl(id) {
        if (!_elements[id]) _elements[id] = document.getElementById(id);
        return _elements[id];
    }

    function _setText(id, text) {
        var el = _getEl(id);
        if (el) el.textContent = text;
    }

    function _setWidth(id, percent) {
        var el = _getEl(id);
        if (el) el.style.width = Math.min(100, percent) + '%';
    }

    function _formatDuration(ms) {
        if (ms < 0) ms = 0;
        var totalSeconds = Math.floor(ms / 1000);
        var minutes = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
        var seconds = String(totalSeconds % 60).padStart(2, '0');
        return minutes + ':' + seconds;
    }

    function _getChar() {
        return global.CharController ? global.CharController.getChar() : null;
    }

    function _getExpToLevel(level, jobKey) {
        if (global.CharService && typeof global.CharService.getExpToLevel === 'function') {
            return global.CharService.getExpToLevel(level, jobKey);
        }
        return Math.floor(10 * level * level + 20 * level);
    }

    function _getJobExpToLevel(level, jobKey) {
        if (global.CharService && typeof global.CharService.getJobExpToLevel === 'function') {
            return global.CharService.getJobExpToLevel(level, jobKey);
        }
        return Math.floor(8 * level * level + 15 * level);
    }

    function _calcGainedExp(char, snapshot) {
        if (!char) return 0;
        var gained = char.exp - snapshot.exp;
        if (char.level > snapshot.level) {
            var jobKey = char.jobKey || 'Novice';
            for (var lv = snapshot.level; lv < char.level; lv++) {
                gained += _getExpToLevel(lv, jobKey);
            }
        }
        return Math.max(0, gained);
    }

    function _calcGainedJobExp(char, snapshot) {
        if (!char) return 0;
        var gained = char.jobExp - snapshot.jobExp;
        if (char.jobLevel > snapshot.jobLevel) {
            var jobKey = char.jobKey || 'Novice';
            for (var lv = snapshot.jobLevel; lv < char.jobLevel; lv++) {
                gained += _getJobExpToLevel(lv, jobKey);
            }
        }
        return Math.max(0, gained);
    }

    function _updateMapTitle(mapId) {
        // 数据源优先级：显式参数 → 存档地图状态（MapRepository）→ DataCoordinator → 战斗控制器
        if (!mapId && global.MapRepository && typeof global.MapRepository.get === 'function') {
            mapId = global.MapRepository.get('currentId');
        }
        if (!mapId && global.DataCoordinator && typeof global.DataCoordinator.get === 'function') {
            mapId = global.DataCoordinator.get('map.currentId');
        }
        if (!mapId && global.BattleController && typeof global.BattleController.getMapId === 'function') {
            mapId = global.BattleController.getMapId();
        }
        var titleEl = _getEl('battle-title');
        if (!titleEl) return;
        if (!mapId) { titleEl.textContent = '当前地图：未知'; return; }
        var mapName = mapId;
        if (global.MapService && typeof global.MapService.getMapById === 'function') {
            var info = global.MapService.getMapById(mapId);
            if (info) mapName = info.chineseName || info.name || mapId;
        } else if (global.MapDataGateway && typeof global.MapDataGateway.getMapById === 'function') {
            var gwMap = global.MapDataGateway.getMapById(mapId);
            if (gwMap) mapName = gwMap.chineseName || gwMap.name || mapId;
        }
        titleEl.textContent = '当前地图：' + mapName;
    }

    // ----- 主更新函数（节流控制） -----
    function update() {
        var char = _getChar();
        if (!char) return;

        // 经验条
        var baseNeed = 1, jobNeed = 1;
        var jobKey = char.jobKey || 'Novice';
        if (global.CharService && typeof global.CharService.getExpToLevel === 'function') {
            baseNeed = global.CharService.getExpToLevel(char.level, jobKey);
            jobNeed = global.CharService.getJobExpToLevel(char.jobLevel, jobKey);
        } else {
            baseNeed = _getExpToLevel(char.level, jobKey);
            jobNeed = _getJobExpToLevel(char.jobLevel, jobKey);
        }

        _setText('base-exp-text', char.exp + ' / ' + baseNeed);
        _setText('job-exp-text', char.jobExp + ' / ' + jobNeed);
        _setText('base-lv', char.level);
        _setText('job-lv', char.jobLevel);
        _setWidth('base-exp-bar', (char.exp / baseNeed) * 100);
        _setWidth('job-exp-bar', (char.jobExp / jobNeed) * 100);

        // ---- 【改动点1】经验条颜色从 UIConfig 读取 ----
        var cfg = _getPanelConfig();
        var expPercent = (char.exp / baseNeed) * 100;
        var expBarFill = _getEl('base-exp-bar');
        if (expBarFill) {
            if (expPercent < 33) {
                expBarFill.style.backgroundColor = cfg.expBarLowColor;
            } else if (expPercent < 66) {
                expBarFill.style.backgroundColor = cfg.expBarMidColor;
            } else {
                expBarFill.style.backgroundColor = cfg.expBarHighColor;
            }
        }

        // 本轮累计经验（基于快照差值）
        var gainedExp = _calcGainedExp(char, _snapshot);
        var gainedJobExp = _calcGainedJobExp(char, _snapshot);
        if (_snapshot.level === 0 && _snapshot.exp === 0) {
            gainedExp = 0;
            gainedJobExp = 0;
        }
        _setText('base-total-exp', gainedExp);
        _setText('job-total-exp', gainedJobExp);

        // Zeny
        if (char.zeny !== undefined) {
            _setText('zeny-total', char.zeny);
        }

        // 战斗时长
        var elapsed = Date.now() - _sessionStart;
        if (_isRunning) {
            _battleDuration = elapsed;
        }
        _setText('battle-duration', _formatDuration(_battleDuration));

        // 效率
        var minutes = _battleDuration / 60000;
        if (minutes > 0) {
            _setText('base-per-min', Math.round(gainedExp / minutes));
            _setText('job-per-min', Math.round(gainedJobExp / minutes));
        } else {
            _setText('base-per-min', '0');
            _setText('job-per-min', '0');
        }

        // 战利品列表
        var lootList = _getEl('loot-list');
        if (lootList) {
            var items = Object.keys(_lootMap);
            if (items.length === 0) {
                lootList.innerHTML = '<div class="loot-item" style="color:#666;">暂无战利品</div>';
            } else {
                items.sort(function(a, b) { return _lootMap[b] - _lootMap[a]; });
                var html = '';
                for (var i = 0; i < items.length; i++) {
                    var name = items[i];
                    var count = _lootMap[name];
                  // 假设 name 是 AegisName（英文标识），用 getByAegis 反查 ID 再取显示名
var def = ItemDataGateway.getByAegis(name);
var displayName = def ? ItemDataGateway.getDisplayName(def.Id) : name;
html += '<div class="loot-item"><span>' + displayName + '</span><span class="count">x' + count + '</span></div>';
                }
                lootList.innerHTML = html;
            }
        }
    }

    function resetSession() {
        var char = _getChar();
        if (char) {
            _snapshot = {
                exp: char.exp || 0,
                jobExp: char.jobExp || 0,
                level: char.level || 1,
                jobLevel: char.jobLevel || 1
            };
        } else {
            _snapshot = { exp: 0, jobExp: 0, level: 1, jobLevel: 1 };
        }
        _sessionStart = Date.now();
        _battleDuration = 0;
        _totalKills = 0;
        _lootMap = {};
        // 立即更新一次
        update();
    }

    function onBattleStarted(data) {
        _isRunning = true;
        resetSession();
        var mapId = data ? data.mapId : null;
        _updateMapTitle(mapId);
        if (_throttledUpdate) _throttledUpdate();
    }

    function onBattleStopped() {
        _isRunning = false;
        if (_throttledUpdate) _throttledUpdate();
    }

    function onMonsterKilled(data) {
        _totalKills++;
        if (data.loot && data.loot.length) {
            for (var i = 0; i < data.loot.length; i++) {
                var lootStr = data.loot[i];
                var parts = lootStr.split(' x');
                var itemName = parts[0];
                var count = parts.length > 1 ? parseInt(parts[1], 10) : 1;
                if (isNaN(count) || count < 1) count = 1;
                if (!_lootMap[itemName]) _lootMap[itemName] = 0;
                _lootMap[itemName] += count;
            }
        }
        if (_throttledUpdate) _throttledUpdate();
    }

    function init() {
        if (_initialized) return;
        var bus = global.EventBus;
        if (!bus) { console.error('[UIBattleStats] EventBus 未加载'); return; }

        // ---- 【改动点2】节流间隔从 UIConfig 读取 ----
        var cfg = _getPanelConfig();
        var intervalMs = Math.max(100, (cfg.refreshInterval || 1) * 1000);

        // 使用 UIManager.throttle 或降级实现
        if (global.UIManager && typeof global.UIManager.throttle === 'function') {
            _throttledUpdate = global.UIManager.throttle(update.bind(this), intervalMs);
        } else {
            // 降级：使用简单的 throttle 实现
            var _lastUpdateTime = 0;
            _throttledUpdate = function() {
                var now = Date.now();
                if (now - _lastUpdateTime >= intervalMs) {
                    _lastUpdateTime = now;
                    update();
                }
            };
        }

        // 具名回调
        var onBattleStartedFn = function(data) { onBattleStarted(data); };
        var onBattleStoppedFn = function() { onBattleStopped(); };
        var onMonsterKilledFn = function(data) { onMonsterKilled(data); };
        var onExpChangedFn = function() { if (_throttledUpdate) _throttledUpdate(); };
        var onLevelUpFn = function() { if (_throttledUpdate) _throttledUpdate(); };
        var onJobLevelUpFn = function() { if (_throttledUpdate) _throttledUpdate(); };
        var onCharChangedFn = function() { if (_throttledUpdate) _throttledUpdate(); };
        var onMapChangedFn = function(data) {
            var mapId = data ? data.mapId : null;
            _updateMapTitle(mapId);
            if (_throttledUpdate) _throttledUpdate();
        };

        bus.on('battle:started', onBattleStartedFn);
        _listeners.push({ event: 'battle:started', fn: onBattleStartedFn });

        bus.on('battle:stopped', onBattleStoppedFn);
        _listeners.push({ event: 'battle:stopped', fn: onBattleStoppedFn });

        bus.on('battle:monsterKilled', onMonsterKilledFn);
        _listeners.push({ event: 'battle:monsterKilled', fn: onMonsterKilledFn });

        bus.on('char:expChanged', onExpChangedFn);
        _listeners.push({ event: 'char:expChanged', fn: onExpChangedFn });

        bus.on('char:levelUp', onLevelUpFn);
        _listeners.push({ event: 'char:levelUp', fn: onLevelUpFn });

        bus.on('char:jobLevelUp', onJobLevelUpFn);
        _listeners.push({ event: 'char:jobLevelUp', fn: onJobLevelUpFn });

        bus.on('char:changed', onCharChangedFn);
        _listeners.push({ event: 'char:changed', fn: onCharChangedFn });

        bus.on('map:changed', onMapChangedFn);
        _listeners.push({ event: 'map:changed', fn: onMapChangedFn });

        // UIMap 实际发出的地图切换事件是 ui:map-change（与 map:changed 同处理）
        bus.on('ui:map-change', onMapChangedFn);
        _listeners.push({ event: 'ui:map-change', fn: onMapChangedFn });

        // app:ready 时存档已加载完毕，重取一次地图标题（修复刷新后标题短暂显示默认地图）
        var onAppReadyFn = function() { _updateMapTitle(); };
        bus.on('app:ready', onAppReadyFn);
        _listeners.push({ event: 'app:ready', fn: onAppReadyFn });

        // 初始状态
        _isRunning = false;
        _battleDuration = 0;
        _sessionStart = Date.now();
        var char = _getChar();
        if (char) {
            _snapshot = {
                exp: char.exp || 0,
                jobExp: char.jobExp || 0,
                level: char.level || 1,
                jobLevel: char.jobLevel || 1
            };
        }
        update();
        _updateMapTitle();
        _initialized = true;
        console.log('[UIBattleStats] ✅ 已初始化（节流间隔: ' + intervalMs + 'ms）');

        if (global.UIManager && typeof global.UIManager.register === 'function') {
            global.UIManager.register(global.UIBattleStats);
        }
    }

    function dispose() {
        if (_throttledUpdate && typeof _throttledUpdate.cancel === 'function') {
            _throttledUpdate.cancel();
        }
        var bus = global.EventBus;
        if (!bus) return;
        for (var i = 0; i < _listeners.length; i++) {
            bus.off(_listeners[i].event, _listeners[i].fn);
        }
        _listeners = [];
        _initialized = false;
        console.log('[UIBattleStats] 已清理');
    }

    global.UIBattleStats = {
        name: 'UIBattleStats',
        init: init,
        dispose: dispose,
        update: update,
        resetSession: resetSession
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})(window);