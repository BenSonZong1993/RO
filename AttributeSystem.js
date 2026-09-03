// js/core/AttributeSystem.js
(function(global) {
    'use strict';

    var ArithmeticCore = global.ArithmeticCore;
    if (!ArithmeticCore) {
        console.error('[AttributeSystem] 依赖缺失：ArithmeticCore 未加载');
        return;
    }

    var AttributeSystem = {

         assemble: function(resolved, char) {
            if (!resolved || !resolved.modifications) {
                return this._buildEmptyStats(char);
            }

            var mods = resolved.modifications;
            var stats = char && char.stats ? char.stats : {};
            var level = char && char.level ? char.level : 1;
            var jobKey = char && char.jobKey ? char.jobKey : 'Novice';

            // ---- 基础值 ----
            var baseATK = (mods.atk || 0) + (mods.equipATK || 0);
            var baseDEF = mods.def || 0;
            var baseMDEF = mods.mdef || 0;
            var baseHIT = mods.hit || 0;
            var baseFLEE = mods.flee || 0;
            var baseCRI = mods.cri || 0;
            var basePerfectDodge = mods.perfectDodge || 0;
            var baseMaxHP = mods.maxHp || 100;
            var baseMaxSP = mods.maxSp || 50;

            // ---- 属性修正 ----
            var statMods = {};
            var statKeys = ['str', 'agi', 'vit', 'int', 'dex', 'luk'];
            for (var i = 0; i < statKeys.length; i++) {
                var key = statKeys[i];
                statMods[key] = (mods['stat_' + key] || 0);
            }

            // ---- 百分比修正 ----
            var atkPercent = mods.atkPercent || 0;
            var defPercent = mods.defPercent || 0;
            var mdefPercent = mods.mdefPercent || 0;
            var maxHpPercent = mods.maxHpRate || 0;
            var maxSpPercent = mods.maxSpRate || 0;

            var finalATK = ArithmeticCore.floor(
                ArithmeticCore.applyPercent(baseATK, atkPercent)
            );
            var finalDEF = ArithmeticCore.floor(
                ArithmeticCore.applyPercent(baseDEF, defPercent)
            );
            var finalMDEF = ArithmeticCore.floor(
                ArithmeticCore.applyPercent(baseMDEF, mdefPercent)
            );
            var finalMaxHP = ArithmeticCore.floor(
                ArithmeticCore.applyPercent(baseMaxHP, maxHpPercent)
            );
            var finalMaxSP = ArithmeticCore.floor(
                ArithmeticCore.applyPercent(baseMaxSP, maxSpPercent)
            );

            // ---- 攻速 ----
            var baseASPD = mods.baseASPD || 2000;
            var aspdPercent = mods.aspdPercent || 0;
            var finalASPD = Math.max(50, Math.floor(baseASPD / (1 + aspdPercent / 100)));
            var aspeed = 200 - finalASPD / 50;
            aspeed = Math.max(0, Math.min(193, aspeed));
            aspeed = Math.round(aspeed * 10) / 10;

            // ---- 可变咏唱缩减（归一化为 0~1 小数） ----
var variableCastReduction = (mods.castReductionPercent || 0) / 100;
if (variableCastReduction > 1.0) variableCastReduction = 1.0;
if (variableCastReduction < 0) variableCastReduction = 0;
variableCastReduction = Math.round(variableCastReduction * 1000) / 1000;

            // ============================================================
            // ★★★ 攻击距离统一转换：所有输入均为“格数”，此处统一转为像素 ★★★
            // ============================================================
            var rawRange = mods.attackRange;
            if (rawRange == null) rawRange = 1;
            var finalAttackRange = Math.max(1, rawRange * RO_CONSTANTS.PIXELS_PER_CELL);

            // ---- 其他属性 ----
            var attackElement = mods.attackElement || 'Neutral';
            var attackElementLevel = mods.attackElementLevel || 1;
            var defenseElement = mods.defenseElement || 'Neutral';
            var defenseElementLevel = mods.defenseElementLevel || 1;
            var weaponType = mods.weaponType || 'None';
            var fixedCastReduction = mods.fixedCastReduction || 0;
            var modifiers = mods.modifiers || {};

            // ---- ★新增：暴击伤害加成 ----
            var criDamage = mods.criDamage || 0;

var finalStats = {
    finalATK: Math.max(0, finalATK),
    finalMATK: Math.max(0, mods.matk || 0),
    finalDEF: Math.max(0, finalDEF),
    finalMDEF: Math.max(0, finalMDEF),
    finalMaxHP: Math.max(1, finalMaxHP),
    finalMaxSP: Math.max(1, finalMaxSP),
    finalASPD: finalASPD,
    aspeed: aspeed,
    attackInterval: (function() {
        var aspdVal = aspeed;
        if (aspdVal <= 150) return 2.0;
        if (aspdVal >= 193) return 0.14;
        var ratio = (aspdVal - 150) / (193 - 150);
        return Math.round((2.0 - ratio * (2.0 - 0.14)) * 1000) / 1000;
    })(),
    variableCastReduction: variableCastReduction,
    panelHIT: Math.max(0, baseHIT),
    panelFLEE: Math.max(0, baseFLEE),
    cri: Math.max(0, baseCRI),
    criDamage: Math.max(0, criDamage),           // ★新增
    perfectDodge: Math.max(0, basePerfectDodge),
    baseATK: baseATK,
    baseDEF: baseDEF,
    baseMaxHP: baseMaxHP,
    baseMaxSP: baseMaxSP,
    attackElement: attackElement,
    attackElementLevel: attackElementLevel,
    defenseElement: defenseElement,
    defenseElementLevel: defenseElementLevel,
    attackRange: finalAttackRange,
    weaponType: weaponType,
    fixedCastReduction: fixedCastReduction,
    modifiers: modifiers,
    statMods: statMods,
     weightLimit: mods.weightLimit || 100,
    _sources: resolved.metadata || {},
};

for (var key in statMods) {
    if (statMods.hasOwnProperty(key)) {
        finalStats[key] = statMods[key];
    }
}

var ELE_LIST = global.ELEMENT_LIST || ['Neutral','Water','Earth','Fire','Wind','Poison','Holy','Dark','Ghost','Undead'];
if (ELE_LIST.indexOf(finalStats.attackElement) === -1) finalStats.attackElement = 'Neutral';
if (ELE_LIST.indexOf(finalStats.defenseElement) === -1) finalStats.defenseElement = 'Neutral';

return finalStats;
        },

        _buildEmptyStats: function(char) {
            var stats = char && char.stats ? char.stats : {};
            var level = char && char.level ? char.level : 1;
            return {
                finalATK: 0,
                finalMATK: 0,
                finalDEF: 0,
                finalMDEF: 0,
                finalMaxHP: 100,
                finalMaxSP: 50,
                finalASPD: 2000,
                aspeed: 190,
                variableCastReduction: 0,
                panelHIT: level,
                panelFLEE: level,
                cri: 10,
                criDamage: 0,
                perfectDodge: 10,
                attackElement: 'Neutral',
                attackElementLevel: 1,
                defenseElement: 'Neutral',
                defenseElementLevel: 1,
                attackRange: 1,
                weaponType: 'None',
                fixedCastReduction: 0,
                modifiers: {},
                statMods: {},
                _sources: { error: 'empty_assembly' },
            };
        }
    };

    global.AttributeSystem = AttributeSystem;
    console.log('[AttributeSystem] ✅ 已加载（攻击距离统一转换：格数→像素）');
})(window);