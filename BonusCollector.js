// ============================================================
//  📁 js/battle/BonusCollector.js
//  加成收集器（加成插入点系统的收集层）
//  职责：伤害计算前，把"所有生效中的 modifiers 配置"聚合成 hooks 对象，
//        交给 rAthenaEngine → SingleHitCalculator 在各孔位应用。
//  加成来源（三层，全部配置驱动，禁止在本文件硬编码技能名）：
//    1. 已学被动：char.learnedSkills 中的技能，其 merged.modifiers 或
//       SKILL_PATCHES[aegis].modifiers 生效（熟练度类）
//    2. 状态挂载：global.ACTIVE_SKILL_MODIFIERS 数组（涂毒类状态技能在
//       生效期间 push { modifiers: [...], source, skillLevel }，到期 remove）
//    3. 预留：装备/卡片产出的面板修饰符仍走 AttributeGateway，不经此层
//  聚合语义（按 valueType）：
//    flat        → Σ（直接累加）
//    percent     → Σ（百分点累加，应用时 /100）
//    multiplier  → Σ（加算倍率，应用时 1 + Σ；可预测、顺序无关）
//  特殊孔：forceElement 取"最后一个非空值"（后写优先，覆盖攻击属性）
//  条件评估：SkillConditionSystem.evaluate（只答 true/false），condition=null 恒生效
// ============================================================
(function(global) {
    'use strict';

    // 九孔清单（与 SingleHitCalculator 的应用位置一一对应）
    var HOOK_KEYS = ['baseAtkFlat', 'baseAtkPercent', 'hitRate', 'critRate', 'critMultiplier',
                     'forceElement', 'sizeModifier', 'raceModifier', 'trueDamage'];

    function _emptyHooks() {
        var hooks = {};
        for (var i = 0; i < HOOK_KEYS.length; i++) hooks[HOOK_KEYS[i]] = 0;
        hooks.forceElement = null;
        return hooks;
    }

    // 单条加成：解析数值（value + valuePerLevel*(level-1)，支持熟练度随等级成长）
    function _resolveValue(mod, skillLevel) {
        var base = (typeof mod.value === 'number') ? mod.value : 0;
        if (typeof mod.valuePerLevel === 'number' && typeof skillLevel === 'number' && skillLevel > 1) {
            base += mod.valuePerLevel * (skillLevel - 1);
        }
        return base;
    }

    function _apply(hooks, mod, ctx, skillLevel) {
        if (!mod || !mod.hook || HOOK_KEYS.indexOf(mod.hook) === -1) return;
        if (mod.condition && !(global.SkillConditionSystem && global.SkillConditionSystem.evaluate(mod.condition, ctx))) return;
        var value = _resolveValue(mod, skillLevel);
        if (mod.hook === 'forceElement') {
            if (mod.value) hooks.forceElement = mod.value;   // 后写优先
            return;
        }
        hooks[mod.hook] += value;
    }

    function _applyList(hooks, modifiers, ctx, skillLevel) {
        if (!Array.isArray(modifiers)) return;
        for (var i = 0; i < modifiers.length; i++) _apply(hooks, modifiers[i], ctx, skillLevel);
    }

    // ============================================================
    //  主入口：聚合当前生效的所有加成
    //  ctx = { char, target, weaponType }
    // ============================================================
    function collect(char, target, weaponType) {
        var hooks = _emptyHooks();
        if (!char) return hooks;

        var ctx = { char: char, target: target || {}, weaponType: weaponType };

        // ---- 来源 1：已学技能（被动熟练度走这里） ----
        var learned = char.learnedSkills || {};
        for (var aegis in learned) {
            if (!learned.hasOwnProperty(aegis)) continue;
            var level = learned[aegis] || 0;
            if (level <= 0) continue;
            ctx.skillLevel = level;
            ctx.skillAegis = aegis;

            // 1a/1b. 补丁槽与技能数据二选一：网关 L2 会把 SKILL_PATCHES 合并进 merged
            //        （modifiers 为同一数组引用），此处按引用判重，避免双重计费
            var patch = global.SKILL_PATCHES && global.SKILL_PATCHES[aegis];
            var merged = global.SkillGateway ? global.SkillGateway.getMergedSkillData(aegis, level) : null;
            if (merged && merged.modifiers) {
                _applyList(hooks, merged.modifiers, ctx, level);
                if (!(patch && patch.modifiers === merged.modifiers)) {
                    // merged 未携带补丁 modifiers 时补收补丁槽
                    // （注：merged.modifiers 若来自数据文件且补丁另有 modifiers，两者叠加）
                    _applyList(hooks, patch.modifiers, ctx, level);
                }
            } else if (patch && patch.modifiers) {
                _applyList(hooks, patch.modifiers, ctx, level);
            }
        }

        // ---- 来源 2：状态挂载（涂毒类；生效期由状态系统维护） ----
        var active = global.ACTIVE_SKILL_MODIFIERS;
        if (Array.isArray(active)) {
            for (var s = 0; s < active.length; s++) {
                var entry = active[s];
                if (!entry || !entry.modifiers) continue;
                ctx.skillLevel = entry.skillLevel || 1;
                ctx.skillAegis = entry.source || null;
                _applyList(hooks, entry.modifiers, ctx, ctx.skillLevel);
            }
        }

        return hooks;
    }

    global.BonusCollector = {
        collect: collect,
        HOOK_KEYS: HOOK_KEYS,
    };
    console.log('[BonusCollector] ✅ 已加载（加成收集器：9 孔 × learnedSkills/SKILL_PATCHES/状态挂载）');
})(window);
