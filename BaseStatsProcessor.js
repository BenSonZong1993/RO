// js/processors/BaseStatsProcessor.js
(function(global) {
    'use strict';

    var ArithmeticCore = global.ArithmeticCore;
    if (!ArithmeticCore) {
        console.error('[BaseStatsProcessor] 依赖缺失：ArithmeticCore 未加载');
        return;
    }

    // 远程武器类型列表（用于判断主属性）
    var RANGED_WEAPON_TYPES = [
        'Bow', 'Musical', 'Whip', 'Revolver', 'Rifle',
        'Gatling', 'Shotgun', 'Grenade', 'Instrument'
    ];

    function isRangedWeapon(subType) {
        if (!subType) return false;
        return RANGED_WEAPON_TYPES.indexOf(subType) !== -1;
    }

    // ---- 辅助：按等级查找基础值 ----
    function findBaseValueByLevel(arr, level) {
        if (!Array.isArray(arr) || arr.length === 0) return 0;
        for (var i = arr.length - 1; i >= 0; i--) {
            var entry = arr[i];
            if (entry.Level !== undefined && entry.Level <= level) {
                return entry.Hp || entry.Sp || entry.Ap || entry;
            }
        }
        var first = arr[0];
        return first.Hp || first.Sp || first.Ap || first || 0;
    }

    var BaseStatsProcessor = {

        process: function(char) {
            if (!char || !char.stats) {
                return this._emptyResult();
            }

            var stats = char.stats;
            var level = char.level || 1;
            var jobKey = char.jobKey || 'Novice';

            var str = stats.str || 1;
            var agi = stats.agi || 1;
            var vit = stats.vit || 1;
            var int_ = stats.int || 1;
            var dex = stats.dex || 1;
            var luk = stats.luk || 1;

            // ---- 获取当前武器类型 ----
            var weaponType = 'None';
            if (global.InventoryRepository && global.ItemDataGateway) {
                var equipped = global.InventoryRepository.getEquipped();
                if (equipped && equipped.weapon) {
                    var def = global.ItemDataGateway.getById(equipped.weapon.templateId);
                    if (def && def.SubType) {
                        weaponType = def.SubType;
                    }
                }
            }

            // ---- 基础攻击力 ----
            var baseATK;
            if (isRangedWeapon(weaponType)) {
                baseATK = dex
                    + Math.pow(ArithmeticCore.floor(dex / 10), 2)
                    + ArithmeticCore.floor(str / 5)
                    + ArithmeticCore.floor(luk / 5)
                    + ArithmeticCore.floor(level / 4);
            } else {
                baseATK = str
                    + Math.pow(ArithmeticCore.floor(str / 10), 2)
                    + ArithmeticCore.floor(dex / 5)
                    + ArithmeticCore.floor(luk / 5)
                    + ArithmeticCore.floor(level / 4);
            }

            var baseDEF = ArithmeticCore.floor(vit / 2);
            var baseMDEF = ArithmeticCore.floor(int_ / 2);
            var baseHIT = 175 + level + dex + ArithmeticCore.floor(luk / 3);
            var baseFLEE = 100 + level + agi + ArithmeticCore.floor(luk / 5);
            var baseCRI = 10 + ArithmeticCore.round(luk * 0.3, 1);
            var basePerfectDodge = 10 + ArithmeticCore.floor(luk / 10);
            var baseMATK = int_ + Math.floor(int_ / 2) + Math.floor(dex / 5) + Math.floor(luk / 3) + Math.floor(level / 4);

            // ============================================================
            //  职业驱动的 MaxHP / MaxSP
            // ============================================================
            var baseMaxHP = 100;
            var baseMaxSP = 20;

            // ============================================================
            //  ★★★ 新增：负重（MaxWeight）★★★
            // ============================================================
            var maxWeight = 2000; // 默认值（类似初心者）

            if (global.JobGateway) {
                // 1. 获取基础血蓝表
                var bp = global.JobGateway.getBasePoints(jobKey) || {};
                var baseHpArr = bp.BaseHp || [];
                var baseSpArr = bp.BaseSp || [];

                var baseHpVal = findBaseValueByLevel(baseHpArr, level);
                var baseSpVal = findBaseValueByLevel(baseSpArr, level);

                // 2. 获取成长因子（含负重）
                var factors = global.JobGateway.getStatFactors(jobKey) || {};
                var hpFactor = factors.HpFactor || 0;
                var spFactor = factors.SpFactor || 0;
                maxWeight = factors.MaxWeight || 2000; // 从配表读取负重

                // 3. 应用公式
                if (baseHpVal > 0) {
                    baseMaxHP = baseHpVal + hpFactor * vit;
                } else {
                    baseMaxHP = 100 + vit * 5 + level * 10;
                }

                if (baseSpVal > 0) {
                    baseMaxSP = baseSpVal + spFactor * int_;
                } else {
                    baseMaxSP = 20 + int_ * 2 + level * 2;
                }

                baseMaxHP = Math.max(1, baseMaxHP);
                baseMaxSP = Math.max(1, baseMaxSP);
            } else {
                baseMaxHP = 100 + vit * 5 + level * 10;
                baseMaxSP = 20 + int_ * 2 + level * 2;
                maxWeight = 2000;
            }

            // ---- 返回结果 ----
            return {
                type: 'base',
                priority: 100,
                source: 'char.stats+jobdata',
                modifications: {
                    atk: Math.max(0, baseATK),
                    matk: Math.max(0, baseMATK),
                    def: Math.max(0, baseDEF),
                    mdef: Math.max(0, baseMDEF),
                    hit: Math.max(0, baseHIT),
                    flee: Math.max(0, baseFLEE),
                    cri: Math.max(0, baseCRI),
                    perfectDodge: Math.max(0, basePerfectDodge),
                    criDamage: 40,  
                    maxHp: Math.max(1, baseMaxHP),
                    maxSp: Math.max(1, baseMaxSP),
                    weightLimit: Math.max(0, maxWeight),    // ★ 新增负重
                    // 基础属性透传
                    stat_str: str,
                    stat_agi: agi,
                    stat_vit: vit,
                    stat_int: int_,
                    stat_dex: dex,
                    stat_luk: luk,
                },
                metadata: {
                    str: str, agi: agi, vit: vit, int: int_, dex: dex, luk: luk,
                    level: level,
                    weaponType: weaponType,
                    isRanged: isRangedWeapon(weaponType),
                    baseHpVal: baseHpVal,
                    baseSpVal: baseSpVal,
                    hpFactor: hpFactor,
                    spFactor: spFactor,
                    maxWeight: maxWeight, // 调试用
                }
            };
        },

        _emptyResult: function() {
            return {
                type: 'base',
                priority: 100,
                source: 'empty',
                modifications: {},
                metadata: { error: 'no_char_data' }
            };
        }
    };

    global.BaseStatsProcessor = BaseStatsProcessor;
    console.log('[BaseStatsProcessor] ✅ 已加载（职业 HP/SP/负重 驱动）');
})(window);