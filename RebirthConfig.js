// js/config/RebirthConfig.js
(function(global) {
    'use strict';

    const REBIRTH_CONFIG = {
        // ============================================================
        //  阶段0：初始阶段（0次转生）
        //  条件：Base 99 / Job 50 → 可转生到阶段1
        //  转生后：职业 → 超级初心者，奖励 +52 属性点
        //  最高可达职业：Wizard（巫师）
        // ============================================================
        0: {
            label: '初心者',
            condition: {
                baseLevel: 99,
                jobLevel: 50,
                zeny: 100000000,   // 1 亿：策划暂不开放转生，用天价费用作为事实关闭（日后开放时调低即可）
                items: [],
            },
            startJobAfter: 'Super_Novice',
            bonusStatPoints: 52,
            maxJobReachable: 'Wizard',   // ← 新增：该阶段最高可达职业
        },

        // ============================================================
        //  阶段1：1次转生后（超级初心者）
        //  条件：Base 120 / Job 60 + 50万 Zeny → 可转生到阶段2
        //  转生后：职业 → 超级初心者·突破，奖励 +52 属性点
        //  最高可达职业：High_Wizard（超魔导士）
        // ============================================================
        1: {
            label: '超级初心者',
            condition: {
                baseLevel: 120,
                jobLevel: 60,
                zeny: 100000000,   // 1 亿（暂不开放）
                items: [],
            },
            startJobAfter: 'Super_Novice_E',
            bonusStatPoints: 52,
            maxJobReachable: 'High_Wizard',
        },

        // ============================================================
        //  阶段2：2次转生后（超级初心者·突破）
        //  条件：Base 150 / Job 70 + 100万 Zeny → 可转生到阶段3
        //  转生后：职业 → 终极初心者（复用 Novice_High），奖励 +52 属性点
        //  最高可达职业：Warlock（咒术士）
        // ============================================================
        2: {
            label: '超级初心者·突破',
            condition: {
                baseLevel: 150,
                jobLevel: 70,
                zeny: 100000000,   // 1 亿（暂不开放）
                items: [],
            },
            startJobAfter: 'Novice_High',
            bonusStatPoints: 52,
            maxJobReachable: 'Warlock',
        },

        // ============================================================
        //  阶段3：3次转生后（终极初心者）
        //  条件：Base 200 / Job 70 + 200万 Zeny → 可转生到阶段4
        //  转生后：职业 → 终极初心者·觉醒（复用 Novice_High，显示名加 E）
        //  最高可达职业：Arch_Mage（禁咒魔导士 / 大法师）
        // ============================================================
        3: {
            label: '终极初心者',
            condition: {
                baseLevel: 200,
                jobLevel: 70,
                zeny: 100000000,   // 1 亿（暂不开放）
                items: [],
            },
            startJobAfter: 'Novice_High',
            bonusStatPoints: 52,
            maxJobReachable: 'Arch_Mage',
        },

        // ============================================================
        //  阶段4：4次转生后（终极初心者·觉醒 / 梦幻法师）
        //  此阶段为最终阶段，无转生条件（不可再转生）
        //  最高可达职业：Elemental_Master（元素支配者 / 元素领主）
        // ============================================================
        4: {
            label: '终极初心者·觉醒',
            condition: null,
            startJobAfter: null,
            bonusStatPoints: 0,
            maxJobReachable: 'Elemental_Master',
        },
    };

    // ---------- 辅助函数 ----------
    function getRebirthStage(rebirthCount) {
        return REBIRTH_CONFIG[rebirthCount] || null;
    }

    function getMaxRebirthStage() {
        var keys = Object.keys(REBIRTH_CONFIG).map(Number);
        return Math.max.apply(null, keys);
    }

    function canRebirth(char) {
        if (!char) return false;
        var stage = getRebirthStage(char.rebirthCount);
        if (!stage || !stage.condition) return false;

        var cond = stage.condition;
        if (char.level < cond.baseLevel) return false;
        if (char.jobLevel < cond.jobLevel) return false;
        if ((char.zeny || 0) < cond.zeny) return false;
        // 道具检查由调用方处理
        return true;
    }

    // ---------- 暴露 ----------
    global.RebirthConfig = {
        REBIRTH_CONFIG: REBIRTH_CONFIG,
        getRebirthStage: getRebirthStage,
        getMaxRebirthStage: getMaxRebirthStage,
        canRebirth: canRebirth,
    };

    console.log('[RebirthConfig] ✅ 已加载（含 maxJobReachable 映射）');
})(window);