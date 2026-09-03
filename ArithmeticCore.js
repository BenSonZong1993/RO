// ============================================================
//  FILE: ArithmeticCore.js
//  LAYER: core（纯算术函数库，无状态、无上下文、无业务逻辑）
//  权限：无（纯函数）
//  依赖：无
//  被调用方：AttributeMediator、AttributeSystem、CharService、UIAttributes、战斗计算
//  原则：所有函数均为纯函数，输入数字输出数字
//  v4.0：原 LevelData.js 的属性点公式并入（LevelData 已删除，规则见蓝图 3.3）
// ============================================================
(function(global) {
    'use strict';

    const ArithmeticCore = {

        // ---- 基础四则运算 ----
        add: function(a, b) { return a + b; },
        sub: function(a, b) { return a - b; },
        mul: function(a, b) { return a * b; },
        div: function(a, b) { return b === 0 ? 0 : a / b; },

        // ---- 取整 ----
        floor: function(v) { return Math.floor(v); },
        ceil: function(v) { return Math.ceil(v); },
        round: function(v, decimals) {
            decimals = decimals || 0;
            var factor = Math.pow(10, decimals);
            return Math.round(v * factor) / factor;
        },

        // ---- 钳制 ----
        clamp: function(v, min, max) {
            if (v < min) return min;
            if (v > max) return max;
            return v;
        },

        // ---- 百分比应用（核心） ----
        applyPercent: function(base, percent) {
            return base * (1 + percent / 100);
        },

        applyPercentWithCap: function(base, percent, min, max) {
            var result = this.applyPercent(base, percent);
            return this.clamp(result, min, max);
        },

        // ---- 伤害减免公式（RO标准：DEF / (DEF + 100)） ----
        applyDefenseReduction: function(damage, def) {
            if (def < 0) def = 0;
            var reduction = def / (def + 100);
            return Math.max(1, Math.floor(damage * (1 - reduction)));
        },

        // ---- 百分比减免（直接应用） ----
        applyReducePercent: function(base, percent) {
            return base * (1 - percent / 100);
        },

        // ---- 堆叠计算（多来源百分比合并；默认加算） ----
        combinePercent: function(percents, mode) {
            mode = mode || 'add';
            if (mode === 'add') {
                var total = 0;
                for (var i = 0; i < percents.length; i++) {
                    total += percents[i];
                }
                return total;
            } else if (mode === 'mul') {
                var result = 1;
                for (var i = 0; i < percents.length; i++) {
                    result *= (1 + percents[i] / 100);
                }
                return (result - 1) * 100;
            }
            return 0;
        },

        // ============================================================
        //  属性点公式（原 LevelData.js 并入；Renewal 官方公式）
        // ============================================================

        // 属性点消耗：将属性从 X 提升到 X+1，消耗 floor((X - 1) / 10) + 2
        getStatPointCost: function(currentValue) {
            if (currentValue < 1) return 2;
            return Math.floor((currentValue - 1) / 10) + 1;
        },

        // 属性点获得：从 Lv.X 升到 Lv.X+1，获得 floor(X / 5) + 3
        getStatPointsGain: function(level) {
            if (level < 1) return 0;
            return Math.floor(level / 5) + 3;
        },

        // 属性点获得（100-150 级扩展：floor(X / 10) + 13）
        getStatPointsGainExtended: function(level) {
            if (level < 1) return 0;
            if (level <= 99) {
                return Math.floor(level / 5) + 3;
            }
            return Math.floor(level / 10) + 13;
        },
    };

    global.ArithmeticCore = ArithmeticCore;
    console.log('[ArithmeticCore] ✅ 已加载（纯算术函数库 + LevelData 公式并入）');

})(window);
