// ============================================================
//  FILE: SkillExecutor.js
//  LAYER: core（技能四层之三：执行器——伤害计算与资源操作）
//  权限：char:consumeSP（经 CharacterContext 走 AccessControl）
//  依赖：SkillGateway（合并技能数据）、SkillRuntime（GCD/冷却）、AttributeGateway、
//        InventoryRepository（装备活读）、ItemDataGateway、CharacterContext（SP 资源）、
//        rAthena.engine（伤害引擎）、SKILL_CONFIG、ConfigProfileManager
//  契约：
//    executeSkill(char, target, skillAegis, merged, atk, masteryBonus, timers) → 结果对象
//    doAttack(char, target, atk, masteryBonus) → 结果对象
//    extractTimers(skillAegis, level, char) → { castTime, fixedCastTime, cooldown, gcd, fixedRatio, totalCast, mergedData }
//    calculateActionTime(skillAegis, level, char) → { pre, post, total, finalGCD }
//    getEffectiveRange(skillAegis, level, char) → number|null（像素）
//  规则：CTX-1 —— SP 消耗经 CharacterContext；禁止直写 char
// ============================================================
(function(global) {
    'use strict';

    // ---- 全局配置（优先 SKILL_CONFIG，否则默认值；原 SkillScheduler 常量区移植） ----
    var CONFIG = global.SKILL_CONFIG || {
        DEFAULT_COOLDOWN: 2.0,
        DEFAULT_SP_COST: 5,
        DEFAULT_CAST_TIME: 0,
        DEFAULT_GCD: 0.3,
        MIN_SKILL_RATIO: 100,
        MAX_SKILL_RATIO: 5000,
        PIXELS_PER_CELL: RO_CONSTANTS.DEFAULT_ATTACK_RANGE,
        DEFAULT_SKILL_RANGE: RO_CONSTANTS.DEFAULT_ATTACK_RANGE,
        DEFAULT_WEAPON_RANGE: RO_CONSTANTS.DEFAULT_ATTACK_RANGE,
        CAN_BE_INTERRUPTED_BY_DAMAGE: true,
        DEFAULT_CAST_PROTECTION_RATE: 0.2,
        INDEPENDENT_COOLDOWN: true,
    };

    var BATTLE_DEFAULTS = {
        attackPreRatio: 0.5,
        attackPostRatio: 0.5,
        defaultGcd: 0.3,
    };

    var ACTION_DEFAULTS = {
        basePre: 0.10,
        basePost: 0.15,
        weightFactor: 0.002,
        agiReduction: 0.0008,
        levelPreReduction: 0.001,
        aspdReduction: 0.12,
        spCostFactor: 0.0015,
        powerFactor: 0.0003,
        dexReduction: 0.0008,
        levelPostReduction: 0.001,
        maxInterval: 2.0,
        minPre: 0.05,
        maxPre: 0.40,
        minPost: 0.05,
        maxPost: 0.80,
        minTotal: 0.10,
        maxTotal: 1.20,
    };

    function _getProfileSection(sectionName, defaults) {
        var result = {};
        for (var key in defaults) result[key] = defaults[key];
        if (!global.ConfigProfileManager) return result;
        var profile = global.ConfigProfileManager.getCurrentProfile();
        if (!profile || !profile.char || !profile.char[sectionName]) return result;
        var section = profile.char[sectionName];
        for (var key2 in defaults) {
            if (section[key2] !== undefined) result[key2] = section[key2];
        }
        return result;
    }

    function _getBattleConfig() { return _getProfileSection('battle', BATTLE_DEFAULTS); }
    function _getSkillActionConfig() { return _getProfileSection('skillAction', ACTION_DEFAULTS); }

    // ---- 武器重量（装备活读 + 物品网关） ----
    function _getWeaponWeight() {
        try {
            if (!global.InventoryRepository) return 0;
            var equipped = global.InventoryRepository.getEquipped();
            if (!equipped || !equipped.weapon) return 0;
            var def = global.ItemDataGateway ? global.ItemDataGateway.getById(equipped.weapon.templateId) : null;
            return (def && typeof def.Weight === 'number') ? def.Weight : 0;
        } catch (_) {
            return 0;
        }
    }

    function _getWeaponInfo() {
        var weaponType = 'Fist';
        try {
            if (global.InventoryRepository) {
                var equipped = global.InventoryRepository.getEquipped();
                if (equipped && equipped.weapon) {
                    var def = global.ItemDataGateway ? global.ItemDataGateway.getById(equipped.weapon.templateId) : null;
                    if (def && def.SubType) weaponType = def.SubType;
                }
            }
        } catch (_) {}
        return weaponType;
    }

    // ============================================================
    //  动作时间计算（原 _calculateActionTime；属性经 AttributeGateway）
    // ============================================================
    function calculateActionTime(skillAegis, skillLevel, char) {
        var cfg = _getSkillActionConfig();
        var stats = global.AttributeGateway ? (global.AttributeGateway.getAll('SkillExecutor') || {}) : {};
        var agi = stats.agi || 1;
        var dex = stats.dex || 1;
        var attackInterval = stats.attackInterval || 1.0;
        var weaponWeight = _getWeaponWeight();

        var merged = global.SkillGateway.getMergedSkillData(skillAegis, skillLevel);
        var spCost = (merged && merged.spCost) || CONFIG.DEFAULT_SP_COST;
        var ratio = (merged && merged._cachedRatio) || 100;
        ratio = Math.max(CONFIG.MIN_SKILL_RATIO, Math.min(CONFIG.MAX_SKILL_RATIO, ratio));

        var pre = cfg.basePre
            + (cfg.weightFactor * weaponWeight / 100)
            - (cfg.agiReduction * agi)
            - (cfg.levelPreReduction * (skillLevel - 1))
            - (cfg.aspdReduction * (1 - Math.min(attackInterval / cfg.maxInterval, 1)));
        pre = Math.max(cfg.minPre, Math.min(cfg.maxPre, pre));

        var post = cfg.basePost
            + (cfg.spCostFactor * spCost)
            + (cfg.powerFactor * (ratio / 100))
            - (cfg.dexReduction * dex)
            - (cfg.levelPostReduction * (skillLevel - 1));
        post = Math.max(cfg.minPost, Math.min(cfg.maxPost, post));

        var total = Math.max(cfg.minTotal, Math.min(cfg.maxTotal, pre + post));
        var officialGCD = (merged && merged.AfterCastActDelay) || 0;
        var finalGCD = Math.max(total, officialGCD);

        return { pre: pre, post: post, total: total, finalGCD: finalGCD };
    }

    // ============================================================
    //  咏唱/冷却定时器提取（原 _extractTimers；咏唱缩减经 AttributeGateway）
    // ============================================================
    function extractTimers(skillAegis, skillLevel, char) {
        var merged = global.SkillGateway.getMergedSkillData(skillAegis, skillLevel);
        var castTime = (merged && merged.CastTime) || 0;
        var fixedCastTime = (merged && merged.FixedCastTime) || 0;
        var cooldown = (merged && merged.Cooldown) || 0;
        var gcd = (merged && merged.AfterCastActDelay) || 0;

        var castReduction = global.AttributeGateway
            ? global.AttributeGateway.getCastReduction('SkillExecutor')
            : 0;
        castTime = Math.max(0, castTime * (1 - castReduction));

        var totalCast = fixedCastTime + castTime;
        return {
            castTime: castTime,
            fixedCastTime: fixedCastTime,
            cooldown: cooldown,
            gcd: gcd,
            fixedRatio: totalCast > 0 ? fixedCastTime / totalCast : 0,
            totalCast: totalCast,
            mergedData: merged,
        };
    }

    // ============================================================
    //  技能执行（原 _executeSkill；SP 经 CharacterContext）
    // ============================================================
    // ============================================================
    //  有效段数解析（条件系统接入点）
    //  skillData.hitCountWhen: [{ condition: {...}, hitCount: N }, ...]
    //  条件匹配即覆盖基础 HitCount（配置驱动，禁止硬编码武器/技能名进本文件）
    // ============================================================
    function _resolveEffectiveHitCount(skillData, ctx) {
        var base = (skillData && skillData.HitCount) || 1;
        if (!skillData || !Array.isArray(skillData.hitCountWhen) || skillData.hitCountWhen.length === 0) {
            return base;
        }
        if (!global.SkillConditionSystem || typeof global.SkillConditionSystem.evaluate !== 'function') {
            return base;
        }
        for (var i = 0; i < skillData.hitCountWhen.length; i++) {
            var rule = skillData.hitCountWhen[i];
            if (rule && typeof rule.hitCount === 'number'
                && global.SkillConditionSystem.evaluate(rule.condition, ctx)) {
                return rule.hitCount;
            }
        }
        return base;
    }

function executeSkill(char, target, skillAegis, skillData, atk, masteryBonus, timers) {
    // ---- 技能名规范化（兼容大小写/下划线差异，如 mo_tripleattack → MO_TRIPLEATTACK） ----
    if (global.SkillGateway && typeof global.SkillGateway.resolveAegis === 'function') {
        var canonical = global.SkillGateway.resolveAegis(skillAegis);
        if (canonical) skillAegis = canonical;
    }
    var skillLevel = (char.learnedSkills && char.learnedSkills[skillAegis]) || 1;
    var stats = global.AttributeGateway ? (global.AttributeGateway.getAll('SkillExecutor') || {}) : {};
    var effectiveAtk = (skillData && skillData.Type === 'Magic') ? (stats.finalMATK || atk) : atk;

    var ratio = skillData._cachedRatio || 100;
    if (!skillData._cachedRatio && skillData.clean_ratio && skillData.clean_ratio.type === 'linear') {
        ratio = skillData.clean_ratio.base + skillData.clean_ratio.per_level * skillLevel;
    }
    ratio = Math.max(CONFIG.MIN_SKILL_RATIO, Math.min(CONFIG.MAX_SKILL_RATIO, ratio));

    var spCost = skillData.spCost || CONFIG.DEFAULT_SP_COST;

    // ---- 有效段数解析（基础 HitCount + 条件系统 hitCountWhen 覆盖） ----
    var weaponType = _getWeaponInfo();
    var hitCount = _resolveEffectiveHitCount(skillData, {
        skillLevel: skillLevel, char: char, target: target, weaponType: weaponType,
    });
    var hitType = skillData.Hit || 'Single';

    var patch = (global.SKILL_PATCHES && global.SKILL_PATCHES[skillAegis]) || null;
    var mechanism = patch ? (patch.mechanism || null) : null;
    var isUltimate = (mechanism === 'ultimate');

    if (mechanism === 'zeny_cost' && patch.zenyCostPerLevel > 0) {
        var zenyNeed = patch.zenyCostPerLevel * skillLevel;
        var curZeny = char.zeny || 0;
        if (curZeny < zenyNeed) {
            return { action: 'wait', reason: 'no_zeny', needed: zenyNeed, current: curZeny };
        }
    }
    if (isUltimate) {
        spCost = Math.max(1, (char.sp || 1) - 1);
    }

    var attackElem = stats.attackElement || 'Neutral';
    // 技能自带元素优先（如 MG_COLDBOLT=Water / MG_FIREBOLT=Fire；'Weapon' 表示跟随武器元素）
    if (skillData.Element && skillData.Element !== 'Weapon') {
        attackElem = skillData.Element;
    }
    var elemLevel = stats.attackElementLevel || 1;

    // ============================================================
    // ★ 技能暴击：改为"逐段独立判定"参数（canCritical + criRate），
    //   由引擎在每段结算时各自 roll（原为技能级一次判定、全段共享）
    // ============================================================
    var canCritical = !!(skillData.DamageFlags && skillData.DamageFlags.Critical === true);
    var criDamageBonus = stats.criDamage || 0;
    var criRate = canCritical ? (stats.cri || 0) : 0;
    var isCritical = false;   // 引擎逐段结算后回填：任一段暴击即 true

    // ---- NoDamage 语义 ----
    var isNoDamage = !!(skillData.DamageFlags && skillData.DamageFlags.NoDamage);
    var finalDamage = 0;
    var hitResults = null;
    var isSupport = false;
    var healAmount = 0;

    if (isNoDamage) {
        var mechHandled = false;
        if (patch && mechanism === 'taunt' && target && global.MonsterAI && typeof global.MonsterAI.markAggro === 'function') {
            global.MonsterAI.markAggro(target, (patch.tauntMs || 10000) / 1000);
            mechHandled = true;
            isSupport = true;
        } else if (patch && mechanism === 'endure') {
            global.SkillRuntime.setEndure(patch.endureMs || 10000);
            mechHandled = true;
            isSupport = true;
        } else if (patch && mechanism === 'ground' && patch.ground && global.GroundEffectManager) {
            global.GroundEffectManager.spawn({
                skillAegis: skillAegis,
                x: target ? target.x : 400,
                y: target ? target.y : 300,
                radiusCells: patch.ground.radiusCells || 1,
                durationMs: patch.ground.durationMs || 10000,
                tickMs: patch.ground.tickMs || 1000,
                damageRatioPerTick: patch.ground.damageRatioPerTick || 0,
                healPercentPerTick: patch.ground.healPercentPerTick || 0,
                element: patch.ground.element || 'Neutral',
            });
            mechHandled = true;
            isSupport = true;
        }
        if (!mechHandled) {
            isSupport = true;
            var maxHP = stats.finalMaxHP || 100;
            var healPercent = (typeof skillData.healPercent === 'number') ? skillData.healPercent
                : (patch && typeof patch.healPercent === 'number') ? patch.healPercent : 0.2;
            healAmount = Math.floor(maxHP * healPercent);
            if (healAmount > 0 && global.CharacterContext) {
                global.CharacterContext.restoreResource('hp', healAmount, 'SkillExecutor');
            }
        }
    } else if (patch && mechanism === 'true_damage') {
        finalDamage = Math.floor(effectiveAtk * ratio / 100) * (hitCount || 1) + (masteryBonus || 0);
    } else if (!global.rAthena || !global.rAthena.engine) {
        var baseDmg = Math.floor(effectiveAtk * ratio / 100);
        var defVal = target.def || 0;
        var reduction = defVal / (defVal + 100);
        finalDamage = Math.max(1, Math.floor(baseDmg * (1 - reduction))) + (masteryBonus || 0);
    } else {
        // ★ 逐段结算：命中与暴击均由引擎按段独立判定
        var result = global.rAthena.engine.calculateDamage(char, target, effectiveAtk, {
            weaponType: weaponType,
            attackElem: attackElem,
            elemLevel: elemLevel,
            skillDamage: ratio,
            hitCount: hitCount,
            hitType: hitType,
            canCritical: canCritical,      // ★ 技能声明可暴击时，每段独立 roll
            criRate: criRate,              // ★ 暴击率 = 面板 CRI
            criDamageBonus: criDamageBonus,
            isMagic: (skillData && skillData.Type === 'Magic')
        });
        finalDamage = result.damage + (masteryBonus || 0);
        hitResults = (result.details && result.details.hitResults) ? result.details.hitResults : null;
        isCritical = result.isCritical === true;   // 任一段暴击即标记（兼容旧消费方）
    }

    var statusName = (patch && patch.status) ? patch.status : (skillData.Status || null);
    var statusChance = null;
    if (statusName) {
        statusChance = (patch && typeof patch.statusChance === 'number') ? patch.statusChance
            : ((typeof skillData.statusChance === 'number') ? skillData.statusChance
                : Math.min(0.6, 0.15 + 0.05 * (skillLevel - 1)));
    }

    if (!global.CharacterContext || typeof global.CharacterContext.consumeSP !== 'function') {
        return { action: 'wait', reason: 'character_context_unavailable' };
    }
    var spBefore = char.sp || 0;
    if (!global.CharacterContext.consumeSP(spCost, 'SkillExecutor')) {
        return { action: 'wait', reason: 'insufficient_sp' };
    }
    var freshChar = global.CharRepository ? global.CharRepository.getLiveRef() : char;
    char = freshChar;
    var spConsumed = Math.max(0, spBefore - (char.sp || 0));

    if (mechanism === 'zeny_cost' && patch.zenyCostPerLevel > 0 && global.CharacterContext) {
        global.CharacterContext.deductZeny(patch.zenyCostPerLevel * skillLevel, 'SkillExecutor');
    }

    if (isUltimate && patch) {
        finalDamage += spConsumed * (patch.spDamageFactor || 10);
    }

    if (mechanism === 'sp_drain' && finalDamage > 0 && global.CharacterContext) {
        var spRestore = Math.floor(finalDamage * (patch.spDrainPercent || 0.5));
        if (spRestore > 0) {
            global.CharacterContext.restoreResource('sp', spRestore, 'SkillExecutor');
        }
    }

    // ---- lastSkill 写入权归 SkillScheduler（唯一写入点）----
    // executor 只读不写：Scheduler 在 executeSkill 成功返回后统一 setLastSkill(skillAegis)。
    // 历史上这里写 `patch.comboNext ? skillAegis : null`，与 Scheduler 的无条件写语义分叉，已移除。

    var actionTime = calculateActionTime(skillAegis, skillLevel, char);
    var battleCfg = _getBattleConfig();
    var gcd = Math.max(actionTime.finalGCD, battleCfg.defaultGcd || 0.3);
    global.SkillRuntime.startGCD(gcd);

    var cooldown = timers ? (timers.cooldown || 0) : 0;
    if (cooldown > 0) global.SkillRuntime.startCooldown(skillAegis, cooldown);

    // ★ 返回结果中携带 isCritical ★
    return {
        action: 'skill',
        damage: finalDamage,
        isSupport: isSupport,
        healAmount: healAmount,
        status: statusName,
        statusChance: statusChance,
        skillAegis: skillAegis,
        skillLevel: skillLevel,
        ratio: ratio,
        spCost: spCost,
        cooldown: cooldown,
        gcd: gcd,
        isSkill: true,
        isCritical: isCritical,           // ★ 新增
        canCritical: canCritical,         // ★ 新增
        mechanism: mechanism,
        actionTime: { pre: actionTime.pre, post: actionTime.post, total: actionTime.total },
        hitCount: hitCount,
        hitType: hitType,
        hitResults: hitResults,
        isMagic: !!(skillData && skillData.Type === 'Magic'),
        criRate: criRate,
        isSplash: !!(skillData._splashArea > 0 && skillData.DamageFlags.Splash !== false),
        splashArea: skillData._splashArea || 0,
        splashSplit: !!(skillData.DamageFlags.SplashSplit === true),
        skillRatio: ratio,
        effectiveAtk: effectiveAtk,
        weaponType: weaponType,
        attackElem: attackElem,
        elemLevel: elemLevel,
    };
}

    // ============================================================
    //  普攻（原 _doAttack）
    // ============================================================
    function doAttack(char, target, atk, masteryBonus) {
        if (!global.rAthena || !global.rAthena.engine) {
            var def = target.def || 0;
            var reduction = def / (def + 100);
            var dmg = Math.max(1, Math.floor(atk * (1 - reduction))) + (masteryBonus || 0);
            return { action: 'attack', damage: dmg, isSkill: false };
        }

        var stats = global.AttributeGateway ? (global.AttributeGateway.getAll('SkillExecutor') || {}) : {};
        var weaponType = _getWeaponInfo();
        var attackElem = stats.attackElement || 'Neutral';
        var elemLevel = stats.attackElementLevel || 1;

        var result = global.rAthena.engine.calculateDamage(char, target, atk, {
            weaponType: weaponType,
            attackElem: attackElem,
            elemLevel: elemLevel,
            skillDamage: 0,
            hitCount: 1,
            hitType: 'Single',
        });
        var finalDamage = result.damage + (masteryBonus || 0);
        return { action: 'attack', damage: finalDamage, isSkill: false };
    }

    // ============================================================
    //  射程计算（原 _getEffectiveRange；格数→像素经 AttributeNormalizer）
    // ============================================================
function getEffectiveRange(skillAegis, skillLevel, char) {
    if (!char) return null;
    skillLevel = skillLevel || 1;
    var skillInfo = global.SkillGateway.getMergedSkillData(skillAegis, skillLevel);
    if (!skillInfo) return CONFIG.DEFAULT_SKILL_RANGE;
    var rawRange = skillInfo.Range;
    var rangeType = skillInfo.RangeType;

    if (rawRange === -1) {
        rangeType = 'weapon';
        rawRange = 1;
    }

    var weaponRange = global.AttributeGateway
        ? global.AttributeGateway.getAttackRange('SkillExecutor')
        : CONFIG.DEFAULT_WEAPON_RANGE;

    var range; // 最终像素值
    if (rangeType === 'weapon') {
        range = weaponRange;
    } else if (rangeType === 'melee') {
        range = global.AttributeNormalizer
            ? global.AttributeNormalizer.cellToPixel(1)
            : 1 * CONFIG.PIXELS_PER_CELL;
    } else if (typeof rawRange === 'number' && rawRange > 0) {
        range = global.AttributeNormalizer
            ? global.AttributeNormalizer.cellToPixel(rawRange)
            : rawRange * CONFIG.PIXELS_PER_CELL;
    } else {
        range = CONFIG.DEFAULT_SKILL_RANGE;
    }

    // ========== ★ 新增：应用射程倍率 ★ ==========
    var profile = global.ConfigProfileManager ? global.ConfigProfileManager.getCurrentProfile() : null;
    var castMult = (profile && profile.char && profile.char.battle && profile.char.battle.skillCastRangeMultiplier) || 1.0;
    return Math.floor(range * castMult);
}


    var SkillExecutor = {
        executeSkill: executeSkill,
        doAttack: doAttack,
        extractTimers: extractTimers,
        calculateActionTime: calculateActionTime,
        getEffectiveRange: getEffectiveRange,
        getBattleConfig: _getBattleConfig,
        getSkillActionConfig: _getSkillActionConfig,
        CONFIG: CONFIG,
    };

    global.SkillExecutor = SkillExecutor;
    console.log('[SkillExecutor] ✅ 已加载（技能执行器：引擎计算 + Context 资源）');
})(window);
