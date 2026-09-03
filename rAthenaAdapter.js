
// ============================================================
//  rAthenaAdapter.js - 数据适配层
//  将项目数据映射为 rAthena 引擎期望的结构
//  生成时间: 2026-08-19 23:24:44.583172
// ============================================================
(function(global) {
    'use strict';

    // ----- 全局适配器函数 -----
    global.getSC = function(bl) {
        // 从 block_list 获取 status_change
        if (bl && bl.sc) return bl.sc;
        if (bl && bl.type === 'pc') return global.CharController?.getChar()?.sc || {};
        return { getSCE: function() { return null; } };
    };

    global.getBlockById = function(id) {
        // 模拟 map_id2bl
        return global.BattleController?.getMonsters?.().find(m => m.id === id) ||
               global.CharController?.getChar?.() || null;
    };

    global.ersAlloc = function(pool, type) { return {}; };
    global.ersFree = function(pool, ptr) {};
    global.addTimer = function(tick, func, id, data) {
        let delay = Math.max(0, tick - Date.now());
        return setTimeout(() => func({ data: data, tick: Date.now() }), delay);
    };

    // ----- 兼容宏 -----
    global.CONFIG = global.CONFIG || global.rAthenaConfig || {};

    console.log('✅ rAthenaAdapter 已加载');
})(window);
