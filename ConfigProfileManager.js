// ================================================================
//  📁 js/core/ConfigProfileManager.js
//  职责：运行时配置网关（唯一决策中枢）
//  说明：所有业务模块通过此管理器读取当前配置，不直接依赖 ConfigProfiles
//  精简：移除多余缓存，仅保留单次构建
// ================================================================

(function(global) {
    'use strict';

    // ---------- 内置默认配置（与 ConfigProfiles.DEFAULT_PROFILE 对齐） ----------
    var BUILTIN_DEFAULT = {
        char: {
            atk: 1.0,
            def: 1.0,
            aspd: 1.0,
            expGain: 1.0,
            regen: { mode: 'smooth', hpInterval: 6, spInterval: 8, combatPenalty: 0.5 },
            battle: {
                attackPreRatio: 0.25,
                attackPostRatio: 0.75,
                defaultGcd: 0.2,
                minAttackInterval: 0.14,
                maxAttackInterval: 2.0,
                critChance: 0.1,
                interruptCooldown: 2.0,
                damageScaleMonster: 1.5,
                damageScalePlayer: 1.0,
            },
            skillAction: {
                basePre: 0.10,
                basePost: 0.15,
                weightFactor: 0.002,
                agiReduction: 0.0008,
                levelPreReduction: 0.001,
                aspdReduction: 0.12,
                spCostFactor: 0.0015,
                powerFactor: 0.0003,
                dexReduction: 0.0008,
                levelPostReduction: 0.001,
                maxInterval: 2.0,
                minPre: 0.05,
                maxPre: 0.40,
                minPost: 0.05,
                maxPost: 0.80,
                minTotal: 0.10,
                maxTotal: 1.20,
            },
            formula: {
                vitCoef: 0.2,
                mhpCoef: 0.005,
                intCoef: 0.1667,
                mspCoef: 0.01,
                bonusInt: 120,
                bonusAdd: 4,
                bonusPer: 0.5
            },
            collision: { radiusPx: 18 }
        },
        monster: {
            hp: 1.0,
            atk: 1.0,
            def: 1.0,
            exp: 1.0,
            jobExp: 1.0,
            wave: {
                mode: 0,
                sizeMin: 1,
                sizeMax: 4,
                interval: 0.5,
                enabled: true,
            },
            formation: {
                minRadiusPx: 680,
                maxRadiusPx: 800,
                generationType: 'fan',
                fanAngleDeg: 120,
                spawnBiasAngleDeg: -90,
                clusterSpreadPx: 60,
                speedBasePxPerSec: 96,
                speedVariance: 0.25,
                separationForcePx: 40,
                enableSeparation: true,
                collisionRadiusPx: 32,
            }
        },
        drop: { rate: 1.0, amount: 1.0 },
        flags: { isPermaDeath: false, respawnMap: 'prontera' },
        engine: { minDamage: 6, renewal: true }
    };

    // ---------- 私有状态 ----------
    var _userOverride = null;

    // ---------- 工具：从 MapGroups 查找地图所属分组 ----------
    function _findGroupForMap(mapId) {
        var groups = global.MapGroups;
        if (!groups) return null;
        for (var key in groups) {
            var group = groups[key];
            if (group.mapIds && group.mapIds.indexOf(mapId) !== -1) {
                return group;
            }
        }
        return groups.default || null;
    }

    // ---------- 解析地图应使用的模式名 ----------
    function resolveMode(mapId) {
        if (_userOverride) return _userOverride;
        var group = _findGroupForMap(mapId);
        return (group && group.mode) ? group.mode : 'default';
    }

    // ---------- 获取当前模式名称 ----------
    function getCurrentModeName(mapId) {
        if (!mapId) {
            if (global.DataCoordinator && typeof global.DataCoordinator.get === 'function') {
                mapId = global.DataCoordinator.get('map.currentId');
            }
            if (!mapId && global.MapRepository && typeof global.MapRepository.get === 'function') {
                mapId = global.MapRepository.get('currentId');
            }
            if (!mapId) return 'default';
        }
        return resolveMode(mapId);
    }

    // ---------- 获取当前模式的完整配置 ----------
    function getCurrentProfile(mapId) {
        var modeName = getCurrentModeName(mapId);

        // 优先从 ConfigProfiles 获取
        if (global.ConfigProfiles && typeof global.ConfigProfiles.getProfile === 'function') {
            var profile = global.ConfigProfiles.getProfile(modeName);
            if (profile) return profile;
        }

        // 降级：使用内置默认
        return JSON.parse(JSON.stringify(BUILTIN_DEFAULT));
    }

    // ---------- 获取波次配置（供 SpawnManager 使用） ----------
    function getCurrentWaveConfig(mapId) {
        var profile = getCurrentProfile(mapId);
        if (!profile || !profile.monster || !profile.monster.wave) {
            return { mode: 0, sizeMin: 1, sizeMax: 4, interval: 0.5, enabled: true };
        }
        var wave = profile.monster.wave;
        // 补全默认值
        if (wave.sizeMin === undefined) wave.sizeMin = 1;
        if (wave.sizeMax === undefined) wave.sizeMax = 4;
        if (wave.interval === undefined) wave.interval = 0.5;
        if (wave.enabled === undefined) wave.enabled = true;
        return wave;
    }

    // ---------- 用户手动切换模式 ----------
    function setUserOverride(modeName) {
        if (modeName) {
            _userOverride = modeName;
            if (global.EventBus) {
                global.EventBus.emit('config:profileChanged', { mode: modeName, source: 'user' });
            }
            try { localStorage.setItem('RO_UserModeOverride', modeName); } catch (e) {}
        }
    }

    function clearUserOverride() {
        _userOverride = null;
        try { localStorage.removeItem('RO_UserModeOverride'); } catch (e) {}
        if (global.EventBus) {
            global.EventBus.emit('config:profileChanged', { mode: null, source: 'clear' });
        }
    }

    // ---------- 初始化 ----------
    function init() {
        try {
            var saved = localStorage.getItem('RO_UserModeOverride');
            if (saved) _userOverride = saved;
        } catch (e) {}
    }

    // ---------- 公开 API ----------
    global.ConfigProfileManager = {
        resolveMode: resolveMode,
        getCurrentModeName: getCurrentModeName,
        getCurrentProfile: getCurrentProfile,
        getCurrentWaveConfig: getCurrentWaveConfig,
        setUserOverride: setUserOverride,
        clearUserOverride: clearUserOverride,
        init: init,
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    console.log('[ConfigProfileManager] ✅ 已加载');
})(window);