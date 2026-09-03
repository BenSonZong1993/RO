// js/config/LootGroups.js
// ============================================================
//  掉落分组定义 - 品质、稀有度
//  用途：定义掉落物品的品质分组，用于随机生成掉落
//  维护者：策划可根据游戏平衡调整
// ============================================================
(function(global) {
    'use strict';

    const LOOT_GROUPS = {
        // ----------------------------------------------------------
        //  品质分组（按稀有度）
        // ----------------------------------------------------------
        'common': {
            id: 'common',
            name: '普通',
            color: '#FFFFFF',
            weight: 100,    // 相对权重，用于随机抽取
            dropRateMultiplier: 1.0,
            amountMultiplier: 1.0,
        },
        'uncommon': {
            id: 'uncommon',
            name: '优秀',
            color: '#1EFF00',
            weight: 50,
            dropRateMultiplier: 0.8,
            amountMultiplier: 0.8,
        },
        'rare': {
            id: 'rare',
            name: '稀有',
            color: '#0070DD',
            weight: 20,
            dropRateMultiplier: 0.5,
            amountMultiplier: 0.5,
        },
        'epic': {
            id: 'epic',
            name: '史诗',
            color: '#A335EE',
            weight: 8,
            dropRateMultiplier: 0.3,
            amountMultiplier: 0.3,
        },
        'legendary': {
            id: 'legendary',
            name: '传说',
            color: '#FF8000',
            weight: 2,
            dropRateMultiplier: 0.1,
            amountMultiplier: 0.1,
        },
        // ----------------------------------------------------------
        //  类型分组（按物品类型）
        // ----------------------------------------------------------
        'weapon': {
            id: 'weapon',
            name: '武器',
            // 可包含子分组
        },
        'armor': {
            id: 'armor',
            name: '防具',
        },
        'consumable': {
            id: 'consumable',
            name: '消耗品',
        },
                'DelayConsume': {
            id: 'DelayConsume',
            name: '延迟消耗类',
        },
        'material': {
            id: 'material',
            name: '材料',
        },
        'card': {
            id: 'card',
            name: '卡片',
        },
    };

    global.LootGroups = LOOT_GROUPS;
    console.log(`[LootGroups] ✅ 已加载 ${Object.keys(LOOT_GROUPS).length} 个掉落分组`);
})(window);