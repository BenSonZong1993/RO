// js/services/IndexService.js
// ============================================================
//  职责：建立物品 ↔ 怪物 ↔ 地图 的关联索引，并提供查询接口
//  特点：懒加载、静默构建、双向查询、可扩展
//  依赖：ItemDataGateway, MonsterService, MapDataGateway（均通过 window 访问，禁止直读 MonsterData/MapData）
//  不依赖：任何 UI 模块
// ============================================================
(function(global) {
    'use strict';

    // ---- 缓存 ----
    var _cache = {
        itemToMonsters: {},   // itemId → [monsterInfo]
        monsterToMaps: {},    // monsterId → [mapInfo]
        mapToMonsters: {},    // mapId → [monsterInfo]
        built: false,
        stats: { itemCount: 0, monsterCount: 0, mapCount: 0, relationCount: 0 }
    };

    // ---- 工具：获取物品定义 ----
    function _getItemDef(itemId) {
        return global.ItemDataGateway ? global.ItemDataGateway.getById(itemId) : null;
    }

    // ---- 工具：获取怪物名称 ----
    function _getMonsterName(monster) {
        return monster.ChineseName || monster.Name || ('#' + monster.Id);
    }

    // ---- 工具：获取地图名称 ----
    function _getMapName(map) {
        return map.chineseName || map.name || map.id;
    }

    // ---- 核心构建函数 ----
function build(force) {
    // 如果已构建且非强制，则跳过
    if (_cache.built && !force) {
        console.log('[IndexService] 索引已构建，跳过');
        return;
    }

    // 强制重建时重置缓存
    if (force) {
        _cache.built = false;
        _cache.itemToMonsters = {};
        _cache.monsterToMaps = {};
        _cache.mapToMonsters = {};
        _cache.stats = { itemCount: 0, monsterCount: 0, mapCount: 0, relationCount: 0 };
        console.log('[IndexService] 强制重建缓存...');
    }

    console.log('[IndexService] 开始构建索引...');
    var startTime = Date.now();

    // ---- 以下全部为原有构建逻辑，原封不动（数据源改走 MonsterService / MapDataGateway） ----
    var monsters = (global.MonsterService && typeof global.MonsterService.getAllMonsters === 'function')
        ? global.MonsterService.getAllMonsters() : [];
    var maps = (global.MapDataGateway && typeof global.MapDataGateway.getAllMaps === 'function')
        ? global.MapDataGateway.getAllMaps() : [];
    var gateway = global.ItemDataGateway;

    if (!gateway) {
        console.warn('[IndexService] ItemDataGateway 未加载，无法构建');
        return;
    }

    for (var mi = 0; mi < monsters.length; mi++) {
        var monster = monsters[mi];
        if (!monster || !monster.drops) continue;
        var drops = monster.drops;
        for (var di = 0; di < drops.length; di++) {
            var drop = drops[di];
            var itemKey = drop.Item;
            if (!itemKey) continue;

var def = gateway.getByAegis(itemKey);
if (!def) {
    // 尝试数字 ID
    var idNum = parseInt(itemKey, 10);
    if (!isNaN(idNum)) {
        def = gateway.getById(idNum);
    }
}
if (!def) {
    // 尝试忽略大小写（遍历 ItemNameMap 反查）
    if (global.ItemNameMap && typeof global.ItemNameMap === 'object') {
        var lowerKey = String(itemKey).toLowerCase();
        for (var aegis in global.ItemNameMap) {
            if (aegis.toLowerCase() === lowerKey) {
                var idFromMap = global.ItemNameMap[aegis];
                def = gateway.getById(idFromMap);
                break;
            }
        }
    }
}
            
            if (!def) continue;

            var itemId = def.Id;
            if (!_cache.itemToMonsters[itemId]) {
                _cache.itemToMonsters[itemId] = [];
            }
            var exists = _cache.itemToMonsters[itemId].some(function(m) {
                return m.monsterId === monster.Id;
            });
            if (!exists) {
                _cache.itemToMonsters[itemId].push({
                    monsterId: monster.Id,
                    name: _getMonsterName(monster),
                    level: monster.level || 0,
                    race: monster.race || '',
                    element: monster.element || '',
                    dropRate: drop.Rate || 0,
                    _raw: monster
                });
                _cache.stats.relationCount++;
            }
        }
    }

    for (var mapi = 0; mapi < maps.length; mapi++) {
        var map = maps[mapi];
        if (!map || !map.monsterIds) continue;
        var monsterIds = map.monsterIds;
        for (var idi = 0; idi < monsterIds.length; idi++) {
            var mId = monsterIds[idi];
            if (!_cache.monsterToMaps[mId]) {
                _cache.monsterToMaps[mId] = [];
            }
            var exists = _cache.monsterToMaps[mId].some(function(m) {
                return m.mapId === map.id;
            });
            if (!exists) {
                _cache.monsterToMaps[mId].push({
                    mapId: map.id,
                    name: _getMapName(map),
                    terrain: map.terrain || 'field'
                });
            }
        }
    }

    for (var mapi2 = 0; mapi2 < maps.length; mapi2++) {
        var map2 = maps[mapi2];
        if (!map2 || !map2.monsterIds) continue;
        var ids2 = map2.monsterIds;
        var monsterList = [];
        for (var idi2 = 0; idi2 < ids2.length; idi2++) {
            var mid2 = ids2[idi2];
            for (var mi2 = 0; mi2 < monsters.length; mi2++) {
                if (monsters[mi2].Id === mid2) {
                    monsterList.push({
                        monsterId: mid2,
                        name: _getMonsterName(monsters[mi2]),
                        level: monsters[mi2].level || 0,
                        race: monsters[mi2].race || '',
                        element: monsters[mi2].element || ''
                    });
                    break;
                }
            }
        }
        _cache.mapToMonsters[map2.id] = monsterList;
    }

    _cache.stats.itemCount = Object.keys(_cache.itemToMonsters).length;
    _cache.stats.monsterCount = Object.keys(_cache.monsterToMaps).length;
    _cache.stats.mapCount = Object.keys(_cache.mapToMonsters).length;
    _cache.built = true;

    console.log('[IndexService] ✅ 索引构建完成，耗时 ' + (Date.now() - startTime) + 'ms');
    console.log('[IndexService] 统计:', _cache.stats);
}

    // ---- 查询接口 ----
    function getMonstersForItem(itemId) {
        if (!_cache.built) build();
        return _cache.itemToMonsters[itemId] || [];
    }

    function getMapsForMonster(monsterId) {
        if (!_cache.built) build();
        return _cache.monsterToMaps[monsterId] || [];
    }

    function getMonstersForMap(mapId) {
        if (!_cache.built) build();
        return _cache.mapToMonsters[mapId] || [];
    }

    function getItemsForMap(mapId) {
        if (!_cache.built) build();
        var monsters = getMonstersForMap(mapId);
        var items = [];
        // 收集所有怪物掉落的物品
        for (var i = 0; i < monsters.length; i++) {
            var mId = monsters[i].monsterId;
            // 反向查找：哪些物品被这个怪物掉落
            for (var itemId in _cache.itemToMonsters) {
                var list = _cache.itemToMonsters[itemId];
                for (var j = 0; j < list.length; j++) {
                    if (list[j].monsterId === mId) {
                        items.push(parseInt(itemId, 10));
                        break;
                    }
                }
            }
        }
        // 去重
        return items.filter(function(v, idx, self) {
            return self.indexOf(v) === idx;
        });
    }

    function isReady() {
        return _cache.built;
    }

    function getStats() {
        return _cache.stats;
    }

    // ---- 初始化（仅注册，不立即构建） ----
    function init() {
        console.log('[IndexService] 已注册，将在 app:ready 后构建');
        // 只注册，不立即构建
    }

    // ---- 暴露全局 ----
    global.IndexService = {
        init: init,
        build: build,
        isReady: isReady,
        getMonstersForItem: getMonstersForItem,
        getMapsForMonster: getMapsForMonster,
        getMonstersForMap: getMonstersForMap,
        getItemsForMap: getItemsForMap,
        getStats: getStats
    };

    console.log('[IndexService] ✅ 已加载');
})(window);