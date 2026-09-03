// ============================================================
//  📁 js/config/LevelPenaltyConfig.js
//  功能：等级差经验/掉宝惩罚表（真全局，不属于任何模式配置组）
//  依据：RO 官方等级惩罚表；差距 = 魔物等级 - 角色等级
//  规则：策划可调；查询为纯函数，由 LootManager 在击杀结算时消费
//  乘区规范：与模式因子（monster.exp / char.expGain / drop.rate）相互独立、连乘不覆盖
// ============================================================
(function(global) {
    'use strict';

    // ---------- 经验值奖惩表 ----------
    // 每行 [最小差距, 最大差距, 倍率]；含边界，自上而下首个命中生效
    var EXP_TABLE = [
        [ 16,  Infinity, 0.40 ],   // +16 或以上：40%（-60%）
        [ 15,  15,       1.15 ],   // +15：115%
        [ 14,  14,       1.20 ],   // +14：120%
        [ 13,  13,       1.25 ],   // +13：125%
        [ 12,  12,       1.30 ],   // +12：130%
        [ 11,  11,       1.35 ],   // +11：135%
        [ 10,  10,       1.40 ],   // +10：经验峰值 140%
        [  9,   9,       1.35 ],
        [  8,   8,       1.30 ],
        [  7,   7,       1.25 ],
        [  6,   6,       1.20 ],
        [  5,   5,       1.15 ],
        [  4,   4,       1.10 ],
        [  3,   3,       1.05 ],
        [ -5,   2,       1.00 ],   // 安全区：-5 至 +2 = 100%
        [-10,  -6,       0.95 ],
        [-15, -11,       0.90 ],
        [-20, -16,       0.85 ],
        [-25, -21,       0.60 ],
        [-30, -26,       0.35 ],
        [ -Infinity, -31, 0.10 ],  // -31 或以下：10%
    ];

    // ---------- 掉宝率奖惩表 ----------
    var DROP_TABLE = [
        [ 16,  Infinity, 0.50 ],   // +16 或以上：50%
        [ 13,  15,       0.60 ],   // +13 至 +15：60%
        [ 10,  12,       0.70 ],
        [  7,   9,       0.80 ],
        [  4,   6,       0.90 ],
        [ -3,   3,       1.00 ],   // 安全区：-3 至 +3 = 100%
        [ -6,  -4,       0.90 ],
        [ -9,  -7,       0.80 ],
        [-12, -10,       0.70 ],
        [-15, -13,       0.60 ],
        [ -Infinity, -16, 0.50 ],  // -16 或以下：50%
    ];

    function _lookup(table, diff) {
        if (typeof diff !== 'number' || isNaN(diff)) return 1.0;
        for (var i = 0; i < table.length; i++) {
            var row = table[i];
            if (diff >= row[0] && diff <= row[1]) return row[2];
        }
        return 1.0;
    }

    // 纯函数查询：传入等级差，返回倍率（1.0 = 无修正）
    function getExpMultiplier(diff) { return _lookup(EXP_TABLE, diff); }
    function getDropMultiplier(diff) { return _lookup(DROP_TABLE, diff); }

    global.LevelPenalty = {
        getExpMultiplier: getExpMultiplier,
        getDropMultiplier: getDropMultiplier,
        _expTable: EXP_TABLE,
        _dropTable: DROP_TABLE,
    };

    console.log('[LevelPenaltyConfig] ✅ 已加载（等级差经验/掉宝惩罚表，真全局）');
})(window);
