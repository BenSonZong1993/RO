// ============================================================
//  📁 js/core/SkillConditionSystem.js
//  技能条件判断系统（配置驱动，禁止硬编码具体武器/技能名进战斗核心）
//  职责：统一评估技能数据中的条件规则（释放前门控 / 释放中段数变化 / 释放后分支）。
//  条件结构（三种写法均可）：
//    1. 字符串速记        'weaponSeries:Knuckle'
//    2. 单一条件对象      { type: 'weaponSeries', values: ['Knuckle'] }
//    3. 组合条件          { all: [cond, cond, ...] }   （AND）
//                        { any: [cond, cond, ...] }   （OR）
//  条件类型（本批实现 + 预留）：
//    weaponSeries  武器系列（values 为系列名数组，经 WEAPON_SERIES_OF 映射）
//    weaponType    武器类型（values 与 SubType 精确比对）
//    skillLearned  已习得技能（values 为 AegisName 数组，查 char.learnedSkills）
//    status        当前状态（values 为状态名数组，查 char.sc / char.statusFlags）
//    always        恒真（无参）
//    expr          表达式（expression 字符串，ctx 注入；保留给无法结构化的复杂条件）
//  消费方：SkillExecutor._resolveEffectiveHitCount（hitCountWhen）等；
//          未来的 castGateWhen / effectBranchWhen 沿用同一 evaluate 入口。
// ============================================================
(function(global) {
    'use strict';

    // ---- 武器 SubType → 武器系列 映射（配置项：策划可直接增删） ----
    // 系列 = rAthena 语义的"武器大类"（拳套/短剑/弓/杖…），SubType = 更细的物品子类
    var WEAPON_SERIES_OF = {
        'Knuckle': 'Knuckle',        // 拳套/指虎系列
        'Dagger': 'Dagger',          // 短剑
        'Sword': 'Sword',            // 剑
        'Two-Handed Sword': 'Sword',
        'Spear': 'Spear',            // 枪
        'Two-Handed Spear': 'Spear',
        'Axe': 'Axe',                // 斧
        'Two-Handed Axe': 'Axe',
        'Mace': 'Mace',              // 钝器
        'Bow': 'Bow',                // 弓
        'Staff': 'Staff',            // 杖
        'Two-Handed Staff': 'Staff',
        'Book': 'Book',              // 书
        'Musical': 'Musical',        // 乐器
        'Whip': 'Whip',              // 鞭
        'Revolver': 'Revolver',      // 手枪
        'Rifle': 'Rifle',
        'Shotgun': 'Shotgun',
        'Gatling Gun': 'Gatling',
        'Grenade Launcher': 'Grenade',
        'Katar': 'Katar',            // 拳刃
        'Huuma': 'Huuma',            // 风魔飞镖
    };

    function _getSeries(ctx) {
        var wt = ctx.weaponType;
        if (!wt) return null;
        if (ctx.weaponSeries && ctx.weaponSeries[wt]) return ctx.weaponSeries[wt];
        return WEAPON_SERIES_OF[wt] || wt;
    }

    // ---- 单一条件评估（标准化后） ----
    function _evaluateSingle(cond, ctx) {
        var type = cond.type;
        var values = cond.values;
        switch (type) {
            case 'always':
                return true;
            case 'weaponSeries': {
                var series = _getSeries(ctx);
                return Array.isArray(values) ? values.indexOf(series) !== -1 : series === values;
            }
            case 'weaponType':
                return Array.isArray(values) ? values.indexOf(ctx.weaponType) !== -1 : ctx.weaponType === values;
            case 'skillLearned': {
                var learned = (ctx.char && ctx.char.learnedSkills) || {};
                return Array.isArray(values)
                    ? values.some(function(s) { return (learned[s] || 0) > 0; })
                    : (learned[values] || 0) > 0;
            }
            case 'status': {
                var flags = (ctx.char && (ctx.char.statusFlags || (ctx.char.sc && ctx.char.sc.getAll && ctx.char.sc.getAll()))) || {};
                return Array.isArray(values)
                    ? values.some(function(s) { return !!flags[s]; })
                    : !!flags[values];
            }
            case 'targetRace': {
                var race = ctx.target && ctx.target.race;
                return Array.isArray(values) ? values.indexOf(race) !== -1 : race === values;
            }
            case 'targetSize': {
                var size = (ctx.target && (ctx.target.size || ctx.target.Size)) || null;
                return Array.isArray(values) ? values.indexOf(size) !== -1 : size === values;
            }
            case 'targetElement': {
                var elem = ctx.target && ctx.target.element;
                return Array.isArray(values) ? values.indexOf(elem) !== -1 : elem === values;
            }
            case 'expr': {
                if (!cond.expression) return false;
                try {
                    var fn = new Function('ctx', 'with(ctx) { return !!(' + cond.expression + '); }');
                    return fn(ctx);
                } catch (e) {
                    console.warn('[SkillConditionSystem] 表达式条件执行失败:', cond.expression, e);
                    return false;
                }
            }
            default:
                console.warn('[SkillConditionSystem] 未知条件类型:', type);
                return false;
        }
    }

    // ---- 标准化：字符串速记 / 对象 → 标准形 ----
    function _normalize(cond) {
        if (!cond) return null;
        if (typeof cond === 'string') {
            var sep = cond.indexOf(':');
            if (sep === -1) return { type: cond, values: null };
            return {
                type: cond.slice(0, sep),
                values: cond.slice(sep + 1).split(',').map(function(s) { return s.trim(); }),
            };
        }
        if (Array.isArray(cond)) return { all: cond };
        return cond;
    }

    // ============================================================
    //  公开接口：评估一个条件（单一或组合）
    // ============================================================
    function evaluate(condition, ctx) {
        var cond = _normalize(condition);
        if (!cond) return true;   // 无条件 = 恒满足
        if (cond.all) {
            return cond.all.every(function(c) { return evaluate(c, ctx); });
        }
        if (cond.any) {
            return cond.any.some(function(c) { return evaluate(c, ctx); });
        }
        return _evaluateSingle(cond, ctx || {});
    }

    // ---- 便捷：当前武器是否属于某系列（供调试/其他模块复用） ----
    function isWeaponSeries(weaponType, seriesValues) {
        return evaluate({ type: 'weaponSeries', values: seriesValues }, { weaponType: weaponType });
    }

    global.SkillConditionSystem = {
        evaluate: evaluate,
        isWeaponSeries: isWeaponSeries,
        WEAPON_SERIES_OF: WEAPON_SERIES_OF,   // 暴露映射表供配置工具读取
    };
    console.log('[SkillConditionSystem] ✅ 已加载（条件判断系统：weaponSeries/weaponType/skillLearned/status/targetRace/targetSize/targetElement/expr + AND/OR）');
})(window);
