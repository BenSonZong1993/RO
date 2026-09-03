// js/10-battle/rAthenaEngine.js
// ============================================================
//  战斗核心引擎（纯 JavaScript 重写版）
//  职责：
//    1. 属性克制修正（调用 ElementDB）
//    2. 体型修正（调用 SizeFixData，仅作用于武器攻击力部分）
//    3. 动态修饰符读取（来自 char._modifiers）
//    4. 最终伤害计算（支持多段循环）
//  依赖：ElementDB, SizeFixData, RACE_CONSTANTS, ELEMENT_CONSTANTS
// ============================================================
(function(global) {
    'use strict';


    // ============================================================
    //  配置（从 rAthenaConfig 同步，或使用默认值）
    // ============================================================
    var CONFIG = global.rAthenaConfig || global.CONFIG || {};
    // 确保关键配置存在
    var IS_RENEWAL = CONFIG.RENEWAL !== undefined ? CONFIG.RENEWAL : true;
    var MIN_DAMAGE = CONFIG.skill_min_damage || 6;

    // ============================================================
    //  核心函数：计算属性克制修正
    // ============================================================
    function applyElementFix(attackElem, targetElem, elemLevel, baseDamage) {
        if (!global.ElementDB) {
            // console.warn('[rAthenaEngine] ElementDB 未加载，跳过属性修正');
            return baseDamage;
        }
        var ratio = global.ElementDB.getModifier(attackElem, targetElem, elemLevel || 1);
        var result = Math.floor(baseDamage * ratio / 100);
        if (result < 0) result = 0;
        return result;
    }

    // ============================================================
    //  核心函数：计算体型修正（仅作用于武器攻击力部分）
    // ============================================================
    function applySizeFix(weaponType, targetSize, weaponDamage) {
        if (!global.SizeFixData) {
            // console.warn('[rAthenaEngine] SizeFixData 未加载，跳过体型修正');
            return weaponDamage;
        }
        var ratio = global.SizeFixData.getFix(weaponType, targetSize, IS_RENEWAL);
        return Math.floor(weaponDamage * ratio / 100);
    }

    // ============================================================
    //  核心函数：读取动态修饰符
    // ============================================================
function applyModifiers(char, target, baseDamage) {
    // ---- 防御性检查 ----
    if (!char || !target || !baseDamage || baseDamage <= 0) return 0;

    var modifiers = null;
    if (char._finalStats && char._finalStats.modifiers) {
        modifiers = char._finalStats.modifiers;
    } else if (char._modifiers) {
        modifiers = char._modifiers;
    }
    if (!modifiers) return 0;

    var extraDamage = 0;

    // ---- 辅助函数：将 target 的 race/element 统一转为字符串 ----
    function getTargetRace() {
        if (typeof target.race === 'string') return target.race;
        if (typeof target.race === 'number' && global.RACE_NAMES) {
            var name = global.RACE_NAMES[target.race];
            return name ? name.replace(/^RC_/, '') : null;
        }
        return null;
    }
    function getTargetElement() {
        if (typeof target.element === 'string') return target.element;
        if (typeof target.element === 'number' && global.ELEMENT_NAMES) {
            var name = global.ELEMENT_NAMES[target.element];
            return name ? name.replace(/^ELE_/, '') : null;
        }
        return null;
    }

    var raceKey = getTargetRace();
    var elemKey = getTargetElement();

    // ---- 1. 种族增伤（如：动物杀手、天使之击） ----
    if (raceKey && modifiers.raceAddDamage) {
        var bonus = modifiers.raceAddDamage[raceKey] || 0;
        // 若未精确匹配，尝试清理空格（适配复合键，但建议在 Processor 层拆分）
        if (bonus === 0) {
            var cleaned = raceKey.replace(/[\s_]/g, '');
            for (var key in modifiers.raceAddDamage) {
                if (key.replace(/[\s_]/g, '') === cleaned) {
                    bonus = modifiers.raceAddDamage[key];
                    break;
                }
            }
        }
        if (bonus > 0) {
            extraDamage += Math.floor(baseDamage * bonus / 100);
        }
    }

    // ---- 2. 属性增伤 ----
    if (elemKey && modifiers.elementalAddDamage) {
        var bonusElem = modifiers.elementalAddDamage[elemKey] || 0;
        if (bonusElem > 0) {
            extraDamage += Math.floor(baseDamage * bonusElem / 100);
        }
    }

    // ---- 3. 种族防御减免（EquipService 产出键为 raceReduceDamage，兼容旧键 raceDefense） ----
    if (raceKey) {
        var raceDefMap = modifiers.raceReduceDamage || modifiers.raceDefense || {};
        var defBonus = raceDefMap[raceKey] || 0;
        if (defBonus > 0) {
            extraDamage -= Math.floor(baseDamage * defBonus / 100);
        }
    }

    // ---- 4. 元素抗性减免（同上：elementalReduceDamage / 兼容 elementResistance） ----
    if (elemKey) {
        var elemResMap = modifiers.elementalReduceDamage || modifiers.elementResistance || {};
        var resBonus = elemResMap[elemKey] || 0;
        if (resBonus > 0) {
            extraDamage -= Math.floor(baseDamage * resBonus / 100);
        }
    }

    // ---- 5. 体型增伤（卡片 bAddSize 等；体型键来自怪物单位 size） ----
    if (modifiers.sizeAddDamage) {
        var sizeKey = (typeof target.size === 'string') ? target.size
            : (global.SIZE_NAMES ? global.SIZE_NAMES[target.size] : null);
        if (sizeKey) {
            var sizeBonus = modifiers.sizeAddDamage[sizeKey] || 0;
            if (sizeBonus > 0) {
                extraDamage += Math.floor(baseDamage * sizeBonus / 100);
            }
        }
    }

    return extraDamage;
}

    // ============================================================
    //  命中/闪避解析：玩家侧取面板值（_finalStats.panelHIT/panelFLEE），怪物侧取单位字段
    //  命中率 = rAthenaFormulas.calcHitRate（80 + HIT − FLEE，钳 5~95）
    // ============================================================
    function _getCombatHitFlee(unit) {
        if (!unit) return { hit: 0, flee: 0 };
        var fs = unit._finalStats;
        if (fs && (fs.panelHIT !== undefined || fs.panelFLEE !== undefined)) {
            return { hit: fs.panelHIT || 0, flee: fs.panelFLEE || 0 };
        }
        return { hit: unit.hit || 0, flee: unit.flee || 0 };
    }

    function _resolveHitChance(attacker, target) {
        var a = _getCombatHitFlee(attacker);
        var d = _getCombatHitFlee(target);
        if (global.rAthena && global.rAthena.formulas && typeof global.rAthena.formulas.calcHitRate === 'function') {
            return global.rAthena.formulas.calcHitRate(a.hit, d.flee);
        }
        var rate = 80 + a.hit - d.flee;
        return Math.max(5, Math.min(95, rate));
    }

// ============================================================
//  主函数：完整伤害计算（多段结算框架版）
//  内部已重构为：组装 stats → 循环调用 SingleHitCalculator.calcSingleHit 原子函数
//  （原魔法/物理两份重复内循环已合并为一份；命中与暴击均为逐段独立判定）
// ============================================================
function _assembleAttackerStats(attacker, baseAtk, options) {
    var fs = (attacker && attacker._finalStats) || {};
    var stats = {
        hit: fs.panelHIT !== undefined ? fs.panelHIT : (attacker && attacker.hit) || 0,
        cri: fs.cri || (attacker && attacker.cri) || 0,
        modifiers: fs.modifiers || (attacker && attacker._modifiers) || null,
        finalATK: baseAtk,
        finalMATK: 0,
        equipATK: 0,
        statusATK: 0,
    };
    if (options.isMagic === true) {
        stats.finalMATK = baseAtk;   // 魔法：baseAtk 已由调用方传 finalMATK
    } else {
        // 物理：武器/状态拆分（无面板拆分数据时按 60/40 估算）
        var equipATK = options.equipATK || 0;
        var statusATK = options.statusATK || 0;
        if (attacker && attacker._finalStats) {
            equipATK = fs.equipATK || fs.equipAtk || 0;
            statusATK = fs.statusATK || fs.baseAtk || 0;
            if (equipATK === 0 && baseAtk > 0) {
                equipATK = Math.floor(baseAtk * 0.6);
                statusATK = baseAtk - equipATK;
            }
        } else {
            equipATK = Math.floor(baseAtk * 0.6);
            statusATK = baseAtk - equipATK;
        }
        stats.equipATK = equipATK;
        stats.statusATK = statusATK;
    }
    return stats;
}

function _assembleDefenderStats(target) {
    if (!target) return { flee: 0, def: 0, mdef: 0, size: 'Medium', element: 'Neutral' };
    var tfs = target._finalStats || {};
    function _str(val, nameMap, prefix) {
        if (typeof val === 'string') return val;
        if (typeof val === 'number' && nameMap) {
            var name = nameMap[val];
            return name ? name.replace(new RegExp('^' + prefix + '_'), '') : null;
        }
        return null;
    }
    return {
        flee: tfs.panelFLEE !== undefined ? tfs.panelFLEE : (target.flee || 0),
        def: (typeof target.def === 'number') ? target.def : 0,
        mdef: (typeof target.mdef === 'number') ? target.mdef
            : (typeof target.defenseMagic === 'number') ? target.defenseMagic : 0,
        size: target.size || target.Size || 'Medium',
        race: _str(target.race, global.RACE_NAMES, 'RC'),
        element: _str(target.element, global.ELEMENT_NAMES, 'ELE'),
        defenseElement: tfs.defenseElement || _str(target.element, global.ELEMENT_NAMES, 'ELE') || 'Neutral',
        defenseElementLevel: tfs.defenseElementLevel || target.ElementLevel || 1,
    };
}

function calculateDamage(attacker, target, baseAtk, options) {
    options = options || {};

    // ---- 基础参数 ----
    var isMagic = options.isMagic === true;
    var isCritical = options.isCritical === true;   // 技能级强制/预判定暴击（兼容旧调用）
    var criDamageBonus = options.criDamageBonus || 0;
    var hitCount = Math.min(Math.max(options.hitCount || 1, 1), 20);
    var hitType = options.hitType || 'Single';
    var skillDamage = options.skillDamage || 0;
    var weaponType = options.weaponType || 'Fist';
    var attackElem = options.attackElem || 'Neutral';
    var elemLevel = options.elemLevel || 1;

    // ================================================================
    //  ★ 加成插入点系统：聚合 hooks（BonusCollector）
    //    H1 baseAtkFlat / H2 baseAtkPercent → 作用于 baseAtk（受后续所有乘区放大）
    //    H4 critRate → 叠加到暴击率；H6 forceElement → 覆盖攻击属性
    //    H3/H5/H7/H8 由原子函数在段内应用；H9 trueDamage 在段后直加
    // ================================================================
    var hooks = (global.BonusCollector && typeof global.BonusCollector.collect === 'function')
        ? global.BonusCollector.collect(attacker, target, weaponType) : null;
    if (hooks) {
        var baf = hooks.baseAtkFlat || 0;
        var bapFactor = 1 + (hooks.baseAtkPercent || 0) / 100;
        if (baf !== 0 || bapFactor !== 1) baseAtk = (baseAtk + baf) * bapFactor;   // ★ H1 + H2
        if (hooks.forceElement) attackElem = hooks.forceElement;                    // ★ H6
        options.criRate = (options.criRate || 0) + (hooks.critRate || 0);           // ★ H4
    }

    // ---- 结果容器 ----
    var details = {
        baseAtk: baseAtk,
        weaponAtk: 0,
        statusAtk: 0,
        sizeFixRatio: 100,
        elementFixRatio: 100,
        modifierExtra: 0,
        finalDamage: 0,
        hitResults: []
    };

    if (!attacker || !target) {
        return { damage: 0, details: details, isCritical: isCritical, criDamageBonus: criDamageBonus };
    }

    // ---- 组装纯函数入参（单位对象 → stats 对象，一次性完成） ----
    var attackerStats = _assembleAttackerStats(attacker, baseAtk, options);
    var defenderStats = _assembleDefenderStats(target);

    // ---- 逐段独立结算（统一循环：物理/魔法差异全部收进原子函数内部） ----
    var totalDamage = 0;
    var anyCritical = false;
    var hitResults = [];
    var atom = (global.SingleHitCalculator && global.SingleHitCalculator.calcSingleHit) || null;

    for (var i = 0; i < hitCount; i++) {
        var hit;
        if (atom) {
            hit = global.SingleHitCalculator.calcSingleHit(attackerStats, defenderStats, {
                skillDamage: skillDamage,
                attackElem: attackElem,
                elemLevel: elemLevel,
                weaponType: weaponType,
                isMagic: isMagic,
                // 逐段独立暴击：技能声明可暴击时每段各自 roll
                canCritical: isCritical || options.canCritical === true,
                criRate: options.criRate || 0,
                criDamageBonus: criDamageBonus,
                forceCritical: isCritical,
                hooks: hooks,               // ★ H3/H5/H7/H8 段内孔位
                hitIndex: i,
            });
        } else {
            // 原子函数未加载的降级路径（不应出现；保留旧最小实现）
            hit = { damage: Math.max(1, Math.floor(baseAtk * (1 + skillDamage / 100) * 0.5)),
                    isHit: true, isCritical: false, hitIndex: i, status: 'hit' };
        }
        if (!hit.isHit) {
            // 标准化：确保每段 miss 仍然包含 isHit/isCritical 字段
            hitResults.push({ damage: 0, hitIndex: i, status: 'miss', isHit: false, isCritical: false });
            continue;
        }
        // ★ H9 trueDamage 孔：真实伤害直加（跳过所有乘区，每段固定值）
        if (hooks && hooks.trueDamage) {
            hit.damage += hooks.trueDamage;
        }
        if (hit.isCritical) anyCritical = true;
        // 首段快照（供 details 汇总展示，语义与旧版一致）
        if (i === 0) {
            details.elementFixRatio = (hit.breakdown && hit.breakdown.elementFixRatio) || 100;
            details.modifierExtra = (hit.breakdown && hit.breakdown.modifierExtra) || 0;
            details.sizeFixRatio = (hit.breakdown && hit.breakdown.sizeFixRatio) || 100;
        }
        totalDamage += hit.damage;
        // 确保 hitResults 段内包含 isHit 与 isCritical
        hitResults.push({ damage: hit.damage, hitIndex: i, status: hit.status, breakdown: hit.breakdown || null, isHit: true, isCritical: !!hit.isCritical });
    }

    details.finalDamage = totalDamage;
    details.hitResults = hitResults;
    if (hooks) details.hooks = hooks;   // 加成快照（调试/展示用）
    details.weaponAtk = Math.floor(attackerStats.equipATK || 0);
    details.statusAtk = Math.floor(attackerStats.statusATK || attackerStats.finalMATK || 0);

    return {
        damage: totalDamage,
        details: details,
        hitCount: hitCount,
        hitType: hitType,
        isCritical: anyCritical || isCritical,
        criDamageBonus: criDamageBonus
    };
}

    // ============================================================
    //  便捷函数：普攻伤害
    // ============================================================
    function calculateNormalAttackDamage(attacker, target, weaponType) {
        var attackElem = 'Neutral';
        var attackElemLevel = 1;
        var baseAtk = 5;

        if (attacker && attacker._finalStats) {
            if (global.AttributeMediator && typeof global.AttributeMediator.getDerivedValue === 'function') {
                attackElem = global.AttributeMediator.getDerivedValue('attackElement') || 'Neutral';
                attackElemLevel = global.AttributeMediator.getDerivedValue('attackElementLevel') || 1;
                baseAtk = global.AttributeMediator.getDerivedValue('finalATK') || 5;
            } else {
                attackElem = attacker._finalStats.attackElement || 'Neutral';
                attackElemLevel = attacker._finalStats.attackElementLevel || 1;
                baseAtk = attacker._finalStats.finalATK || 5;
            }
        }

        return calculateDamage(attacker, target, baseAtk, {
            weaponType: weaponType,
            attackElem: attackElem,
            elemLevel: attackElemLevel,
            hitCount: 1,
            hitType: 'Single',
            skillDamage: 100,
            // 普攻可暴击：逐段（单段）独立判定，暴击率取面板 CRI
            canCritical: true,
            criRate: (attacker && attacker._finalStats && attacker._finalStats.cri) || 0,
        });
    }

    // ============================================================
    //  暴露全局
    // ============================================================
    var rAthenaEngine = {
        // 核心函数
        calculateDamage: calculateDamage,
        calculateNormalAttackDamage: calculateNormalAttackDamage,

        // 子函数（可独立调用）
        applyElementFix: applyElementFix,
        applySizeFix: applySizeFix,
        applyModifiers: applyModifiers,

        // 配置
        CONFIG: CONFIG,
        IS_RENEWAL: IS_RENEWAL,
    };

    // 挂载到全局
    global.rAthena = global.rAthena || {};
    global.rAthena.engine = rAthenaEngine;

    console.log('[rAthenaEngine] ✅ 已加载（多段循环版）');
})(window);
