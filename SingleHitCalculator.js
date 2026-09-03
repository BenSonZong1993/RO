// ============================================================
//  📁 js/battle/SingleHitCalculator.js
//  单段结算原子函数（多段结算框架的"标准砖"）
//  职责：计算"单次攻击"的完整结算（命中 → 暴击 → 攻击力拆分/体型修正 →
//        防御减免 → 元素克制 → 种族/属性/体型修饰符），输出标准化结果。
//  设计约束：
//    1. 纯函数：只依赖传入的三个参数对象，不读任何单位对象（char/target）；
//       允许依赖的"静态数据"仅 ElementDB / SizeFixData（克制表与体型表）与
//       rAthenaFormulas.calcHitRate（命中率公式），这些是不可变配置。
//    2. 物理/魔法由 attackConfig.isMagic 切换：
//       物理 = 武器/状态拆分 + 体型修正 + def 减免；
//       魔法 = finalMATK 直入 + mdef 减免 + 跳过体型修正。
//    3. 暴击逐段独立判定：attackConfig.forceCritical > canCritical+criRate roll > 不暴击。
//  契约：
//    calcSingleHit(attackerStats, defenderStats, attackConfig)
//      attackerStats: { hit, cri, equipATK, statusATK, finalMATK, modifiers }
//      defenderStats: { flee, def, mdef, size, race, element, defenseElement, defenseElementLevel }
//      attackConfig : { skillDamage(%), attackElem, elemLevel, weaponType,
//                       isMagic, canCritical, criRate, criDamageBonus,
//                       forceCritical, minDamage, hitIndex }
//      → { damage, isHit, isCritical, hitIndex, status, breakdown }
//  依赖：ElementDB, SizeFixData, rAthenaFormulas.calcHitRate（均可缺席降级）
// ============================================================
(function(global) {
    'use strict';

    var DEFAULT_MIN_DAMAGE = (global.rAthenaConfig && global.rAthenaConfig.skill_min_damage) || 6;

    function _rand100() { return Math.random() * 100; }

    // ---- 命中判定（80 + HIT − FLEE 钳 5~95；H3 hitRate 孔：加成百分点直加） ----
    function _rollHit(attackerStats, defenderStats, hooks) {
        var aHit = attackerStats.hit || 0;
        var dFlee = defenderStats.flee || 0;
        var rate;
        if (global.rAthena && global.rAthena.formulas && typeof global.rAthena.formulas.calcHitRate === 'function') {
            rate = global.rAthena.formulas.calcHitRate(aHit, dFlee);
        } else {
            rate = Math.max(5, Math.min(95, 80 + aHit - dFlee));
        }
        rate += (hooks && hooks.hitRate) || 0;                       // ★ H3
        return _rand100() < Math.max(0, Math.min(100, rate));
    }

    // ---- 暴击判定（逐段独立 roll） ----
    function _rollCritical(attackConfig) {
        if (attackConfig.forceCritical === true) return true;
        if (attackConfig.canCritical !== true) return false;
        var criRate = (typeof attackConfig.criRate === 'number') ? attackConfig.criRate : 0;
        return _rand100() < criRate;
    }

    // ---- 修饰符结算（种族/元素/体型 增伤与减免），从 rAthenaEngine.applyModifiers 提炼 ----
    // modifiers 为 attacker 面板上的映射表；race/element/size 已由调用方统一为字符串
    function applyStatModifiers(modifiers, defenderStats, baseDamage) {
        if (!modifiers || !baseDamage || baseDamage <= 0) return 0;
        var extra = 0;
        var raceKey = defenderStats.race || null;
        var elemKey = defenderStats.element || null;

        // 种族增伤（含复合键清理兼容）
        if (raceKey && modifiers.raceAddDamage) {
            var bonus = modifiers.raceAddDamage[raceKey] || 0;
            if (bonus === 0) {
                var cleaned = raceKey.replace(/[\s_]/g, '');
                for (var key in modifiers.raceAddDamage) {
                    if (key.replace(/[\s_]/g, '') === cleaned) { bonus = modifiers.raceAddDamage[key]; break; }
                }
            }
            if (bonus > 0) extra += Math.floor(baseDamage * bonus / 100);
        }
        // 属性增伤
        if (elemKey && modifiers.elementalAddDamage) {
            var eBonus = modifiers.elementalAddDamage[elemKey] || 0;
            if (eBonus > 0) extra += Math.floor(baseDamage * eBonus / 100);
        }
        // 种族减免（兼容旧键 raceDefense）
        if (raceKey) {
            var raceDefMap = modifiers.raceReduceDamage || modifiers.raceDefense || {};
            var rDef = raceDefMap[raceKey] || 0;
            if (rDef > 0) extra -= Math.floor(baseDamage * rDef / 100);
        }
        // 元素抗性减免（兼容 elementResistance）
        if (elemKey) {
            var elemResMap = modifiers.elementalReduceDamage || modifiers.elementResistance || {};
            var eDef = elemResMap[elemKey] || 0;
            if (eDef > 0) extra -= Math.floor(baseDamage * eDef / 100);
        }
        // 体型增伤
        if (modifiers.sizeAddDamage && defenderStats.size) {
            var sBonus = modifiers.sizeAddDamage[defenderStats.size] || 0;
            if (sBonus > 0) extra += Math.floor(baseDamage * sBonus / 100);
        }
        return extra;
    }

    // ============================================================
    //  原子函数：单段结算
    // ============================================================
    function calcSingleHit(attackerStats, defenderStats, attackConfig) {
        attackerStats = attackerStats || {};
        defenderStats = defenderStats || {};
        attackConfig = attackConfig || {};

        var cfg = {
            skillDamage: attackConfig.skillDamage || 0,                    // 技能倍率（%）
            attackElem: attackConfig.attackElem || 'Neutral',
            elemLevel: attackConfig.elemLevel || 1,
            weaponType: attackConfig.weaponType || 'Fist',
            isMagic: attackConfig.isMagic === true,
            criDamageBonus: attackConfig.criDamageBonus || 0,
            minDamage: (typeof attackConfig.minDamage === 'number') ? attackConfig.minDamage : DEFAULT_MIN_DAMAGE,
            hitIndex: attackConfig.hitIndex || 0,
            hooks: attackConfig.hooks || {},                               // ★ 加成插入点（BonusCollector 聚合产物）
        };

        var breakdown = {
            baseDamage: 0,
            sizeFixRatio: 100,
            defReduction: 0,
            elementFixRatio: 100,
            modifierExtra: 0,
        };

        // ---- 1. 命中判定 ----
        if (!_rollHit(attackerStats, defenderStats, cfg.hooks)) {
            return { damage: 0, isHit: false, isCritical: false, hitIndex: cfg.hitIndex, status: 'miss', breakdown: breakdown };
        }

        // ---- 2. 暴击判定（逐段独立） ----
        var isCritical = _rollCritical(attackConfig);
        // ★ H5 critMultiplier 孔：暴击倍率 = 1.4 + hooks.critMultiplier + criDamageBonus/100
        var critMult = 1.4 + (cfg.hooks.critMultiplier || 0) + cfg.criDamageBonus / 100;

        // ---- 3. 基础伤害（物理：武器/状态拆分 + 体型修正；魔法：MATK 直入） ----
        var baseDamage;
        if (cfg.isMagic) {
            baseDamage = (attackerStats.finalMATK || 0) * (cfg.skillDamage / 100);
            breakdown.baseDamage = Math.floor(baseDamage);
        } else {
            var equipATK = attackerStats.equipATK || 0;
            var statusATK = attackerStats.statusATK || 0;
            var totalBase = equipATK + statusATK;
            var weaponRatio = totalBase > 0 ? equipATK / totalBase : 0.6;
            var statusRatio = totalBase > 0 ? statusATK / totalBase : 0.4;

            var weaponPart = Math.floor((attackerStats.finalATK || 0) * weaponRatio);
            var statusPart = Math.floor((attackerStats.finalATK || 0) * statusRatio);

            if (global.SizeFixData) {
                var fixed = Math.floor(weaponPart * global.SizeFixData.getFix(cfg.weaponType, defenderStats.size || 'Medium',
                    global.rAthena && global.rAthena.engine ? global.rAthena.engine.IS_RENEWAL : true) / 100);
                // ★ H7 sizeModifier 孔：体型倍率修正（1 + Σvalue），作用于体型修正后的武器部分
                var sizeModFactor = 1 + (cfg.hooks.sizeModifier || 0);
                if (sizeModFactor !== 1) fixed = Math.floor(fixed * sizeModFactor);
                breakdown.sizeFixRatio = weaponPart > 0 ? (fixed / weaponPart * 100) : 100;
                weaponPart = fixed;
            }
            baseDamage = (weaponPart + statusPart) * (1 + cfg.skillDamage / 100);
            breakdown.baseDamage = Math.floor(weaponPart + statusPart);
        }

        // ---- 4. 防御减免（物理 def / 魔法 mdef） ----
        var defVal;
        if (cfg.isMagic) {
            defVal = (typeof defenderStats.mdef === 'number') ? defenderStats.mdef : 0;
        } else {
            defVal = (typeof defenderStats.def === 'number') ? defenderStats.def : 0;
        }
        var defReduction = defVal / (defVal + 100);
        breakdown.defReduction = defReduction;
        var perHitDamage = baseDamage * (1 - defReduction);
        if (perHitDamage < 1) perHitDamage = 1;

        // ---- 5. 暴击加成 ----
        if (isCritical) {
            perHitDamage = Math.floor(perHitDamage * critMult);
        }

        // ---- 6. 元素克制（防御侧元素；魔法/物理同表） ----
        var defenseElement = defenderStats.defenseElement || defenderStats.element || 'Neutral';
        var defenseElementLevel = defenderStats.defenseElementLevel || 1;
        if (global.ElementDB) {
            var afterElement = Math.max(0, Math.floor(perHitDamage
                * global.ElementDB.getModifier(cfg.attackElem, defenseElement, defenseElementLevel) / 100));
            breakdown.elementFixRatio = perHitDamage > 0 ? (afterElement / perHitDamage * 100) : 100;
            perHitDamage = afterElement;
        }

        // ---- 6.5 ★ H8 raceModifier 孔：种族倍率修正（1 + Σvalue，如不死系特攻） ----
        var raceModFactor = 1 + (cfg.hooks.raceModifier || 0);
        if (raceModFactor !== 1) {
            perHitDamage = Math.max(0, Math.floor(perHitDamage * raceModFactor));
        }

        // ---- 7. 修饰符（种族/元素/体型 增伤减免） ----
        var modifierExtra = applyStatModifiers(attackerStats.modifiers, defenderStats, perHitDamage);
        breakdown.modifierExtra = modifierExtra;

        perHitDamage = Math.max(cfg.minDamage, Math.floor(perHitDamage + modifierExtra));

        return {
            damage: perHitDamage,
            isHit: true,
            isCritical: isCritical,
            hitIndex: cfg.hitIndex,
            status: isCritical ? 'critical_hit' : 'hit',
            breakdown: breakdown,
        };
    }

    // ============================================================
    //  导出
    // ============================================================
    global.SingleHitCalculator = {
        calcSingleHit: calcSingleHit,
        applyStatModifiers: applyStatModifiers,
    };
    console.log('[SingleHitCalculator] ✅ 已加载（单段结算原子函数：物理/魔法双路径 + 逐段暴击）');
})(window);
