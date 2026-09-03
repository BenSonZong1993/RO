// ============================================================
//  FILE: SkillScheduler.js
//  LAYER: battle（技能四层之四：门面——战斗系统唯一技能入口）
//  权限：无（执行动作经 SkillExecutor → CharacterContext 过闸）
//  依赖：SkillRuntime（状态机）、SkillStrategy（决策）、SkillExecutor（执行）、
//        SkillGateway（数据）、CharRepository（活引用）、EventBus、BattleController（目标查找）
//  契约（v4.0 瘦身后对外接口不变，内部全部委托）：
//    update(delta) / tryAction(char, target, atk, masteryBonus) / castSkill(...) /
//    canCast / getNextSkill / interruptCast / getGCD / getCooldown / getCasting /
//    getCastingInfo / isSilenced / isCasting / isGCD / setSilenced / setAttackInterval /
//    reset / clearCombatState / getSkillData / getRequiredRange / getGCDTotal /
//    getAttackTimeConfig / setAttackTimeConfig / getSkillActionConfig / setSkillActionConfig /
//    calculateActionTime / updateSkillConfig / getSkillConfig / _getMergedSkillData
//  规则：计时/冷却/策略/执行逻辑已全部剥离至 Runtime/Strategy/Executor（蓝图 3.2）
// ============================================================
(function(global) {
    'use strict';

    var _attackInterval = 0.5;

    // ============================================================
    //  内部：施法状态检查（业务判断留在门面：读 char.sc 状态）
    // ============================================================
    function _hasBlockingStatus(char) {
        if (!char || !char.sc || typeof char.sc.hasSCE !== 'function') return false;
        var sc = char.sc;
        return sc.hasSCE(SC_CONSTANTS.Silence) ||
            sc.hasSCE(SC_CONSTANTS.Stun) ||
            sc.hasSCE(SC_CONSTANTS.Freeze) ||
            sc.hasSCE(SC_CONSTANTS.Stone) ||
            sc.hasSCE(SC_CONSTANTS.Sleep) ||
            sc.hasSCE(SC_CONSTANTS.Deepsleep) ||
            sc.hasSCE(SC_CONSTANTS.Whiteimprison);
    }

    // ============================================================
    //  更新循环（委托 Runtime）
    // ============================================================
    function update(delta) {
        global.SkillRuntime.update(delta);
    }

    function setAttackInterval(interval) {
        _attackInterval = Math.max(0.1, interval);
    }

    // ============================================================
    //  可释放检查
    // ============================================================
    function canCast(skillAegis, char) {
        if (!char) return false;
        if (_hasBlockingStatus(char)) return false;
        if (global.SkillRuntime.isSilenced()) return false;
        if (global.SkillRuntime.getGCD() > 0) return false;

        var patches = global.SKILL_PATCHES || {};
        var patch = patches[skillAegis];
        // 连招前置检查：只需比较 lastSkill
        if (patch && patch.requiresComboFrom) {
            var lastSkill = global.SkillRuntime.getLastSkill();
            if (lastSkill !== patch.requiresComboFrom) {
                return false;
            }
        }

        var level = (char.learnedSkills && char.learnedSkills[skillAegis]) || 0;
        if (level <= 0) return false;

        var merged = global.SkillGateway.getMergedSkillData(skillAegis, level);
        var spCost = (merged && merged.spCost) || (global.SKILL_CONFIG && global.SKILL_CONFIG.DEFAULT_SP_COST) || 5;
        if ((char.sp || 0) < spCost) return false;

        if (global.SkillRuntime.isOnCooldown(skillAegis)) return false;
        return true;
    }

    // ============================================================
    //  下一个技能（委托 Strategy）
    // ============================================================
    function getNextSkill(char) {
        return global.SkillStrategy.getNextSkill(char, canCast);
    }

    // ============================================================
    //  施法完成后的目标重选（战斗编排，留在门面）
    // ============================================================
    function _findTarget(char, pos) {
        if (!char || !pos) return null;
        if (!global.BattleController) return null;
        var monsters = global.BattleController.getMonsters();
        var alive = monsters.filter(function(m) { return m.alive && m.visible; });
        if (alive.length === 0) return null;

        var best = null;
        var bestDist = Infinity;
        for (var i = 0; i < alive.length; i++) {
            var mon = alive[i];
            var dx = mon.x - pos.x;
            var dy = mon.y - pos.y;
            var dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < bestDist) {
                bestDist = dist;
                best = mon;
            }
        }
        return best;
    }

    // ============================================================
    //  自动动作入口（编排：Runtime 状态 + Strategy 决策 + Executor 执行）
    // ============================================================
    function tryAction(char, target, atk, masteryBonus) {
        var runtime = global.SkillRuntime;
        var executor = global.SkillExecutor;
        var modifierEngine = global.NormalAttackModifierEngine;

        if (!char || !target) return { action: 'wait', reason: 'invalid_target' };
        if (runtime.isSilenced()) return { action: 'wait', reason: 'silenced' };
        var gcd = runtime.getGCD();
        if (gcd > 0) return { action: 'wait', reason: 'gcd', remaining: gcd };

        // ---- 咏唱完成 ----
        var casting = runtime.getCasting();
        if (casting) {
            if (casting.progress >= casting.total) {
                var skAegis = casting.skillAegis;
                var skLevel = (char.learnedSkills && char.learnedSkills[skAegis]) || 1;
                var timers = executor.extractTimers(skAegis, skLevel, char);
                var merged = timers.mergedData;

                var newTarget = _findTarget(char, { x: casting.targetX, y: casting.targetY });
                runtime.completeCasting();
                if (!newTarget) {
                    return { action: 'wait', reason: 'no_target' };
                }
                var result = executor.executeSkill(char, newTarget, skAegis, merged, atk, masteryBonus, timers);
                if (result.action !== 'wait') {
                    runtime.setLastSkill(skAegis);
                }
                return result;
            }
            return {
                action: 'wait',
                reason: 'casting',
                skillAegis: casting.skillAegis,
                progress: casting.progress,
                total: casting.total,
            };
        }

        // ---- 计算普攻基础伤害 ----
        var baseAttack = (atk !== undefined && atk !== null) ? atk : 0;
        var mastery = (masteryBonus !== undefined) ? masteryBonus : 0;
        var baseDamage = Math.floor(baseAttack + mastery);
        var baseHits = [{ damage: baseDamage, canCrit: true, type: 'normal' }];

        // ---- 调用修饰引擎，检查是否触发技能 ----
        var weaponType = char._finalStats ? char._finalStats.weaponType : 'Dagger';
        var modifierResult = modifierEngine.process(char, weaponType, target, baseHits);

        // ---- ★ 检查是否处于连招中（lastSkill 有 comboNext） ----
        var lastSkill = runtime.getLastSkill();
        var isInCombo = false;
        if (lastSkill) {
            var lastPatch = global.SKILL_PATCHES && global.SKILL_PATCHES[lastSkill];
            if (lastPatch && (lastPatch.comboNext || (lastPatch.onNormalAttack && lastPatch.onNormalAttack.comboNext))) {
                isInCombo = true;
            }
        }

        // ---- ★ 如果处于连招中，跳过普攻触发技能检测 ----
        var triggerInfo = null;
        if (!isInCombo && modifierResult.triggeredSkills && modifierResult.triggeredSkills.length > 0) {
            triggerInfo = modifierResult.triggeredSkills[0];
        }

        // ---- 如果触发了技能（优先级最高） ----
        if (triggerInfo) {
            var skillAegis = triggerInfo.skillAegis;
            var level = (char.learnedSkills && char.learnedSkills[skillAegis]) || 0;
            if (level <= 0) {
                return executor.doAttack(char, target, atk, masteryBonus);
            }

            var timers = executor.extractTimers(skillAegis, level, char);
            var merged = timers.mergedData;
            var spCost = (merged && merged.spCost) || (global.SKILL_CONFIG && global.SKILL_CONFIG.DEFAULT_SP_COST) || 5;
            if ((char.sp || 0) < spCost) {
                return executor.doAttack(char, target, atk, masteryBonus);
            }
            if (runtime.isOnCooldown(skillAegis)) {
                return executor.doAttack(char, target, atk, masteryBonus);
            }
            var result = executor.executeSkill(char, target, skillAegis, merged, atk, masteryBonus, timers);
            if (result.action !== 'wait') {
                runtime.setLastSkill(skillAegis);
            }
            return result;
        }

        // ---- 没有触发技能，按原逻辑尝试自动技能列表 ----
        var skillAegis = getNextSkill(char);
        if (skillAegis) {
            var level = (char.learnedSkills && char.learnedSkills[skillAegis]) || 0;
            if (level <= 0) return executor.doAttack(char, target, atk, masteryBonus);
            var timers2 = executor.extractTimers(skillAegis, level, char);
            var merged2 = timers2.mergedData;
            if (timers2.totalCast > 0) {
                runtime.startCasting({
                    skillAegis: skillAegis,
                    total: timers2.totalCast,
                    fixedRatio: timers2.fixedRatio,
                    targetX: target.x,
                    targetY: target.y,
                    targetId: target.id,
                });
                return {
                    action: 'wait',
                    reason: 'casting_started',
                    skillAegis: skillAegis,
                    castTime: timers2.totalCast,
                };
            }
            var result = executor.executeSkill(char, target, skillAegis, merged2, atk, masteryBonus, timers2);
            if (result.action !== 'wait') {
                runtime.setLastSkill(skillAegis);
            }
            return result;
        }

        // ---- 无可用技能 → 普攻 ----
        if (modifierResult.hitResults && modifierResult.hitResults.length > 0) {
            return {
                action: 'attack',
                hitResults: modifierResult.hitResults,
                totalDamage: modifierResult.totalDamage,
            };
        } else {
            return executor.doAttack(char, target, atk, masteryBonus);
        }
    }
    
    // ============================================================
    //  外部直接释放技能
    // ============================================================
    function castSkill(char, target, skillAegis, atk, masteryBonus) {
        var runtime = global.SkillRuntime;
        var executor = global.SkillExecutor;

        if (!char || !target) return { action: 'wait', reason: 'invalid_target' };
        if (runtime.isSilenced()) return { action: 'wait', reason: 'silenced' };
        var gcd = runtime.getGCD();
        if (gcd > 0) return { action: 'wait', reason: 'gcd', remaining: gcd };

        var level = (char.learnedSkills && char.learnedSkills[skillAegis]) || 0;
        if (level <= 0) return { action: 'wait', reason: 'not_learned' };

        var timers = executor.extractTimers(skillAegis, level, char);
        var merged = timers.mergedData;
        var spCost = (merged && merged.spCost) || (global.SKILL_CONFIG && global.SKILL_CONFIG.DEFAULT_SP_COST) || 5;
        if ((char.sp || 0) < spCost) {
            return { action: 'wait', reason: 'sp', needed: spCost, current: char.sp };
        }
        if (runtime.isOnCooldown(skillAegis)) {
            return { action: 'wait', reason: 'cooldown', remaining: runtime.getCooldown(skillAegis) };
        }

        if (timers.totalCast > 0) {
            runtime.startCasting({
                skillAegis: skillAegis,
                total: timers.totalCast,
                fixedRatio: timers.fixedRatio,
                targetX: target.x,
                targetY: target.y,
                targetId: target.id,
            });
            return {
                action: 'wait',
                reason: 'casting_started',
                skillAegis: skillAegis,
                castTime: timers.totalCast,
            };
        }
        var result = executor.executeSkill(char, target, skillAegis, merged, atk, masteryBonus, timers);
        if (result.action !== 'wait') {
            runtime.setLastSkill(skillAegis, target.id);
        }
        return result;
    }
    
    // ============================================================
    //  控制接口（委托 Runtime）
    // ============================================================
    function interruptCast() { return global.SkillRuntime.interruptCast(); }
    function getCastingInfo() { return global.SkillRuntime.getCastingInfo(); }
    function getGCD() { return global.SkillRuntime.getGCD(); }
    function getGCDTotal() { return global.SkillRuntime.getGCDTotal(); }  // ★ 修复：委托 getGCDTotal，而非 getGCD
    function getCooldown(skillAegis) { return global.SkillRuntime.getCooldown(skillAegis); }
    function getCasting() { return global.SkillRuntime.getCasting(); }
    function isSilenced() { return global.SkillRuntime.isSilenced(); }
    function isCasting() { return global.SkillRuntime.isCasting(); }
    function isGCD() { return global.SkillRuntime.getGCD() > 0; }
    function setSilenced(silenced) { global.SkillRuntime.setSilenced(silenced); }
    function clearCombatState() { global.SkillRuntime.clearCombatState(); }

    function reset() {
        global.SkillRuntime.clearCombatState();
        global.SkillStrategy.resetRotation();
        global.SkillGateway.clearMergedCache();
    }

    // ============================================================
    //  射程计算
    // ============================================================
    function getRequiredRange(char, target) {
        if (!char) return (global.SKILL_CONFIG && global.SKILL_CONFIG.DEFAULT_SKILL_RANGE) || RO_CONSTANTS.DEFAULT_ATTACK_RANGE;
        var casting = global.SkillRuntime.getCasting();
        if (casting) {
            var range = global.SkillExecutor.getEffectiveRange(casting.skillAegis, 1, char);
            if (range !== null) return range;
        }
        var nextSkill = getNextSkill(char);
        if (nextSkill) {
            var level = (char.learnedSkills && char.learnedSkills[nextSkill]) || 1;
            var range2 = global.SkillExecutor.getEffectiveRange(nextSkill, level, char);
            if (range2 !== null) return range2;
        }
        var weaponRange = global.AttributeGateway
            ? global.AttributeGateway.getAttackRange('SkillScheduler')
            : ((global.SKILL_CONFIG && global.SKILL_CONFIG.DEFAULT_SKILL_RANGE) || RO_CONSTANTS.DEFAULT_ATTACK_RANGE);
        return weaponRange;
    }

    // ============================================================
    //  配置查询/写入（配表驱动；写入走 ConfigProfileManager）
    // ============================================================
    function getAttackTimeConfig() { return global.SkillExecutor.getBattleConfig(); }
    function setAttackTimeConfig(newConfig) {
        if (!global.ConfigProfileManager) return false;
        var profile = global.ConfigProfileManager.getCurrentProfile();
        if (!profile || !profile.char) return false;
        if (!profile.char.battle) profile.char.battle = {};
        for (var key in newConfig) {
            if (newConfig.hasOwnProperty(key)) profile.char.battle[key] = newConfig[key];
        }
        return true;
    }
    function getSkillActionConfig() { return global.SkillExecutor.getSkillActionConfig(); }
    function setSkillActionConfig(newConfig) {
        if (!global.ConfigProfileManager) return false;
        var profile = global.ConfigProfileManager.getCurrentProfile();
        if (!profile || !profile.char) return false;
        if (!profile.char.skillAction) profile.char.skillAction = {};
        for (var key in newConfig) {
            if (newConfig.hasOwnProperty(key)) profile.char.skillAction[key] = newConfig[key];
        }
        return true;
    }

    function getSkillData(skillAegis) {
        var merged = global.SkillGateway.getMergedSkillData(skillAegis, 1);
        return {
            aegisName: skillAegis,
            displayName: (merged && merged.Name) || skillAegis,
            maxLevel: (merged && merged.MaxLevel) || 10,
            clean_ratio: merged ? merged.clean_ratio : undefined,
            spCost: (merged && merged.spCost) || (global.SKILL_CONFIG && global.SKILL_CONFIG.DEFAULT_SP_COST) || 5,
            _raw: merged ? merged._raw : null,
        };
    }

    // ============================================================
    //  事件绑定（配置同步 + 战斗状态联动）
    // ============================================================
    function _init() {
        if (global.EventBus) {
            global.EventBus.on('char:changed', function() {
                var char = global.CharRepository ? global.CharRepository.getLiveRef() : null;
                if (char) global.SkillStrategy.loadFromChar(char);
            });
            global.EventBus.on('battle:stopped', function() {
                global.SkillRuntime.clearCombatState();
                global.SkillStrategy.markRotationReset();
            });
            global.EventBus.on('battle:started', function() {
                global.SkillStrategy.resetRotation();
            });
        }
        var char = global.CharRepository ? global.CharRepository.getLiveRef() : null;
        if (char) global.SkillStrategy.loadFromChar(char);
    }

    global.SkillScheduler = {
        update: update,
        setAttackInterval: setAttackInterval,
        canCast: canCast,
        getNextSkill: getNextSkill,
        tryAction: tryAction,
        castSkill: castSkill,
        interruptCast: interruptCast,
        getGCD: getGCD,
        getCooldown: getCooldown,
        getCasting: getCasting,
        getCastingInfo: getCastingInfo,
        isSilenced: isSilenced,
        isCasting: isCasting,
        isGCD: isGCD,
        setSilenced: setSilenced,
        reset: reset,
        clearCombatState: clearCombatState,
        getSkillData: getSkillData,
        getRequiredRange: getRequiredRange,
        getAttackTimeConfig: getAttackTimeConfig,
        setAttackTimeConfig: setAttackTimeConfig,
        getSkillActionConfig: getSkillActionConfig,
        setSkillActionConfig: setSkillActionConfig,
        calculateActionTime: function(skillAegis, skillLevel, char) {
            return global.SkillExecutor.calculateActionTime(skillAegis, skillLevel, char);
        },
        updateSkillConfig: function(skills, strategy, enabled) {
            global.SkillStrategy.updateSkillConfig(skills, strategy, enabled);
        },
        getSkillConfig: function() {
            return global.SkillStrategy.getConfig();
        },
        _getMergedSkillData: function(skillAegis, skillLevel, char) {
            return global.SkillGateway.getMergedSkillData(skillAegis, skillLevel);
        },
        getGCDTotal: getGCDTotal,
    };

    _init();
})(window);
