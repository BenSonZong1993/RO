// ============================================================
//  FILE: EnchantConfig.js
//  LAYER: config（装备附魔配置表——ROUND6 官方数值真实化）
//  数据来源：rAthena 官方《附魔-官方源码文件相关/》：
//    · enchantgrade.yml      品阶（Enchant Grade）体系：Grade None/D/C/B 的
//                            Bonus 数值与按精炼等级的升阶概率 Chances
//    · npc-enchantgrade.yml  Etel 宝石兑换价（EnchantGradeExchange barter 表）
//    · item_enchant.yml      本文件夹内仅表头；《完整-item_enchant.yml》（1130KB，138 组词条槽）
//                            经抽样/正则提取规律：词条池内属性珠均匀（各 9900），阶位概率
//                            Tier1/2/3/特殊 = 9900/2500/400/234；逐槽 Price 10万~1亿 Zeny+材料。
//                            官方宝珠实测数值（ItemData 探针）：属性珠 Tier1/2/3 基础 +1/+2/+3，
//                            精炼 ≥7 / ≥9 各再 +1（固定值+精炼联动，与本系统 perLevel×level 模型
//                            不同构，未导入——完整映射留后续轮，见 ROUND6 PROGRESS 未开始栏）
//  保留设计：《精炼与附魔的设计资料参考.txt》（RO：复兴）框架内核——
//          城市词条池 + 洗练等级 +1 永不降级 + Zeny 洗练（官方无逐级费用表，沿用既有定价）
//  官方映射（ROUND6 定稿）：
//    · 品阶语义：白/蓝/紫/橙 ↔ 官方 Grade None/D/C/B
//    · 品阶数值：qualityMult = 1 + 官方 Bonus/100（官方 Bonus 10/30/50/100）
//                → 白 1.0 / 蓝 1.1 / 紫 1.3 / 橙 1.5
//    · 升阶概率：洗练时品阶只升不降；升阶概率取官方 Chances 按装备"精炼等级"取档
//                （官方 Armor 物品等级2 / Weapon 物品等级5 两表数值一致，统一采用；
//                  精炼 <9 取官方 Refine 9 行兜底，>20 钳到 20）
//    · 升阶费用：升阶成功时一次性收取官方 Etel 宝石兑换价
//                （白→蓝 = Etel_Skyblue_Jewel 100,000；蓝→紫 = Etel_Topaz 200,000；
//                  紫→橙 = Etel_Violet_Jewel 300,000；官方为每次尝试收费，本系统简化为
//                  达成收取，避免连续失败的挫败感——差额部分视为运气成本）
//  消费方：EnchantService（洗练/判定）、EquipService.getEquipBonuses（加成接缝）、
//          UIInventory 详情弹窗、init.js 确认弹窗、smoke_enchant.js
//  契约（接力 AI 请按此字段名续写，勿改键名）：
//    maxLevel          附魔等级上限（Lv.1~20，洗练成功 +1，永不降级）
//    maxSlot           每件装备词条槽数（1，多槽为后续扩展）
//    cityPools         城市词条池：key = 城市标识，value = 词条 id 数组
//                      · prontera 普隆德拉 → 基础属性（str/agi/vit/int/dex/luk）
//                      · morroc   梦罗克   → 进阶攻击（atk/matk）
//                      · payon    斐扬     → 种族增伤（raceAddDamage）
//                      官方 item_enchant.yml 无 Body 数据，词条池保留 RO:复兴设计
//    affixes           词条定义表：id → 定义（.name/.type('attr'|'raceAdd')/.attr/.race/.perLevel）
//    grades            品阶官方语义表（升阶顺序即数组顺序）：
//      .label          本系统品阶名（白/蓝/紫/橙）
//      .official       官方 Grade 名（None/D/C/B）
//      .bonus          官方 Bonus 数值（10/30/50/100）
//      .fee            升入该阶的官方 Etel 宝石兑换价（白阶无，=0）
//      .chances        升入该阶的官方概率表 [[最低精炼, 概率0~1], ...]（取 ≤精炼 的最后一档）
//    qualityMult       品阶数值倍率（由 grades[].bonus 导出，勿手改——与官方 Bonus 保持同步）
//    zenyCost(level)   洗练到 level+1 级的 Zeny（官方无逐级附魔费表，沿用 1000+level×500）
//  装备实例数据结构（随背包 v3 存档，无新增持久化键）：
//    entry.enchant = { city:'prontera', level:3, affixId:'str', quality:'紫' }
//    未附魔装备无该字段（视为 level 0 / 品阶白）
//  组织约定：与 RefineConfig/RefineService 同构——配置驱动、纯函数接缝、战斗核心零感知。
// ============================================================
(function(global) {
    'use strict';

    var EnchantConfig = {
        // ---- 等级框架 ----
        maxLevel: 20,          // 附魔等级上限（洗练成功 +1，永不降级）
        maxSlot: 1,            // 每件装备词条槽数（多槽为后续扩展）

        // ---- 城市词条池（key 供 EnchantService.enchant(target, city) 使用） ----
        cityPools: {
            prontera: ['str', 'agi', 'vit', 'int', 'dex', 'luk'],   // 普隆德拉：基础属性
            morroc:   ['atk', 'matk'],                               // 梦罗克：物理/魔法攻击
            payon:    ['raceBrute', 'raceDragon'],                   // 斐扬：种族增伤
        },

        // ---- 词条定义表 ----
        affixes: {
            // 普隆德拉：基础属性（每级 +1 点）
            str:  { name: '力量', type: 'attr', attr: 'str', perLevel: 1 },
            agi:  { name: '敏捷', type: 'attr', attr: 'agi', perLevel: 1 },
            vit:  { name: '体质', type: 'attr', attr: 'vit', perLevel: 1 },
            int:  { name: '智力', type: 'attr', attr: 'int', perLevel: 1 },
            dex:  { name: '灵巧', type: 'attr', attr: 'dex', perLevel: 1 },
            luk:  { name: '幸运', type: 'attr', attr: 'luk', perLevel: 1 },
            // 梦罗克：进阶攻击（每级 +2 点）
            atk:  { name: '物理攻击', type: 'attr', attr: 'atk', perLevel: 2 },
            matk: { name: '魔法攻击', type: 'attr', attr: 'matk', perLevel: 2 },
            // 斐扬：种族增伤（每级 +1 百分点 → modifiers.raceAddDamage[race] += n）
            raceBrute:  { name: '动物系增伤', type: 'raceAdd', race: 'Brute',  perLevel: 1 },
            raceDragon: { name: '龙族增伤',   type: 'raceAdd', race: 'Dragon', perLevel: 1 },
        },

        // ---- 品阶官方语义表（升阶顺序 = 数组顺序；数值/概率/费用均出自官方 yml） ----
        grades: [
            { label: '白', official: 'None', bonus: 0,   fee: 0,
              chances: [] },  // 初始品阶，无升入概率
            { label: '蓝', official: 'D',    bonus: 10,  fee: 100000,
              // 官方 Refine 9:1000 / 10:2000 / 11~15:6000 / 16~20:7000（万分位）
              chances: [[9, 0.10], [10, 0.20], [11, 0.60], [16, 0.70]] },
            { label: '紫', official: 'C',    bonus: 50,  fee: 200000,
              // 官方 Refine 11~15:5000 / 16~20:6000（万分位；官方无 11 以下行，取首行兜底）
              chances: [[11, 0.50], [16, 0.60]] },
            { label: '橙', official: 'B',    bonus: 100, fee: 300000,
              // 官方 Refine 11~15:4000 / 16~20:5000（万分位）
              chances: [[11, 0.40], [16, 0.50]] },
        ],

        // ---- 品阶数值倍率：1 + 官方 Bonus/100（由 grades[].bonus 导出） ----
        qualityMult: { '白': 1.0, '蓝': 1.1, '紫': 1.3, '橙': 1.5 },

        // ---- 品阶随机权重（ROUND6 起弃用：品阶改为官方概率升阶制，仅留档兼容旧存档展示） ----
        qualityWeights: { '白': 50, '蓝': 30, '紫': 15, '橙': 5 },

        // ---- 洗练费用：到 level+1 级所需 Zeny（官方无逐级附魔费表，沿用粗链条定价） ----
        zenyCost: function(level) { return 1000 + level * 500; },
    };

    // ---- 取品阶定义（按 label；未知品阶回退白） ----
    EnchantConfig.getGrade = function(label) {
        for (var i = 0; i < this.grades.length; i++) {
            if (this.grades[i].label === label) return this.grades[i];
        }
        return this.grades[0];
    };

    // ---- 官方升阶概率：按装备精炼等级取档（<9 兜底 9 档，>20 钳 20） ----
    EnchantConfig.getUpgradeChance = function(label, refineLevel) {
        var g = this.getGrade(label);
        if (!g.chances.length) return 0;
        var r = Math.max(9, Math.min(20, refineLevel || 0));
        var chance = g.chances[0][1];
        for (var i = 0; i < g.chances.length; i++) {
            if (r >= g.chances[i][0]) chance = g.chances[i][1];
        }
        return chance;
    };

    global.EnchantConfig = EnchantConfig;
    console.log('[EnchantConfig] ✅ 已加载（附魔配置表：max Lv.' + EnchantConfig.maxLevel +
        ' / ' + Object.keys(EnchantConfig.cityPools).length + ' 城词条池 / ' +
        EnchantConfig.grades.length + ' 阶官方品阶（None/D/C/B））');
})(window);
