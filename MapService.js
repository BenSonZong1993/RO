// ============================================================
//  FILE: MapService.js
//  LAYER: services（地图服务——MapDataGateway 的薄门面，保持旧接口）
//  权限：无（只读查询）
//  依赖：MapDataGateway（静态数据唯一入口）
//  契约（与旧版一致）：
//    init / getAllMaps / getMapById / getSpawns / getMonsterIdsOnMap /
//    getDisplayName / getMapSize / getGroupId / getGroup
//  说明：静态数据读取已全部下沉到 MapDataGateway（规则 GATE-1）
// ============================================================
(function(global) {
    'use strict';

    function init() {
        var ok = global.MapDataGateway ? global.MapDataGateway.init() : false;
        if (!ok) console.warn('[MapService] MapDataGateway 初始化失败');
        return ok;
    }

    function getAllMaps() {
        // 经网关返回全量地图快照（含动态合成的城镇；规则 GATE-1）
        if (global.MapDataGateway && typeof global.MapDataGateway.getAllMaps === 'function') {
            return global.MapDataGateway.getAllMaps();
        }
        var maps = global.MapData || [];
        return maps.map(function(m) {
            return { id: m.id, chineseName: m.chineseName, width: m.width, height: m.height };
        });
    }

    global.MapService = {
        init: init,
        getAllMaps: getAllMaps,
        getMapById: function(mapId) { return global.MapDataGateway ? global.MapDataGateway.getMapById(mapId) : null; },
        getSpawns: function(mapId) { return global.MapDataGateway ? global.MapDataGateway.getSpawns(mapId) : []; },
        getMonsterIdsOnMap: function(mapId) { return global.MapDataGateway ? global.MapDataGateway.getMonsterIdsOnMap(mapId) : []; },
        getDisplayName: function(mapId) { return global.MapDataGateway ? global.MapDataGateway.getDisplayName(mapId) : mapId; },
        getMapSize: function(mapId) { return global.MapDataGateway ? global.MapDataGateway.getMapSize(mapId) : { width: 1920, height: 1080 }; },
        getGroupId: function(mapId) { return global.MapDataGateway ? global.MapDataGateway.getGroupId(mapId) : 'default'; },
        getGroup: function(mapId) { return global.MapDataGateway ? global.MapDataGateway.getGroup(mapId) : null; },
    };

    console.log('[MapService] ✅ 已加载（MapDataGateway 薄门面）');
})(window);
