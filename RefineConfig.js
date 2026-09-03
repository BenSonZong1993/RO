// ============================================================
//  FILE: RefineConfig.js
//  LAYER: config（装备精炼配置表——ROUND5 官方数值真实化）
//  数据来源：rAthena 官方 refine.yml（精炼-官方源码文件相关/refine.yml），
//            只取 Group(Armor/Weapon) × 物品等级 × 精炼等级 0~10 的 Normal（普通矿石）档。
//  消费方：RefineService（判定/扣费/加成）、EquipService.getEquipBonuses（接缝）、
//          UIInventory 详情弹窗（经 getRefineInfo）、smoke_refine.js
//  契约（ROUND5 重构后字段，接力 AI 请按此续写）：
//    maxLevel            精炼上限（官方 Normal 矿石档到 +10；+11 以上用 Carnium/Bradium，本轮不做）
//    safeLevel           全局兜底安全档：目标 ≤ 此等级强制成功（与各档官方 Rate=10000 段并存，取较大者）
//    table               官方数值主表：table[group][物品等级]
//      group             'weapon'（武器，WeaponLevel 1~4）/ 'armor'（防具类，ArmorLevel 1~2）
//      每档字段：
//        safeLevel       该档官方安全精炼上限（Rate=10000 的最高目标等级）
//        zeny            每次精炼 Zeny 费用（官方 Price，Normal 档各精炼等级相同）
//        ore             Normal 档矿石 { templateId, aegis }，每次 1 个
//        oreHd/oreEnriched  HD/Enriched 档矿石（本轮预留，Service 暂只消费 Normal）
//        zenyHd/zenyEnriched  HD/Enriched 档费用（本轮预留）
//        bonus           累计加成表（下标=精炼等级 1~10，值=该等级的"总加成"非增量）：
//                        武器 Bonus 单位=0.1 ATK（官方 200 → +2 ATK/MATK 每级）；
//                        防具 Bonus 单位=0.01 DEF（官方 100 → +1 DEF）。官方防具无 MDEF/MaxHP 精炼加成。
//                        官方 RandomBonus（+8 起随机浮动）本轮不做，记 PROGRESS 未开始栏。
//        successRate     下标=目标精炼等级（1~10），0~1 概率（官方 Rate 万分位 ÷10000）
//        failureRule     下标=失败时装备"当前"精炼等级（0~9）：
//                        downgradeAmount  降级数（官方 DowngradeAmount；0=不降级）
//                        breakChance      碎裂概率（官方 BreakingRate 万分位 ÷10000；官方 Normal 档
//                                         不降级即碎——高等级普通精炼失败装备直接碎裂）
//  物品等级取法：武器 equipDef.WeaponLevel、防具 equipDef.ArmorLevel（经 ItemData 实测字段名），
//                缺失时按 1 档处理。
//  设计原则：全部数值配置驱动，战斗核心零感知（精炼只是装备加成的又一来源）。
// ============================================================
(function(global) {
    'use strict';

    // ---- 官方矿石 templateId（经 ItemData 实测核对） ----
    var ORE = {
        phracon: 1010, emveretarcon: 1011, oridecon: 984, elunium: 985,
        ethernium: 1000331,
        hdOridecon: 6240, hdElunium: 6241,
        enrichedOridecon: 7620, enrichedElunium: 7619,
    };

    var RefineConfig = {
        // ---- 等级框架 ----
        maxLevel: 10,          // 精炼上限（官方 Normal 矿石档）
        safeLevel: 3,          // 全局兜底安全档（各档官方安全段见 table.*.safeLevel，Service 取较大者）

        // ---- 官方数值主表（Normal 档，refine.yml 逐字段导入） ----
        table: {
            // ================= 防具（Armor 组） =================
            armor: {
                // Armor 物品等级 1（Elunium，2000 Zeny/次）
                1: {
                    safeLevel: 4,
                    zeny: 2000,
                    ore: { templateId: ORE.elunium, aegis: 'Elunium' },
                    oreHd: { templateId: ORE.hdElunium, aegis: 'HD_Elunium' },
                    zenyHd: 20000,
                    oreEnriched: { templateId: ORE.enrichedElunium, aegis: 'Enriched_Elunium' },
                    zenyEnriched: 2000,
                    // Bonus 累计（100 单位=1 DEF）：100,200,300,400,600,800,1000,1200,1500,1800
                    bonus: { def: [0, 1, 2, 3, 4, 6, 8, 10, 12, 15, 18], mdef: null, maxHp: null },
                    // Rate: 10000×4, 6000, 4000×2, 2000×2, 900（万分位）
                    successRate: [0, 1, 1, 1, 1, 0.6, 0.4, 0.4, 0.2, 0.2, 0.09],
                    // Normal 档：目标 5~10 失败即碎（BreakingRate 10000），不降级
                    failureRule: [
                        /* 0 */ { downgradeAmount: 0, breakChance: 0 },
                        /* 1 */ { downgradeAmount: 0, breakChance: 0 },
                        /* 2 */ { downgradeAmount: 0, breakChance: 0 },
                        /* 3 */ { downgradeAmount: 0, breakChance: 0 },
                        /* 4 */ { downgradeAmount: 0, breakChance: 1 },
                        /* 5 */ { downgradeAmount: 0, breakChance: 1 },
                        /* 6 */ { downgradeAmount: 0, breakChance: 1 },
                        /* 7 */ { downgradeAmount: 0, breakChance: 1 },
                        /* 8 */ { downgradeAmount: 0, breakChance: 1 },
                        /* 9 */ { downgradeAmount: 0, breakChance: 1 },
                    ],
                },
                // Armor 物品等级 2（Ethernium，50000 Zeny/次）
                2: {
                    safeLevel: 3,
                    zeny: 50000,
                    ore: { templateId: ORE.ethernium, aegis: 'Ethernium' },
                    // 官方 Armor Lv2 无 HD 档；Enriched_Ethernium 本轮不做矿石 UI，仅留位
                    oreEnriched: { templateId: ORE.ethernium, aegis: 'Enriched_Ethernium(未实装)' },
                    zenyEnriched: 50000,
                    // Bonus 累计：120,240,360,480,720,960,1200,1440,1800,2160 → DEF 1.2/级
                    bonus: { def: [0, 1.2, 2.4, 3.6, 4.8, 7.2, 9.6, 12, 14.4, 18, 21.6], mdef: null, maxHp: null },
                    // Rate: 10000×3, 6000×2, 4000×2, 2000×2, 900
                    successRate: [0, 1, 1, 1, 0.6, 0.6, 0.4, 0.4, 0.2, 0.2, 0.09],
                    // Normal 档：目标 4~10 失败降 3 级（DowngradeAmount 3），不碎
                    failureRule: [
                        /* 0 */ { downgradeAmount: 0, breakChance: 0 },
                        /* 1 */ { downgradeAmount: 0, breakChance: 0 },
                        /* 2 */ { downgradeAmount: 0, breakChance: 0 },
                        /* 3 */ { downgradeAmount: 3, breakChance: 0 },
                        /* 4 */ { downgradeAmount: 3, breakChance: 0 },
                        /* 5 */ { downgradeAmount: 3, breakChance: 0 },
                        /* 6 */ { downgradeAmount: 3, breakChance: 0 },
                        /* 7 */ { downgradeAmount: 3, breakChance: 0 },
                        /* 8 */ { downgradeAmount: 3, breakChance: 0 },
                        /* 9 */ { downgradeAmount: 3, breakChance: 0 },
                    ],
                },
            },

            // ================= 武器（Weapon 组） =================
            weapon: {
                // Weapon 物品等级 1（Phracon，50 Zeny/次）
                1: {
                    safeLevel: 7,
                    zeny: 50,
                    ore: { templateId: ORE.phracon, aegis: 'Phracon' },
                    oreHd: { templateId: ORE.hdOridecon, aegis: 'HD_Oridecon' },
                    zenyHd: 20000,
                    oreEnriched: { templateId: ORE.enrichedOridecon, aegis: 'Enriched_Oridecon' },
                    zenyEnriched: 2000,
                    // Bonus 累计（单位=0.1 ATK）：200..2000 → 每级 +2 ATK/MATK
                    bonus: { atk: [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20], matk: [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20] },
                    // Rate: 10000×7, 6000, 4000, 1900
                    successRate: [0, 1, 1, 1, 1, 1, 1, 1, 0.6, 0.4, 0.19],
                    // Normal 档：目标 8~10 失败即碎
                    failureRule: [
                        /* 0 */ { downgradeAmount: 0, breakChance: 0 },
                        /* 1 */ { downgradeAmount: 0, breakChance: 0 },
                        /* 2 */ { downgradeAmount: 0, breakChance: 0 },
                        /* 3 */ { downgradeAmount: 0, breakChance: 0 },
                        /* 4 */ { downgradeAmount: 0, breakChance: 0 },
                        /* 5 */ { downgradeAmount: 0, breakChance: 0 },
                        /* 6 */ { downgradeAmount: 0, breakChance: 0 },
                        /* 7 */ { downgradeAmount: 0, breakChance: 1 },
                        /* 8 */ { downgradeAmount: 0, breakChance: 1 },
                        /* 9 */ { downgradeAmount: 0, breakChance: 1 },
                    ],
                },
                // Weapon 物品等级 2（Emveretarcon，200 Zeny/次）
                2: {
                    safeLevel: 6,
                    zeny: 200,
                    ore: { templateId: ORE.emveretarcon, aegis: 'Emveretarcon' },
                    oreHd: { templateId: ORE.hdOridecon, aegis: 'HD_Oridecon' },
                    zenyHd: 20000,
                    oreEnriched: { templateId: ORE.enrichedOridecon, aegis: 'Enriched_Oridecon' },
                    zenyEnriched: 2000,
                    // Bonus 累计：300..3000 → 每级 +3 ATK/MATK
                    bonus: { atk: [0, 3, 6, 9, 12, 15, 18, 21, 24, 27, 30], matk: [0, 3, 6, 9, 12, 15, 18, 21, 24, 27, 30] },
                    // Rate: 10000×6, 6000, 4000, 2000, 1900
                    successRate: [0, 1, 1, 1, 1, 1, 1, 0.6, 0.4, 0.2, 0.19],
                    // Normal 档：目标 7~10 失败即碎
                    failureRule: [
                        /* 0 */ { downgradeAmount: 0, breakChance: 0 },
                        /* 1 */ { downgradeAmount: 0, breakChance: 0 },
                        /* 2 */ { downgradeAmount: 0, breakChance: 0 },
                        /* 3 */ { downgradeAmount: 0, breakChance: 0 },
                        /* 4 */ { downgradeAmount: 0, breakChance: 0 },
                        /* 5 */ { downgradeAmount: 0, breakChance: 0 },
                        /* 6 */ { downgradeAmount: 0, breakChance: 1 },
                        /* 7 */ { downgradeAmount: 0, breakChance: 1 },
                        /* 8 */ { downgradeAmount: 0, breakChance: 1 },
                        /* 9 */ { downgradeAmount: 0, breakChance: 1 },
                    ],
                },
                // Weapon 物品等级 3（Oridecon，5000 Zeny/次）
                3: {
                    safeLevel: 5,
                    zeny: 5000,
                    ore: { templateId: ORE.oridecon, aegis: 'Oridecon' },
                    oreHd: { templateId: ORE.hdOridecon, aegis: 'HD_Oridecon' },
                    zenyHd: 20000,
                    oreEnriched: { templateId: ORE.enrichedOridecon, aegis: 'Enriched_Oridecon' },
                    zenyEnriched: 2000,
                    // Bonus 累计：500..5000 → 每级 +5 ATK/MATK
                    bonus: { atk: [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50], matk: [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50] },
                    // Rate: 10000×5, 6000, 5000, 2000×2, 1900
                    successRate: [0, 1, 1, 1, 1, 1, 0.6, 0.5, 0.2, 0.2, 0.19],
                    // Normal 档：目标 6~10 失败即碎
                    failureRule: [
                        /* 0 */ { downgradeAmount: 0, breakChance: 0 },
                        /* 1 */ { downgradeAmount: 0, breakChance: 0 },
                        /* 2 */ { downgradeAmount: 0, breakChance: 0 },
                        /* 3 */ { downgradeAmount: 0, breakChance: 0 },
                        /* 4 */ { downgradeAmount: 0, breakChance: 0 },
                        /* 5 */ { downgradeAmount: 0, breakChance: 1 },
                        /* 6 */ { downgradeAmount: 0, breakChance: 1 },
                        /* 7 */ { downgradeAmount: 0, breakChance: 1 },
                        /* 8 */ { downgradeAmount: 0, breakChance: 1 },
                        /* 9 */ { downgradeAmount: 0, breakChance: 1 },
                    ],
                },
                // Weapon 物品等级 4（Oridecon，20000 Zeny/次）
                4: {
                    safeLevel: 4,
                    zeny: 20000,
                    ore: { templateId: ORE.oridecon, aegis: 'Oridecon' },
                    oreHd: { templateId: ORE.hdOridecon, aegis: 'HD_Oridecon' },
                    zenyHd: 20000,
                    oreEnriched: { templateId: ORE.enrichedOridecon, aegis: 'Enriched_Oridecon' },
                    zenyEnriched: 2000,
                    // Bonus 累计：700..7000 → 每级 +7 ATK/MATK
                    bonus: { atk: [0, 7, 14, 21, 28, 35, 42, 49, 56, 63, 70], matk: [0, 7, 14, 21, 28, 35, 42, 49, 56, 63, 70] },
                    // Rate: 10000×4, 6000, 4000×2, 2000×2, 900
                    successRate: [0, 1, 1, 1, 1, 0.6, 0.4, 0.4, 0.2, 0.2, 0.09],
                    // Normal 档：目标 5~10 失败即碎
                    failureRule: [
                        /* 0 */ { downgradeAmount: 0, breakChance: 0 },
                        /* 1 */ { downgradeAmount: 0, breakChance: 0 },
                        /* 2 */ { downgradeAmount: 0, breakChance: 0 },
                        /* 3 */ { downgradeAmount: 0, breakChance: 0 },
                        /* 4 */ { downgradeAmount: 0, breakChance: 1 },
                        /* 5 */ { downgradeAmount: 0, breakChance: 1 },
                        /* 6 */ { downgradeAmount: 0, breakChance: 1 },
                        /* 7 */ { downgradeAmount: 0, breakChance: 1 },
                        /* 8 */ { downgradeAmount: 0, breakChance: 1 },
                        /* 9 */ { downgradeAmount: 0, breakChance: 1 },
                    ],
                },
            },
        },

        // ---- HD/Enriched 档通用矿石（官方 Armor Lv1 / Weapon 全档共用；Service 暂只消费 Normal） ----
        // 预留：将来在 RefineService 增加 costType 参数即可切换（'normal' | 'hd' | 'enriched'）
    };

    // ---- 物品等级解析：武器 WeaponLevel / 防具 ArmorLevel，缺失按 1 档 ----
    RefineConfig.getItemLevel = function(equipDef) {
        if (!equipDef) return 1;
        if (equipDef.Type === 'Weapon') return equipDef.WeaponLevel || 1;
        return equipDef.ArmorLevel || 1;
    };

    // ---- 取官方数值档（越界回退 1 档） ----
    RefineConfig.getEntry = function(equipDef) {
        var group = (equipDef && equipDef.Type === 'Weapon') ? 'weapon' : 'armor';
        var lv = this.getItemLevel(equipDef);
        var g = this.table[group];
        return g[lv] || g[1];
    };

    global.RefineConfig = RefineConfig;
    console.log('[RefineConfig] ✅ 已加载（精炼配置表：官方 refine.yml Normal 档 / max ' + RefineConfig.maxLevel + ' / 兜底 safe ' + RefineConfig.safeLevel + '）');
})(window);
