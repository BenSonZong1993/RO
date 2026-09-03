// js/processors/CastProcessor.js
(function(global) {
    'use strict';

    var ArithmeticCore = global.ArithmeticCore;
    if (!ArithmeticCore) {
        console.error('[CastProcessor] 依赖缺失：ArithmeticCore 未加载');
        return;
    }

    var CastProcessor = {

        process: function(char) {
            var result = {
                type: 'cast',
                priority: 70,
                source: 'char.stats',
                modifications: {},
                metadata: {}
            };

            if (!char) return this._emptyResult();

            var int_ = char.stats?.int || 1;
            var dex = char.stats?.dex || 1;

            // ---- Renewal 素质减咏公式 ----
            // 可变咏唱缩减百分比 = sqrt((DEX*2 + INT) / 530) * 100
            // 当 DEX*2 + INT >= 530 时，缩减 = 100%
            var value = dex * 2 + int_;
            var reduction = 0;
            if (value >= 530) {
                reduction = 100;
            } else {
                reduction = Math.sqrt(value / 530) * 100;
                // 浮点修正，确保不超过100
                if (reduction > 100) reduction = 100;
            }
            // 保留一位小数（可选）
            reduction = Math.round(reduction * 10) / 10;

            result.modifications = {
                castReductionPercent: reduction   // 素质减咏百分比（0~100）
            };
            result.metadata = {
                int: int_,
                dex: dex,
                dex2PlusInt: value,
                rawReduction: reduction
            };

            return result;
        },

        _emptyResult: function() {
            return {
                type: 'cast',
                priority: 70,
                source: 'empty',
                modifications: {},
                metadata: { empty: true }
            };
        }
    };

    global.CastProcessor = CastProcessor;
    console.log('[CastProcessor] ✅ 已加载（官方 Renewal 变咏公式）');
})(window);