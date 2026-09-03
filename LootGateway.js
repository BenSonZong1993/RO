// ============================================================
//  FILE: LootGateway.js
//  LAYER: gateway（掉落品质配置网关——window.LootGroups 唯一读取入口）
//  权限：loot:randomQuality（随机品质需过 AccessControl）
//  依赖：window.LootGroups、AccessControl
//  契约：
//    getQualityDef(qualityId)        → object|null
//    getDropRateModifier(qualityId)  → number
//    getAmountModifier(qualityId)    → number
//    randomQuality()                 → string|null（按权重随机）
//  说明：原 LootGroupManager 逻辑并入本网关
// ============================================================
(function(global) {
    'use strict';

    function getQualityDef(qualityId) {
        var groups = global.LootGroups || {};
        return groups[qualityId] || null;
    }

    function getDropRateModifier(qualityId) {
        var def = getQualityDef(qualityId);
        return def ? (def.dropRateMultiplier || 1.0) : 1.0;
    }

    function getAmountModifier(qualityId) {
        var def = getQualityDef(qualityId);
        return def ? (def.amountMultiplier || 1.0) : 1.0;
    }

    function randomQuality() {
        if (global.AccessControl && !global.AccessControl.check('loot:randomQuality', 'LootGateway')) {
            console.error('[LootGateway] 拒绝：loot:randomQuality 权限不足');
            return null;
        }
        var groups = global.LootGroups || {};
        var qualities = [];
        var totalWeight = 0;
        for (var key in groups) {
            if (!groups.hasOwnProperty(key)) continue;
            var def = groups[key];
            if (def.weight !== undefined) {
                qualities.push({ id: key, weight: def.weight });
                totalWeight += def.weight;
            }
        }
        if (qualities.length === 0) return null;

        var rand = Math.random() * totalWeight;
        for (var i = 0; i < qualities.length; i++) {
            rand -= qualities[i].weight;
            if (rand <= 0) return qualities[i].id;
        }
        return qualities[qualities.length - 1].id;
    }

    var LootGateway = {
        getQualityDef: getQualityDef,
        getDropRateModifier: getDropRateModifier,
        getAmountModifier: getAmountModifier,
        randomQuality: randomQuality,
    };

    if (global.AccessControl) {
        global.AccessControl.register('loot:randomQuality', ['LootGateway', 'LootManager']);
    }

    global.LootGateway = LootGateway;
    console.log('[LootGateway] ✅ 已加载（掉落品质配置网关）');
})(window);
