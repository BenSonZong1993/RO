// ============================================================
//  📁 js/battle/NormalAttackModifierEngine.js
//  普攻行为修饰引擎 - 仅负责“检测与组装”，不再执行技能
//  职责：
//    1. 处理 extraHits（额外普攻段，如二刀连击）
//    2. 检测 triggerSkill 触发条件，返回触发信息供 Scheduler 调度
//  不再直接调用 SkillExecutor / 扣 SP / 设冷却
// ============================================================
(function(global) {
    'use strict';

    // ============================================================
    //  核心处理函数
    // ============================================================
    function processNormalAttackModifiers(char, weaponType, target, baseHits) {
        var result = {
            hitResults: [],
            totalDamage: 0,
            triggeredSkills: [],   // 新增：存放触发技能信息
            triggered: [],         // 保留原字段，仅记录技能名（兼容旧版）
        };

        if (!baseHits || !Array.isArray(baseHits) || baseHits.length === 0) {
            return result;
        }

        var finalHits = [];
        for (var i = 0; i < baseHits.length; i++) {
            finalHits.push({
                damage: baseHits[i].damage || 0,
                canCrit: baseHits[i].canCrit !== undefined ? baseHits[i].canCrit : true,
                isCritical: false,
                type: baseHits[i].type || 'normal',
                source: 'base',
            });
        }

        var patches = global.SKILL_PATCHES || {};
        var modifiers = [];
        for (var skillAegis in patches) {
            if (!patches.hasOwnProperty(skillAegis)) continue;
            var patch = patches[skillAegis];
            if (patch && patch.onNormalAttack) {
                var skillLevel = (char.learnedSkills && char.learnedSkills[skillAegis]) || 0;
                if (skillLevel > 0) {
                    modifiers.push({
                        aegis: skillAegis,
                        level: skillLevel,
                        config: patch.onNormalAttack,
                        patch: patch,
                    });
                }
            }
        }

        for (var m = 0; m < modifiers.length; m++) {
            var mod = modifiers[m];
            var cfg = mod.config;

            if (cfg.requiresWeapon && Array.isArray(cfg.requiresWeapon)) {
                if (cfg.requiresWeapon.indexOf(weaponType) === -1) continue;
            }

            var chance = 0;
            if (typeof cfg.chance === 'number') {
                chance = cfg.chance;
            } else if (typeof cfg.chanceFormula === 'string') {
                chance = evaluateChanceFormula(cfg.chanceFormula, mod.level);
            } else {
                continue;
            }
            chance = Math.max(0, Math.min(1, chance));

            // --- 处理 triggerSkill 类型（只记录，不执行） ---
            if (cfg.type === 'triggerSkill') {
                if (Math.random() < chance) {
                    result.triggered.push(mod.aegis);
                    result.triggeredSkills.push({
                        skillAegis: cfg.skill || mod.aegis,
                        level: mod.level,
                        target: target,       // 传递目标引用（由 Scheduler 在 cast 时重新获取）
                        comboNext: cfg.comboNext || null,
                        comboWindowMs: cfg.comboWindowMs || 1000,
                        // 以下信息供 Scheduler 判定是否满足释放条件（不在此处消耗）
                        spCost: null,         // Scheduler 会从 SkillGateway 获取
                        cooldown: null,
                    });
                }
                continue;   // triggerSkill 不产生额外命中段，仅触发技能
            }

            // --- 原有 extraHits 处理（保持不变） ---
            if (Math.random() < chance) {
                result.triggered.push(mod.aegis);
                var extraHits = cfg.extraHits || 1;
                var damageMultiplier = cfg.damageMultiplier || 1.0;
                var canCrit = cfg.canCrit !== undefined ? cfg.canCrit : true;

                var currentLength = finalHits.length;
                for (var h = 0; h < currentLength; h++) {
                    var baseHit = finalHits[h];
                    var extraDamage = Math.floor(baseHit.damage * damageMultiplier);
                    finalHits.push({
                        damage: extraDamage,
                        canCrit: canCrit,
                        isCritical: false,
                        type: 'modifier',
                        source: mod.aegis,
                    });
                }
            }
        }

        var total = 0;
        for (var k = 0; k < finalHits.length; k++) {
            total += finalHits[k].damage;
        }
        result.hitResults = finalHits;
        result.totalDamage = total;

        return result;
    }

    // ============================================================
    //  辅助函数（保留）
    // ============================================================
    function evaluateChanceFormula(formula, skillLevel) {
        if (!formula || typeof formula !== 'string') return 0;
        try {
            var expr = formula.replace(/skill_lv/g, String(skillLevel));
            var result = Function('"use strict"; return (' + expr + ')')();
            return Math.min(1, Math.max(0, result / 100));
        } catch (e) {
            console.warn('[NormalAttackModifier] 概率公式解析失败:', formula, e);
            return 0;
        }
    }

    function evaluateCondition(condition, char, target) {
        var ctx = {
            hp: char.hp || 0,
            maxHp: char.maxHp || 100,
            hpPercent: ((char.hp || 0) / (char.maxHp || 100)) * 100,
            level: char.level || 1,
            jobLevel: char.jobLevel || 1,
            target: target || {},
        };
        if (target) {
            ctx.targetRace = target.race || '';
            ctx.targetLevel = target.level || 0;
            ctx.targetHpPercent = target.hp && target.maxHp ? (target.hp / target.maxHp) * 100 : 50;
        }
        try {
            var fn = new Function('ctx', 'with(ctx) { return !!(' + condition + '); }');
            return fn(ctx);
        } catch (e) {
            console.warn('[NormalAttackModifier] 条件表达式执行失败:', condition, e);
            return false;
        }
    }

    // ============================================================
    //  导出
    // ============================================================
    var NormalAttackModifierEngine = {
        process: processNormalAttackModifiers,
        evaluateChanceFormula: evaluateChanceFormula,
        evaluateCondition: evaluateCondition,
    };

    global.NormalAttackModifierEngine = NormalAttackModifierEngine;
    console.log('[NormalAttackModifierEngine] ✅ 已加载（纯检测引擎，不再执行技能）');
})(window);