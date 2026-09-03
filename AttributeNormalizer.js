// ============================================================
//  FILE: AttributeNormalizer.js
//  LAYER: core（标准化引擎，纯函数）
//  权限：无（无状态工具库，不做任何写入）
//  依赖：无
//  契约：ro_ai_context.js 规则 A2（距离单位统一：格数→像素）；
//        供 AttributeGateway / AttributeSystem / SkillExecutor 调用
//  职责：属性值的单位转换与枚举归一化（唯一实现处，禁止散落硬编码）
// ============================================================
(function(global) {
    'use strict';

    var PIXELS_PER_CELL = (global.SKILL_CONFIG && global.SKILL_CONFIG.PIXELS_PER_CELL) || RO_CONSTANTS.DEFAULT_ATTACK_RANGE;

    var DEFAULT_ELEMENTS = ['Neutral', 'Water', 'Earth', 'Fire', 'Wind', 'Poison', 'Holy', 'Dark', 'Ghost', 'Undead'];

    // ---- 数值安全化：任何非有限数字回落到默认值 ----
    function toNumber(value, fallback) {
        if (typeof value === 'number' && isFinite(value)) return value;
        if (typeof value === 'string' && value.trim() !== '' && isFinite(Number(value))) return Number(value);
        return fallback;
    }

    // ---- 区间钳制 ----
    function clamp(value, min, max) {
        value = toNumber(value, min);
        if (value < min) return min;
        if (value > max) return max;
        return value;
    }

    // ---- 0~1 归一化（咏唱缩减等比例字段） ----
    function clamp01(value) {
        return clamp(value, 0, 1);
    }

    // ---- 单位转换：格数 → 像素（规则 A2 唯一出口） ----
    function cellToPixel(cells) {
        return Math.max(1, toNumber(cells, 1) * PIXELS_PER_CELL);
    }

    // ---- 单位转换：像素 → 格数 ----
    function pixelToCell(pixels) {
        return Math.max(1, Math.round(toNumber(pixels, PIXELS_PER_CELL) / PIXELS_PER_CELL));
    }

    // ---- 元素枚举归一化（'Ele_Fire' / 'fire' → 'Fire'） ----
    function normalizeElement(name, validList) {
        var list = validList || global.ELEMENT_LIST || DEFAULT_ELEMENTS;
        if (!name) return 'Neutral';
        if (typeof name !== 'string') return 'Neutral';
        if (list.indexOf(name) !== -1) return name;
        var raw = String(name).replace(/^Ele_/, '');
        var normalized = raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
        if (list.indexOf(normalized) !== -1) return normalized;
        if (list.indexOf(raw) !== -1) return raw;
        return 'Neutral';
    }

    // ---- finalStats 全量标准化（幂等：已标准化输入原样通过） ----
    //  仅做验证与钳制，不重复做格数→像素换算（换算只在 AttributeSystem.assemble 发生一次）
    function normalizeFinalStats(stats) {
        if (!stats || typeof stats !== 'object') return null;
        var s = stats;

        s.finalATK = Math.max(0, toNumber(s.finalATK, 0));
        s.finalMATK = Math.max(0, toNumber(s.finalMATK, 0));
        s.finalDEF = Math.max(0, toNumber(s.finalDEF, 0));
        s.finalMDEF = Math.max(0, toNumber(s.finalMDEF, 0));
        s.finalMaxHP = Math.max(1, toNumber(s.finalMaxHP, 100));
        s.finalMaxSP = Math.max(1, toNumber(s.finalMaxSP, 50));
        s.finalASPD = Math.max(0, toNumber(s.finalASPD, 2000));
        s.aspeed = clamp(s.aspeed, 0, 193);
        s.variableCastReduction = clamp01(s.variableCastReduction);
        s.fixedCastReduction = Math.max(0, toNumber(s.fixedCastReduction, 0));
        s.attackRange = Math.max(1, toNumber(s.attackRange, PIXELS_PER_CELL));

        s.attackElement = normalizeElement(s.attackElement);
        s.defenseElement = normalizeElement(s.defenseElement);
        if (!s.attackElementLevel) s.attackElementLevel = 1;
        if (!s.defenseElementLevel) s.defenseElementLevel = 1;
        if (!s.weaponType) s.weaponType = 'None';
        if (!s.modifiers || typeof s.modifiers !== 'object') s.modifiers = {};
        if (!s.statMods || typeof s.statMods !== 'object') s.statMods = {};

        return s;
    }

    global.AttributeNormalizer = {
        toNumber: toNumber,
        clamp: clamp,
        clamp01: clamp01,
        cellToPixel: cellToPixel,
        pixelToCell: pixelToCell,
        normalizeElement: normalizeElement,
        normalizeFinalStats: normalizeFinalStats,
        PIXELS_PER_CELL: PIXELS_PER_CELL,
    };

    console.log('[AttributeNormalizer] ✅ 已加载（单位转换/枚举归一化引擎）');
})(window);
