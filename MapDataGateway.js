// ============================================================
//  FILE: MapDataGateway.js
//  LAYER: gateway（地图静态数据网关——window.MapData/MapGroups 唯一读取入口）
//  权限：无（静态只读数据）
//  依赖：window.MapData / window.MapGroups
//  契约：
//    getMapById(mapId)    → object|null（原始引用，只读约定；战斗热路径直读）
//    getSpawns(mapId)     → array
//    getTerrain(mapId)    → string
//    getGroup / getGroupId / getSpawnConfig / getExpMultiplier / getDifficulty / getSpawnStrategy
//  说明：原 MapGroupManager 逻辑并入本网关；未分组地图自动归入 'default' 组
// ============================================================
(function(global) {
    'use strict';

    var _mapToGroup = {};
    var _mapIndex = {};          // mapId → map 对象（原始引用，只读）
    var _initialized = false;

    // ---- 初始化：建地图索引 + 分组映射 ----
    function init() {
        if (_initialized) return true;

        var groups = global.MapGroups || {};
        var mapData = global.MapData || [];

        if (Array.isArray(mapData)) {
            for (var i = 0; i < mapData.length; i++) {
                if (mapData[i] && mapData[i].id) _mapIndex[mapData[i].id] = mapData[i];
            }
        }

        if (!groups || Object.keys(groups).length === 0) {
            console.warn('[MapDataGateway] 无地图组配置');
            _initialized = true;
            return false;
        }

        // 1. 从配置建立映射
        for (var groupId in groups) {
            if (!groups.hasOwnProperty(groupId)) continue;
            var group = groups[groupId];
            if (group.mapIds && Array.isArray(group.mapIds)) {
                for (var j = 0; j < group.mapIds.length; j++) {
                    var mapId = group.mapIds[j];
                    if (typeof mapId === 'string') _mapToGroup[mapId] = groupId;
                }
            }
        }

        // 2. MapData 中未分组的地图归入 default
        var defaultCount = 0;
        for (var id in _mapIndex) {
            if (!_mapToGroup[id]) {
                _mapToGroup[id] = 'default';
                defaultCount++;
                if (groups.default && groups.default.mapIds) groups.default.mapIds.push(id);
            }
        }

        // 3. 城镇动态合成（名单单一事实来源 = MapFlagData.TOWN_MAPS；中文名/开关 = TownMapConfig）
        //    安全区无怪物：monsterIds/spawns 均为空数组，地形标记为 town
        var townCfg = global.TownMapConfig || {};
        var townList = (global.MapFlagData && typeof global.MapFlagData.getTownList === 'function')
            ? global.MapFlagData.getTownList() : [];
        var townCount = 0;
        for (var t = 0; t < townList.length; t++) {
            var townId = townList[t];
            var townMeta = townCfg[townId];
            if (!townMeta || townMeta.enabled !== true) continue;   // 未开放城镇不生成
            if (_mapIndex[townId]) continue;                        // MapData 已有同名地图则不覆盖
            _mapIndex[townId] = {
                id: townId,
                chineseName: townMeta.chineseName || townId,
                terrain: 'town',
                width: 1920,
                height: 1080,
                monsterIds: [],
                spawns: [],
            };
            townCount++;
        }

        _initialized = true;
        console.log('[MapDataGateway] ✅ 已索引 ' + Object.keys(_mapToGroup).length + ' 张地图，' + defaultCount + ' 张归入默认组，合成 ' + townCount + ' 座开放城镇');
        return true;
    }

    function _ensureInit() { if (!_initialized) init(); }

    // ============================================================
    //  地图基础查询（window.MapData）
    // ============================================================
    function getMapById(mapId) {
        _ensureInit();
        return _mapIndex[mapId] || null;
    }

    function getSpawns(mapId) {
        var map = getMapById(mapId);
        return map ? (map.spawns || []) : [];
    }

    function getMonsterIdsOnMap(mapId) {
        var map = getMapById(mapId);
        if (!map) return [];
        var ids = map.monsterIds || map.monsters || map.monsterList || [];
        if (Array.isArray(ids) && ids.length > 0 && typeof ids[0] === 'object' && ids[0].id !== undefined) {
            ids = ids.map(function(item) { return item.id; });
        }
        return ids;
    }
    
    function getTerrain(mapId) {
        var map = getMapById(mapId);
        return map ? (map.terrain || 'field') : 'field';
    }

    function getMapSize(mapId) {
        var map = getMapById(mapId);
        return map ? { width: map.width || 1920, height: map.height || 1080 } : { width: 1920, height: 1080 };
    }

    function getDisplayName(mapId) {
        var map = getMapById(mapId);
        return map ? (map.chineseName || map.id) : mapId;
    }

    // ---- 城镇判定代理（唯一合法读取 MapFlagData 的位置） ----
    function isTown(mapId) {
        _ensureInit();
        if (global.MapFlagData && typeof global.MapFlagData.isTown === 'function') {
            return global.MapFlagData.isTown(mapId);
        }
        return getTerrain(mapId) === 'town';
    }

    // ---- 全量地图快照（含动态合成的城镇；供 UIMap 下拉等 UI 使用） ----
    // 注意：必须携带 monsterIds，否则下拉列表的平均等级恒为 0（历史 bug 根因）
    function getAllMaps() {
        _ensureInit();
        var out = [];
        for (var id in _mapIndex) {
            if (!_mapIndex.hasOwnProperty(id)) continue;
            var m = _mapIndex[id];
            var ids = m.monsterIds || m.monsters || m.monsterList || [];
            if (Array.isArray(ids) && ids.length > 0 && typeof ids[0] === 'object' && ids[0].id !== undefined) {
                ids = ids.map(function(item) { return item.id; });
            }
            out.push({
                id: m.id,
                chineseName: m.chineseName,
                terrain: m.terrain || 'field',
                width: m.width,
                height: m.height,
                monsterIds: ids,
            });
        }
        return out;
    }


    // ============================================================
    //  分组查询（原 MapGroupManager）
    // ============================================================
    function getGroupId(mapId) {
        _ensureInit();
        return _mapToGroup[mapId] || 'default';
    }

    function getGroup(mapId) {
        var groupId = getGroupId(mapId);
        return (global.MapGroups || {})[groupId] || null;
    }

    function getSpawnConfig(mapId) {
        var group = getGroup(mapId);
        if (!group) return null;

        var base = { amount: 80, respawnMs: 5000 };
        var template = group.spawnTemplate || {};
        var config = {
            amount: template.amount || base.amount,
            respawnMs: template.respawnMs || base.respawnMs,
        };
        config.amount = Math.floor((template.amount || base.amount) * (group.spawnMultiplier || 1.0));
        return config;
    }

    function getExpMultiplier(mapId) {
        var group = getGroup(mapId);
        return group ? (group.expMultiplier || 1.0) : 1.0;
    }

    function getDifficulty(mapId) {
        var group = getGroup(mapId);
        return group ? (group.difficulty || 1) : 1;
    }

    function getSpawnStrategy(mapId) {
        var group = getGroup(mapId);
        if (!group) return null;
        var strategy = group.spawnStrategy || { mode: 1 };
        if (window.__GLOBAL_SPAWN_MODE !== undefined && typeof window.__GLOBAL_SPAWN_MODE === 'number') {
            strategy = JSON.parse(JSON.stringify(strategy));
            strategy.mode = window.__GLOBAL_SPAWN_MODE;
        }
        return strategy;
    }

    var MapDataGateway = {
        init: init,
        getAllMaps: getAllMaps,
        getMapById: getMapById,
        getSpawns: getSpawns,
        getMonsterIdsOnMap: getMonsterIdsOnMap,
        getTerrain: getTerrain,
        getMapSize: getMapSize,
        getDisplayName: getDisplayName,
        isTown: isTown,
        getGroupId: getGroupId,
        getGroup: getGroup,
        getSpawnConfig: getSpawnConfig,
        getExpMultiplier: getExpMultiplier,
        getDifficulty: getDifficulty,
        getSpawnStrategy: getSpawnStrategy,
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() { MapDataGateway.init(); });
    } else {
        MapDataGateway.init();
    }

    global.MapDataGateway = MapDataGateway;
    console.log('[MapDataGateway] ✅ 已加载（地图静态数据网关）');
})(window);
