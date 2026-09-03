// js/ui/UIAttributes.js
// ============================================================
//  个人素质 / 基础属性面板（v4.0：网关化）
//  权限：无（UI 只读；加点经 ui:allocate-stat 事件 → CharController）
//  依赖：AttributeGateway（最终属性唯一读取入口）、JobGateway（转生阶段/奖励点）、
//        ArithmeticCore（属性点公式——LevelData 已并入）、CharController、EventBus、UIManager
//  v4.0 变更：
//    - LevelData.getStatPointCost → ArithmeticCore.getStatPointCost（LevelData 已删除）
//    - JobGroupManager.getJobDef → JobGateway.getJobDef（JobGroupManager 已并入网关）
//    - 转生奖励点 52*count 硬编码 → JobGateway.getBonusStatPoints（配置驱动）
//    - AttributeMediator.getDerivedValue ×N → AttributeGateway.getAll（收费站统一读取）
// ============================================================
(function(global) {
    'use strict';

    var STAT_KEYS = ['str', 'agi', 'vit', 'int', 'dex', 'luk'];
    var _listeners = [];
    var _initialized = false;
    var _elements = {};
    var _throttledRefresh = null;   // 节流版 refreshAll

    function _getEl(id) {
        if (!_elements[id]) {
            _elements[id] = document.getElementById(id);
        }
        return _elements[id];
    }

    function setText(id, text) {
        var el = _getEl(id);
        if (el) el.textContent = text;
    }

function updateStatDisplay(statKey) {
    var char = global.CharRepository ? global.CharRepository.getLiveRef()
        : (global.CharController ? global.CharController.getChar() : null);
    if (!char) return;
    var val = char.stats[statKey] || 1;
    setText('stat-' + statKey, val);

    var cost = global.ArithmeticCore && typeof global.ArithmeticCore.getStatPointCost === 'function'
        ? global.ArithmeticCore.getStatPointCost(val)
        : 1;
    setText('cost-' + statKey, cost);

    var final = char._finalStats ? char._finalStats[statKey] : val;
    // ★★★ 增加防护：若最终值小于基础值（尚未同步），则跳过更新加成显示，避免负号 ★★★
    if (final < val) {
        return;  // 保持原有加成显示，等待最终刷新
    }
    var bonus = final - val;
    var bonusEl = _getEl('bonus-' + statKey);
    if (bonusEl) {
        bonusEl.textContent = bonus > 0 ? '+' + bonus : (bonus < 0 ? '' + bonus : '+0');
    }
}
    function updateStatPoints() {
        var char = global.CharRepository ? global.CharRepository.getLiveRef()
            : (global.CharController ? global.CharController.getChar() : null);
        if (!char) return;
        setText('stat-points', char.statPoints || 0);

        // 转生累计奖励属性点（配置驱动，经 JobGateway）
        var rebirthCount = char.rebirthCount || 0;
        var bonusPoints = global.JobGateway ? global.JobGateway.getBonusStatPoints(rebirthCount) : 0;
        var totalPoints = 48 + bonusPoints;
        setText('rebirth-count', rebirthCount);
        setText('bonus-stat-points', bonusPoints);
        setText('total-stat-points', totalPoints);
    }

    function updateBaseStats() {
        var char = global.CharRepository ? global.CharRepository.getLiveRef()
            : (global.CharController ? global.CharController.getChar() : null);
        if (!char) return;

        var final = {};
        if (global.AttributeGateway && typeof global.AttributeGateway.getAll === 'function') {
            final = global.AttributeGateway.getAll('UIAttributes') || {};
        } else if (global.AttributeMediator && typeof global.AttributeMediator.getDerivedValue === 'function') {
            final.finalATK = global.AttributeMediator.getDerivedValue('finalATK') || 0;
            final.finalMATK = global.AttributeMediator.getDerivedValue('finalMATK') || 0;
            final.finalDEF = global.AttributeMediator.getDerivedValue('finalDEF') || 0;
            final.finalMDEF = global.AttributeMediator.getDerivedValue('finalMDEF') || 0;
            final.finalMaxHP = global.AttributeMediator.getDerivedValue('finalMaxHP') || 100;
            final.finalMaxSP = global.AttributeMediator.getDerivedValue('finalMaxSP') || 50;
            final.panelHIT = global.AttributeMediator.getDerivedValue('panelHIT') || 0;
            final.cri = global.AttributeMediator.getDerivedValue('cri') || 0;
            final.panelFLEE = global.AttributeMediator.getDerivedValue('panelFLEE') || 0;
            final.aspeed = global.AttributeMediator.getDerivedValue('aspeed') || 0;
            final.attackRange = global.AttributeMediator.getDerivedValue('attackRange') || RO_CONSTANTS.DEFAULT_ATTACK_RANGE;
            final.attackElement = global.AttributeMediator.getDerivedValue('attackElement') || 'Neutral';
        } else {
            final = char._finalStats || {};
        }

        var elemResist = (final.modifiers && final.modifiers.elementalReduceDamage) || {};

        var map = {
            'char-atk': final.finalATK !== undefined ? Math.floor(final.finalATK) : 0,
            'char-matk': final.finalMATK !== undefined ? Math.floor(final.finalMATK) : 0,
            'char-def': final.finalDEF !== undefined ? Math.floor(final.finalDEF) : 0,
            'char-mdef': final.finalMDEF !== undefined ? Math.floor(final.finalMDEF) : 0,
            'char-hp': final.finalMaxHP !== undefined ? Math.floor(final.finalMaxHP) : 100,
            'char-sp': final.finalMaxSP !== undefined ? Math.floor(final.finalMaxSP) : 50,
            'char-hit': final.panelHIT !== undefined ? Math.floor(final.panelHIT) : 0,
            'char-crit': final.cri !== undefined ? Math.floor(final.cri) : 0,
            'char-flee': final.panelFLEE !== undefined ? Math.floor(final.panelFLEE) : 0,
            'char-aspd': final.aspeed !== undefined ? Math.round(final.aspeed) : 0,
            'char-range': final.attackRange !== undefined ? Math.floor(final.attackRange) : RO_CONSTANTS.PIXELS_PER_CELL,
            'char-element': final.attackElement || 'Neutral',
            'char-perfect-dodge': final.perfectDodge !== undefined ? Math.floor(final.perfectDodge) : 0,
            'char-crit-damage': final.criDamage !== undefined ? final.criDamage : '0',
        };
        for (var id in map) {
            if (Object.prototype.hasOwnProperty.call(map, id)) {
                setText(id, map[id]);
            }
        }

        // 元素抗性（面板可能被注释隐藏）
        var elemMap = {
            'Neutral': 'neutral', 'Water': 'water', 'Earth': 'earth', 'Fire': 'fire',
            'Wind': 'wind', 'Poison': 'poison', 'Holy': 'holy', 'Dark': 'dark',
            'Ghost': 'ghost', 'Undead': 'undead'
        };
        var panel = _getEl('panel-resist-elem');
        if (!panel) return;
        var lines = panel.querySelectorAll('.resist-line');
        lines.forEach(function(line) { line.style.display = 'none'; });
        for (var elem in elemMap) {
            var val = elemResist[elem] || 0;
            var el = _getEl('elem-resist-' + elemMap[elem]);
            if (el) el.textContent = val + '%';
            if (val !== 0) {
                var line = document.querySelector('.resist-line[data-element="' + elemMap[elem] + '"]');
                if (line) line.style.display = 'flex';
            }
        }
    }

    // ===== 核心刷新函数 =====
    function refreshAll() {
        var char = global.CharRepository ? global.CharRepository.getLiveRef()
            : (global.CharController ? global.CharController.getChar() : null);
        if (char) {
            setText('char-name', char.name);
            setText('char-level', char.level);
            setText('char-joblevel', char.jobLevel);
            var jobDef = global.JobGateway ? global.JobGateway.getJobDef(char.jobKey) : null;
            var jobDisplay = jobDef ? jobDef.name : (char.jobKey || 'Novice');
            setText('char-job', jobDisplay);

            var rebirthCount = char.rebirthCount || 0;
            var bonusPoints = global.JobGateway ? global.JobGateway.getBonusStatPoints(rebirthCount) : 0;
            var totalPoints = 48 + bonusPoints;
            setText('rebirth-count', rebirthCount);
            setText('bonus-stat-points', bonusPoints);
            setText('total-stat-points', totalPoints);
        }
        for (var i = 0; i < STAT_KEYS.length; i++) {
            updateStatDisplay(STAT_KEYS[i]);
        }
        updateStatPoints();
        updateBaseStats();
    }

    function handleAllocateStat(data) {
        if (!global.CharController) return;
        var stat = data.stat;
        var amount = data.amount;
        if (stat && amount) {
            global.CharController.allocateStat(stat, amount);
        }
    }

    function init() {
        if (_initialized) return;
        if (!global.EventBus) {
            console.error('[UIAttributes] EventBus 未加载');
            return;
        }

        // 创建节流版 refreshAll (200ms)
        _throttledRefresh = global.UIManager.throttle(refreshAll.bind(this), 200);

        var bus = global.EventBus;

        function onAllocateStat(data) { handleAllocateStat(data); }
function onStatAllocated(data) {
    if (data && data.stat) {
        // 1. 只更新基础净属性值（不涉及最终属性）
        var char = global.CharRepository ? global.CharRepository.getLiveRef() : null;
        if (char) {
            var val = char.stats[data.stat] || 1;
            setText('stat-' + data.stat, val);
        }
        // 2. 更新剩余属性点
        updateStatPoints();
        // 3. 注意：不调用 updateStatDisplay 或 _throttledRefresh
        //    加成和最终属性等待 char:statsRecalculated 事件刷新
    }
}
        
        function onCharChanged() { _throttledRefresh(); }
        function onLevelUp() { _throttledRefresh(); }
        function onJobLevelUp() { _throttledRefresh(); }
        function onStatsRecalculated() { _throttledRefresh(); }
        function onHpChanged() { _throttledRefresh(); }
        function onJobChanged() { _throttledRefresh(); }
        function onRebirth() { _throttledRefresh(); }

        bus.on('ui:allocate-stat', onAllocateStat);
        _listeners.push({ event: 'ui:allocate-stat', fn: onAllocateStat });

        bus.on('char:statAllocated', onStatAllocated);
        _listeners.push({ event: 'char:statAllocated', fn: onStatAllocated });

        bus.on('char:changed', onCharChanged);
        _listeners.push({ event: 'char:changed', fn: onCharChanged });

        bus.on('char:levelUp', onLevelUp);
        _listeners.push({ event: 'char:levelUp', fn: onLevelUp });

        bus.on('char:jobLevelUp', onJobLevelUp);
        _listeners.push({ event: 'char:jobLevelUp', fn: onJobLevelUp });

        bus.on('char:statsRecalculated', onStatsRecalculated);
        _listeners.push({ event: 'char:statsRecalculated', fn: onStatsRecalculated });

        bus.on('char:hpChanged', onHpChanged);
        _listeners.push({ event: 'char:hpChanged', fn: onHpChanged });

        bus.on('job:changed', onJobChanged);
        _listeners.push({ event: 'job:changed', fn: onJobChanged });

        bus.on('char:rebirth', onRebirth);
        _listeners.push({ event: 'char:rebirth', fn: onRebirth });

        refreshAll();
        _initialized = true;
        console.log('[UIAttributes] ✅ 已初始化（v4.0：AttributeGateway/JobGateway）');

        if (global.UIManager && typeof global.UIManager.register === 'function') {
            global.UIManager.register(global.UIAttributes);
        }
    }

    function dispose() {
        if (_throttledRefresh && typeof _throttledRefresh.cancel === 'function') {
            _throttledRefresh.cancel();
        }
        var bus = global.EventBus;
        if (!bus) return;
        for (var i = 0; i < _listeners.length; i++) {
            bus.off(_listeners[i].event, _listeners[i].fn);
        }
        _listeners = [];
        _initialized = false;
        console.log('[UIAttributes] 事件监听已清理');
    }

    // 暴露全局
    global.UIAttributes = {
        name: 'UIAttributes',
        init: init,
        dispose: dispose,
        refreshAll: refreshAll,
        updateBaseStats: updateBaseStats,
        updateStatDisplay: updateStatDisplay,
        updateStatPoints: updateStatPoints
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})(window);
