// ============================================================
//  📁 js/battle/SpawnManager.js
//  职责：纯执行计算器（生成、波次管理）
//  说明：所有配置从 ConfigProfileManager 读取，阵型默认值由 MonsterFormationController 统一提供
// ============================================================
(function(global) {
    'use strict';

    // ============================================================
    //  📋 刷怪管理器配置项表（策划可在此修改默认数值）
    //  说明：以下字段为默认值，若 ConfigProfileManager 提供覆盖值则优先使用覆盖值
    // ============================================================
    var SPAWN_MANAGER_CONFIG_TABLE = {
        // 波次默认配置（当 ConfigProfileManager 未提供时使用）
        wave: {
            sizeMin: 1,              // 每波怪物最小数量
            sizeMax: 4,              // 每波怪物最大数量
            interval: 0.5,           // 波次间隔（秒）
            enabled: true,           // 是否启用刷怪
        },
        // 怪物属性修正默认值（倍率）
        modifiers: {
            hp: 1.0,                 // 生命值倍率
            atk: 1.0,                // 攻击力倍率
            def: 1.0,                // 防御力倍率
            exp: 1.0,                // 经验倍率
            jobExp: 1.0,             // 职业经验倍率
        },
        // 初始化首次刷怪延迟（秒）
        initialWaveDelay: 0.2,
        // 初始化定时器延迟（毫秒），用于等待其他模块就绪
        initTimerDelayMs: 50,
    };

    // ---- 降级默认值（仅在无法获取配置时使用） ----
    var FALLBACK_WAVE = SPAWN_MANAGER_CONFIG_TABLE.wave;
    var DEFAULT_MODS = Object.assign({}, SPAWN_MANAGER_CONFIG_TABLE.modifiers);

    function _getMonsterModifiers() {
        var profile = global.ConfigProfileManager ? global.ConfigProfileManager.getCurrentProfile() : null;
        if (!profile || !profile.monster) return Object.assign({}, DEFAULT_MODS);
        var mods = profile.monster;
        for (var key in DEFAULT_MODS) {
            if (mods[key] === undefined) mods[key] = DEFAULT_MODS[key];
        }
        return mods;
    }

    function _isBlockedClass(template) {
        if (!template) return false;
        if (!global.DataCoordinator || typeof global.DataCoordinator.get !== 'function') return false;
        var cls = template.class !== undefined ? template.class : template.Class;
        if (cls === 'Boss' && global.DataCoordinator.get('ui.fearMvp') === true) return true;
        if (cls === 'Event' && global.DataCoordinator.get('ui.fearElite') === true) return true;
        return false;
    }

    var _monsters = [];
    var _mapId = '';
    var _isActive = false;
    var _waveConfig = null;
    var _width = 1920;
    var _height = 1080;
    var _waveIndex = 0;
    var _waveMonsters = [];
    var _waveCompleted = true;
    var _nextWaveTimer = 0;
    var _monsterWeightTable = [];
    var _formationGroups = {};
    var _nextFormationId = 0;
    var _initTimerId = null;

    function randomInt(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    function _buildMonsterWeightTable(mapId) {
        var mapInfo = global.MapService ? global.MapService.getMapById(mapId) : null;
        if (!mapInfo) return [];
        var spawns = mapInfo.spawns || [];
        var weightMap = {};
        for (var i = 0; i < spawns.length; i++) {
            var cfg = spawns[i];
            var mobId = cfg.mobId || cfg.monsterId;
            if (!mobId) continue;
            var amount = cfg.amount || 1;
            weightMap[mobId] = (weightMap[mobId] || 0) + amount;
        }
        var table = [];
        for (var id in weightMap) {
            var template = global.MonsterService ? global.MonsterService.getMonsterById(Number(id)) : null;
            if (template && !_isBlockedClass(template)) {
                table.push({ monsterId: Number(id), weight: weightMap[id], template: template });
            }
        }
        table.sort(function(a, b) { return b.weight - a.weight; });
        return table;
    }

    function _randomMonsterFromTable(table) {
        if (!table || table.length === 0) return null;
        table = table.filter(function(t) { return !_isBlockedClass(t.template); });
        if (table.length === 0) return null;
        var totalWeight = 0;
        for (var i = 0; i < table.length; i++) totalWeight += table[i].weight;
        var rand = Math.random() * totalWeight;
        for (var i = 0; i < table.length; i++) {
            rand -= table[i].weight;
            if (rand <= 0) return table[i];
        }
        return table[table.length - 1];
    }

    // ---- 核心生成逻辑 ----
    function _spawnWave() {
        if (!_waveConfig || _waveConfig.enabled === false) return;
        if (!_waveCompleted) return;

        var sizeMin = _waveConfig.sizeMin || 1;
        var sizeMax = _waveConfig.sizeMax || 4;
        var count = randomInt(sizeMin, sizeMax);

        // 从 ConfigProfileManager 获取阵型配置；若未提供，则使用 MonsterFormationController 的默认配置
        var formationConfig = null;
        var profile = global.ConfigProfileManager ? global.ConfigProfileManager.getCurrentProfile() : null;
        if (profile && profile.monster && profile.monster.formation) {
            formationConfig = profile.monster.formation;
        } else if (global.MonsterFormationController && typeof global.MonsterFormationController.getDefaultConfig === 'function') {
            formationConfig = global.MonsterFormationController.getDefaultConfig();
        }
        // 极端情况下（依赖未加载）提供一个最小后备，确保不崩溃（通常不会执行）
        if (!formationConfig) {
            formationConfig = {
                speedBasePxPerSec: 70,
                minRadiusPx: 150,
                maxRadiusPx: 300,
                generationType: 'circle',
                separationForcePx: 40,
                enableSeparation: true,
                clusterSpreadPx: 70,
                speedVariance: 0.25,
            };
        }

        var playerPos = { x: _width / 2, y: _height / 2 };
        if (global.BattleController && typeof global.BattleController.getPlayerPos === 'function') {
            var pos = global.BattleController.getPlayerPos();
            if (pos) playerPos = pos;
        }

        var spawns = global.MonsterFormationController.generateSpawnPositions(
            playerPos.x, playerPos.y,
            count,
            formationConfig
        );

        var mods = _getMonsterModifiers();
        var formationId = _nextFormationId++;
        var newMonsters = [];

        for (var i = 0; i < spawns.length; i++) {
            var selected = _randomMonsterFromTable(_monsterWeightTable);
            if (!selected) break;
            var monsterId = selected.monsterId;

            var unit = global.MonsterService.spawnMonsterUnit(monsterId, spawns[i].x, spawns[i].y);
            if (unit) {
                unit.hp = Math.floor((unit.hp || 100) * mods.hp);
                unit.maxHp = Math.floor((unit.maxHp || unit.hp || 100) * mods.hp);
                unit.atk = Math.floor((unit.atk || 1) * mods.atk);
                unit.def = Math.floor((unit.def || 0) * mods.def);

                unit.sightRange = 99999;
                unit.respawnMs = Infinity;
                unit._waveIndex = _waveIndex;
                unit._template = selected.template;
                unit.moveSpeed = formationConfig.speedBasePxPerSec * spawns[i].speedModifier;
                unit.chaseMultiplier = 1.0;
                unit.wanderRadius = 0;
                unit._alwaysChase = true;

                unit._formationId = formationId;
                unit._formationConfig = formationConfig;
                unit._relX = spawns[i].x - playerPos.x;
                unit._relY = spawns[i].y - playerPos.y;
                unit._speedModifier = spawns[i].speedModifier;

                _monsters.push(unit);
                newMonsters.push(unit);
            }
        }

        if (newMonsters.length > 0) {
            _formationGroups[formationId] = newMonsters.slice();
            _waveMonsters = newMonsters;
            _waveCompleted = false;
            _waveIndex++;
            if (global.EventBus) {
                global.EventBus.emit('spawn:waveStarted', {
                    waveIndex: _waveIndex,
                    count: newMonsters.length,
                    monsters: newMonsters,
                    formationId: formationId
                });
            }
        } else {
            _waveCompleted = true;
            _waveMonsters = [];
            _nextWaveTimer = _waveConfig.interval || 0.5;
        }
    }

    function _cleanDeadMonsters() {
        _monsters = _monsters.filter(function(m) { return m.alive !== false && m.visible !== false; });
    }

    // ---- 初始化 ----
    function init(mapId, width, height) {
        if (!global.MapService || !global.MonsterService) {
            console.error('[SpawnManager] 依赖未加载');
            return false;
        }

        if (_initTimerId) {
            clearTimeout(_initTimerId);
            _initTimerId = null;
        }

        _mapId = mapId;
        _width = width || 1920;
        _height = height || 1080;
        _monsters = [];
        _waveMonsters = [];
        _waveIndex = 0;
        _waveCompleted = true;
        _nextWaveTimer = 0;
        _isActive = false;
        _formationGroups = {};
        _nextFormationId = 0;

        var config = global.ConfigProfileManager && global.ConfigProfileManager.getCurrentWaveConfig
            ? global.ConfigProfileManager.getCurrentWaveConfig(mapId)
            : null;
        _waveConfig = config ? config : FALLBACK_WAVE;

        if (_waveConfig.enabled === false) {
            console.log('[SpawnManager] 当前模式禁用刷怪');
            return false;
        }

        _monsterWeightTable = _buildMonsterWeightTable(mapId);
        if (_monsterWeightTable.length === 0) {
            console.warn('[SpawnManager] 地图无可用怪物权重');
            return false;
        }

        _isActive = true;
        _waveCompleted = true;
        _nextWaveTimer = SPAWN_MANAGER_CONFIG_TABLE.initialWaveDelay;

        _initTimerId = setTimeout(function() {
            if (_isActive && global.SpawnManager && global.SpawnManager.isActive()) {
                global.SpawnManager.forceNextWave();
                global.SpawnManager.update(0.1, 1920, 1080);
            }
            _initTimerId = null;
        }, SPAWN_MANAGER_CONFIG_TABLE.initTimerDelayMs);

        return true;
    }

    // ---- 每帧更新 ----
    function update(delta, width, height) {
        if (!_isActive) return;
        if (width) _width = width;
        if (height) _height = height;

        if (_waveCompleted) {
            _nextWaveTimer -= delta;
            if (_nextWaveTimer <= 0) {
                _spawnWave();
            }
            return;
        }

        var allDead = true;
        for (var i = 0; i < _waveMonsters.length; i++) {
            if (_waveMonsters[i].alive) { allDead = false; break; }
        }
        if (allDead) {
            _waveCompleted = true;
            _waveMonsters = [];
            _cleanDeadMonsters();
            _nextWaveTimer = _waveConfig.interval || 0.5;
            if (global.EventBus) {
                global.EventBus.emit('spawn:waveCompleted', {
                    waveIndex: _waveIndex,
                    nextWaveIn: _nextWaveTimer
                });
            }
        }
    }

    // ---- 公开接口 ----
    function getMonsters() { return _monsters; }
    function getAliveMonsters() {
        return _monsters.filter(function(m) { return m.alive && m.visible; });
    }
    function markDead(monster) {
        if (!monster) return;
        monster.alive = false;
        monster.visible = false;
    }
    function reset() {
        if (_initTimerId) {
            clearTimeout(_initTimerId);
            _initTimerId = null;
        }
        _monsters = [];
        _waveMonsters = [];
        _waveIndex = 0;
        _waveCompleted = true;
        _nextWaveTimer = 0;
        _isActive = false;
        _waveConfig = null;
        _formationGroups = {};
        _nextFormationId = 0;
    }
    function isActive() { return _isActive; }
    function getWaveIndex() { return _waveIndex; }
    function getWaveConfig() { return _waveConfig; }
    function getWeightTable() { return _monsterWeightTable; }
    function getMonstersByFormationId(formationId) {
        return _formationGroups[formationId] || [];
    }
    function forceNextWave() {
        if (!_isActive) {
            console.warn('[SpawnManager] 当前未激活');
            return;
        }
        _waveCompleted = true;
        _nextWaveTimer = 0;
    }

    global.SpawnManager = {
        init: init,
        update: update,
        getMonsters: getMonsters,
        getAliveMonsters: getAliveMonsters,
        markDead: markDead,
        reset: reset,
        isActive: isActive,
        getWaveIndex: getWaveIndex,
        getWaveConfig: getWaveConfig,
        getWeightTable: getWeightTable,
        getMonstersByFormationId: getMonstersByFormationId,
        forceNextWave: forceNextWave,
        getMonsterModifiers: _getMonsterModifiers,
    };

    console.log('[SpawnManager] ✅ 已加载');
})(window);