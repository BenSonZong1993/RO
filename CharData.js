// js/3-data/CharData.js
// ============================================================
//  角色默认数据结构（从 CharController 抽离）
//  用途：定义角色初始状态，供 DataCoordinator 初始化使用
// ============================================================
(function(global) {
    'use strict';

    // 六维属性键名（用于遍历和校验）
    var STAT_KEYS = ['str', 'agi', 'vit', 'int', 'dex', 'luk'];

    // 默认角色数据（与 localStorage 空数据时的初始结构一致）
    var DEFAULT_CHAR = {
        name: '冒险者',
        level: 1,
        jobLevel: 1,
        jobKey: 'Novice',
        exp: 0,
        jobExp: 0,
        statPoints: 48,
        skillPoints: 0,
        stats: {
            str: 1,
            agi: 1,
            vit: 1,
            int: 1,
            dex: 1,
            luk: 1
        },
        hp: 40,
        sp: 11,
        maxHp: 40,
        maxSp: 11,
        zeny: 0,
        baseAttackRange: 1,   // 基础攻击距离（像素）
        learnedSkills: {},     // { skillAegis: level }
        _finalStats: null,
        rebirthCount: 0,          // ← 新增：转生次数
    };

    // 暴露到全局
    global.CharData = {
        DEFAULT_CHAR: DEFAULT_CHAR,
        STAT_KEYS: STAT_KEYS
    };

    console.log('[CharData] ✅ 已加载（独立数据文件）');
})(window);