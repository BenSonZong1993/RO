// js/battle/PlayerAI.js
(function(global) {
    'use strict';

    function getDisplayName(id) {
        var def = global.SkillData ? global.SkillData[id] : null;
        return (def && def.DisplayName) ? def.DisplayName : id;
    }

    function _getPlayerAIConfig() {
        var defaultCfg = {
            moveSpeed: 200,
            defaultAtk: 5,
            defenseCoefficient: 100,
            minDamage: 1,
            skillGlobalCooldown: 0.3,
        };

        if (!global.ConfigProfileManager) {
            return defaultCfg;
        }

        var profile = global.ConfigProfileManager.getCurrentProfile();
        if (!profile || !profile.char) {
            return defaultCfg;
        }

        var charCfg = profile.char;
        var battleCfg = charCfg.battle || {};
        var result = {
            moveSpeed: charCfg.moveSpeed !== undefined ? charCfg.moveSpeed : defaultCfg.moveSpeed,
            defaultAtk: defaultCfg.defaultAtk,
            defenseCoefficient: defaultCfg.defenseCoefficient,
            minDamage: defaultCfg.minDamage,
            skillGlobalCooldown: battleCfg.defaultGcd !== undefined ? battleCfg.defaultGcd : defaultCfg.skillGlobalCooldown,
        };
        return result;
    }

    // ---------- 辅助：构建基础命中数组（支持双持拆分） ----------
    function _buildBaseHits(char, target, totalDamage) {
        // 默认单段
        var baseHits = [{ damage: totalDamage, canCrit: true, type: 'normal' }];

        if (!char || !global.InventoryService) return baseHits;

        var equipped = global.InventoryService.getEquippedInfo();
        var shield = equipped.shield;
        if (!shield) return baseHits;

        // 检查副手是否为可双持武器
        var shieldDef = global.ItemDataGateway ? global.ItemDataGateway.getById(shield.templateId) : null;
        if (!shieldDef || shieldDef.Type !== 'Weapon') return baseHits;

        var dualTypes = ['Dagger', '1hSword', '1hAxe'];
        if (dualTypes.indexOf(shieldDef.SubType) === -1) return baseHits;

        // --- 双持拆分 ---
        var leftLevel = (char.learnedSkills && char.learnedSkills['AS_LEFT']) || 0;
        var rightLevel = (char.learnedSkills && char.learnedSkills['AS_RIGHT']) || 0;

        // 读取补丁系数（与 EquipService 逻辑保持一致）
        var leftPatch = global.SkillGateway ? global.SkillGateway.getSkillByAegis('AS_LEFT') : null;
        var rightPatch = global.SkillGateway ? global.SkillGateway.getSkillByAegis('AS_RIGHT') : null;
        var leftFactor = (leftPatch && leftPatch.dual_wield && leftPatch.dual_wield.restoreRate)
            ? (leftPatch.dual_wield.restoreRate[leftLevel] || 0.4)
            : 0.4;
        var rightFactor = (rightPatch && rightPatch.dual_wield && rightPatch.dual_wield.restoreRate)
            ? (rightPatch.dual_wield.restoreRate[rightLevel] || 0.6)
            : 0.6;

        // 按比例拆分总伤害（确保主手+副手 = totalDamage）
        var totalRatio = rightFactor + leftFactor;
        var mainDmg = Math.floor(totalDamage * (rightFactor / totalRatio));
        var offDmg = totalDamage - mainDmg; // 余数补足，保证总和一致

        baseHits = [
            { damage: mainDmg, canCrit: true, type: 'main' },
            { damage: offDmg, canCrit: true, type: 'off' }
        ];

        return baseHits;
    }


    function _willCollideWithMonster(x, y, monsters) {
    if (!monsters || monsters.length === 0) return false;
    var playerRadius = 18; // 可以从配置读取，这里简单写
    // 读取玩家碰撞半径（可选从 ConfigProfiles 读取）
    if (global.ConfigProfileManager) {
        var profile = global.ConfigProfileManager.getCurrentProfile();
        if (profile && profile.char && profile.char.collision && profile.char.collision.radiusPx) {
            playerRadius = profile.char.collision.radiusPx;
        }
    }
    for (var i = 0; i < monsters.length; i++) {
        var m = monsters[i];
        if (!m.alive) continue;
        var dx = m.x - x;
        var dy = m.y - y;
        var dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < playerRadius + (m.collisionRadius || 20)) {
            return true;
        }
    }
    return false;
}


    // ---------- 主循环 ----------
function update(delta, playerUnit, monsters, playerPos) {
    if (!playerUnit || playerUnit.hp <= 0) return;
    if (!monsters || monsters.length === 0) return;

    var char = global.CharController ? global.CharController.getChar() : null;
    if (char && char.sc && typeof char.sc.hasSCE === 'function') {
        if (char.sc.hasSCE(SC_CONSTANTS.Stun) ||
            char.sc.hasSCE(SC_CONSTANTS.Freeze) ||
            char.sc.hasSCE(SC_CONSTANTS.Stone) ||
            char.sc.hasSCE(SC_CONSTANTS.Sleep) ||
            char.sc.hasSCE(SC_CONSTANTS.Deepsleep) ||
            char.sc.hasSCE(SC_CONSTANTS.Whiteimprison)) {
            return;
        }
    }

    var cfg = _getPlayerAIConfig();

    var interval = 0.5;
    if (global.CharController) {
        var charData = global.CharController.getChar();
        if (charData && charData._finalStats && typeof charData._finalStats.attackInterval === 'number') {
            interval = charData._finalStats.attackInterval;
            playerUnit.attackInterval = interval;
        } else if (typeof playerUnit.attackInterval === 'number') {
            interval = playerUnit.attackInterval;
        }
    } else if (typeof playerUnit.attackInterval === 'number') {
        interval = playerUnit.attackInterval;
    }

    var minInterval = 0.14;
    var maxInterval = 2.0;
    if (global.BattleController && typeof global.BattleController.getBattleConfig === 'function') {
        var battleCfg = global.BattleController.getBattleConfig();
        if (battleCfg) {
            minInterval = battleCfg.minAttackInterval || minInterval;
            maxInterval = battleCfg.maxAttackInterval || maxInterval;
        }
    }
    interval = Math.max(minInterval, Math.min(maxInterval, interval));

    var target = null;
    var minDist = Infinity;
    for (var i = 0; i < monsters.length; i++) {
        var mon = monsters[i];
        if (!mon.alive || !mon.visible) continue;
        var dx = mon.x - playerPos.x;
        var dy = mon.y - playerPos.y;
        var dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < minDist) {
            minDist = dist;
            target = mon;
        }
    }
    if (!target) return;

    if (playerUnit._attackCooldown === undefined) playerUnit._attackCooldown = 0;
    playerUnit._attackCooldown -= delta;

    var requiredRange = RO_CONSTANTS.DEFAULT_ATTACK_RANGE;
    if (char && global.SkillScheduler && typeof global.SkillScheduler.getRequiredRange === 'function') {
        var dynamicRange = global.SkillScheduler.getRequiredRange(char, target);
        if (typeof dynamicRange === 'number' && dynamicRange > 0) {
            requiredRange = dynamicRange;
        }
    }
    if (requiredRange === RO_CONSTANTS.DEFAULT_ATTACK_RANGE && typeof playerUnit.attackRange === 'number' && playerUnit.attackRange > 0) {
        requiredRange = playerUnit.attackRange;
    }

    if (minDist <= requiredRange) {
        if (playerUnit._attackCooldown <= 0) {
            var finalDamage = 0;
            var isSkill = false;
            var skillName = '普攻';
            var char2 = global.CharController ? global.CharController.getChar() : null;
            var result = null;

            if (char2 && global.SkillScheduler) {
                global.SkillScheduler.setAttackInterval(interval);
                var masteryBonus = 0;
                if (!window.calculateMasteryDamage) {
                    masteryBonus = (char2.learnedSkills?.SM_SWORD || 0) * 4;
                }

                result = global.SkillScheduler.tryAction(
                    char2,
                    target,
                    playerUnit.atk || cfg.defaultAtk,
                    masteryBonus
                );

                if (result.action === 'skill') {
                    finalDamage = result.damage;
                    isSkill = true;
                    skillName = getDisplayName(result.skillAegis);
                } else if (result.action === 'attack') {
                    finalDamage = result.damage;
                    isSkill = false;
                    skillName = '普攻';
                } else {
                    playerUnit._attackCooldown = 0.1;
                    return;
                }
            } else {
                // 降级计算（无 SkillScheduler）
                if (global.rAthena && global.rAthena.engine) {
                    var weaponType = 'Fist';
                    if (char2 && global.InventoryService) {
                        var equipped = global.InventoryService.getEquippedInfo();
                        if (equipped.weapon) {
                            var def = global.InventoryService._getItemDef(equipped.weapon.templateId);
                            if (def && def.SubType) {
                                weaponType = def.SubType;
                            }
                        }
                    }
                    var attackResult = global.rAthena.engine.calculateNormalAttackDamage(char2, target, weaponType);
                    finalDamage = attackResult.damage;
                } else {
                    var atk = playerUnit.atk || cfg.defaultAtk;
                    var def = target.def || 0;
                    var reduction = def / (def + 100);
                    finalDamage = Math.max(1, Math.floor(atk * (1 - reduction)));
                    if (char2) {
                        var swordLv = char2.learnedSkills?.SM_SWORD || 0;
                        finalDamage += swordLv * 4;
                    }
                }
                isSkill = false;
                skillName = '普攻';
            }

      // ---- 构建命中结果（区分普攻与技能） ----
            var hitResults = null;
            var triggeredModifiers = [];
            var eventData = null;  // ★ 在外部声明，确保所有分支都能访问

            if (!isSkill) {
                // ===== 普攻路径：直接使用原始攻击力，重新计算每段伤害 =====
                var rawAtk = playerUnit.atk || cfg.defaultAtk;
                var stats = global.AttributeGateway ? global.AttributeGateway.getAll('PlayerAI') : null;
                var cri = stats ? (stats.cri || 0) : 0;
                var criDamage = stats ? (stats.criDamage || 0) : 0;
                var currentWeaponType = 'None';
                if (char2 && global.InventoryService) {
                    var equippedInfo = global.InventoryService.getEquippedInfo();
                    if (equippedInfo.weapon) {
                        var weaponDef = global.InventoryService._getItemDef(equippedInfo.weapon.templateId);
                        if (weaponDef && weaponDef.SubType) {
                            currentWeaponType = weaponDef.SubType;
                        }
                    }
                }

                // 构建基础命中数组（双持拆分），使用原始攻击力
                var baseHits = _buildBaseHits(char2, target, rawAtk);

                // ★★★ 新增：调用普攻修饰引擎（二刀连击、连锁动作等） ★★★
if (typeof NormalAttackModifierEngine !== 'undefined' && NormalAttackModifierEngine.process) {
    var modifierResult = NormalAttackModifierEngine.process(
        char2,
        currentWeaponType,
        target,
        baseHits
    );
    // modifierResult.hitResults 包含了基础段 + 触发额外段，且每段已有 isCritical 初始 false
    // 但我们将用这些段重新进行暴击判定
    baseHits = modifierResult.hitResults;
    // 如果有触发的修饰，可记录日志
    if (modifierResult.triggered.length > 0) {
        // console.log('[PlayerAI] 触发普攻修饰:', modifierResult.triggered);
    }
}

                // 对每段进行暴击判定
                var hitResultsWithCrit = [];
                for (var h = 0; h < baseHits.length; h++) {
                    var hit = baseHits[h];
                    var isCrit = false;
                    if (hit.canCrit !== false) {
                        if (Math.random() * 100 < cri) {
                            isCrit = true;
                        }
                    }
                    hitResultsWithCrit.push({
                        damage: hit.damage,
                        canCrit: hit.canCrit !== false,
                        isCritical: isCrit,
                        type: hit.type || 'normal',
                    });
                }

                // 对每段调用引擎计算伤害（传入 isCritical 和 criDamage）
                var finalHitResults = [];
                var totalDamage = 0;
                for (var i = 0; i < hitResultsWithCrit.length; i++) {
                    var hInfo = hitResultsWithCrit[i];
                    var engineResult = global.rAthena.engine.calculateDamage(
                        char2,
                        target,
                        hInfo.damage, // 原始攻击力分段
                        {
                            weaponType: currentWeaponType || 'Fist',
                            attackElem: stats ? stats.attackElement : 'Neutral',
                            elemLevel: stats ? stats.attackElementLevel : 1,
                            skillDamage: 0,
                            hitCount: 1,
                            hitType: 'Single',
                            isCritical: hInfo.isCritical || false,
                            criDamageBonus: criDamage || 0,
                        }
                    );
                    var dmg = engineResult.damage || 0;
                    hInfo.damage = Math.max(0, Math.floor(dmg));
                    hInfo.status = hInfo.isCritical ? 'critical_hit' : 'hit';
                    totalDamage += hInfo.damage;
                    finalHitResults.push(hInfo);
                }
                finalDamage = totalDamage + (masteryBonus || 0);
                hitResults = finalHitResults;
                triggeredModifiers = [];

                

                // ★ 构建普攻事件数据（不再发送事件，留到外部统一发送）
                eventData = {
                    target: target,
                    damage: finalDamage,
                    isSkill: false,
                    skillName: '普攻',
                    hitResults: hitResults,
                    triggeredModifiers: triggeredModifiers,
                    isCritical: hitResults.some(function(h) { return h.isCritical === true; }),
                };
                // 注意：不在这里 emit，统一在外部发送
            } else {
                // ===== 技能路径 =====
                    // 从 result 中提取多段命中结果
    var hitResults = (result && result.hitResults) ? result.hitResults : null;
                // 技能伤害已在 result 中计算好，直接使用
                // 但我们需要构建 eventData

                eventData = {
                    target: target,
                    damage: finalDamage,
                    isSkill: true,
                    skillName: skillName,
                    hitResults: hitResults, // 可能为 null，但 SkillExecutor 已返回
                    triggeredModifiers: [],
                    isCritical: result && result.isCritical === true,
                };
                // 如果技能有额外字段，继续添加
                if (result && result.action === 'skill') {
                    eventData.isSplash = result.isSplash || false;
                    eventData.splashArea = result.splashArea || 0;
                    eventData.splashSplit = result.splashSplit || false;
                    eventData.weaponType = result.weaponType || 'Fist';
                    eventData.attackElem = result.attackElem || 'Neutral';
                    eventData.elemLevel = result.elemLevel || 1;
                    eventData.skillRatio = result.ratio || 100;
                    eventData.hitCount = result.hitCount || 1;
                    eventData.hitType = result.hitType || 'Single';
                    eventData.effectiveAtk = result.effectiveAtk || playerUnit.atk || 5;
                    eventData.isSupport = result.isSupport || false;
                    eventData.healAmount = result.healAmount || 0;
                    eventData.status = result.status || null;
                    eventData.statusChance = result.statusChance || null;
                    eventData.skillAegis = result.skillAegis || null;   // 供 BattleController 查补丁（statusTarget/duration）
                    eventData.skillLevel = result.skillLevel || 1;      // 供状态 val1（如天赐属性 = 技能等级）
                    eventData.isMagic = result.isMagic || false;        // 供溅射逐目标重算走魔法路径
                    eventData.canCritical = result.canCritical || false; // 供溅射逐目标重算
                    eventData.criRate = result.criRate || 0;            // 供溅射逐目标重算的逐段暴击
                }
            }

            // ★ 统一发送事件
            if (eventData) {
                global.EventBus.emit('battle:playerAttack', eventData);
            }
            playerUnit._attackCooldown = interval;
        }
    } else {
        var dx = target.x - playerPos.x;
        var dy = target.y - playerPos.y;
        var dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 0) {
            var speed = cfg.moveSpeed * delta;
            var move = Math.min(speed, dist);
 var newX = playerPos.x + (dx / dist) * move;
var newY = playerPos.y + (dy / dist) * move;

// 检测新位置是否与任何怪物碰撞
if (!_willCollideWithMonster(newX, newY, monsters)) {
    playerPos.x = newX;
    playerPos.y = newY;
}
// 否则原地不动（被挡住）
        }
    }
}

    function getPlayerAIConfig() {
        return _getPlayerAIConfig();
    }

    global.PlayerAI = {
        update: update,
        getPlayerAIConfig: getPlayerAIConfig,
    };

    console.log('[PlayerAI] 已加载（含双持拆分 + 普攻修饰引擎集成）');
})(window);