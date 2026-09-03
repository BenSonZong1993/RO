// ============================================================
//  📁 js/battle/BattleController.js
//  战斗主控制器（精简版）
//  职责：战斗循环、怪物管理、玩家位置、AI 调度
//  说明：怪物间碰撞为刚性分离（无弹性），玩家碰撞由 PlayerAI 处理
// ============================================================
(function(global) {
    'use strict';

    var SC_CONSTANTS = global.SC_CONSTANTS || {};

    function _getBattleConfig() {
        var defaultCfg = {
            minAttackInterval: 0.14,
            maxAttackInterval: 2.0,
            critChance: 0.1,
            interruptCooldown: 2.0,
            damageScaleMonster: 1.5,
            damageScalePlayer: 1.0,
            defenseCoefficient: 100,
            defaultRespawnDelay: 3.0,
            respawnHealFull: true,
            respawnClearMonsters: true,
            minDamage: 6,
            monsterSeparation: { distanceMultiplier: 1.8, pushStrength: 0.2 },
        };

        if (!global.ConfigProfileManager) return defaultCfg;
        var profile = global.ConfigProfileManager.getCurrentProfile();
        if (!profile || !profile.char || !profile.char.battle) return defaultCfg;

        var battle = profile.char.battle;
        var engine = profile.engine || {};
        return {
            minAttackInterval: battle.minAttackInterval !== undefined ? battle.minAttackInterval : defaultCfg.minAttackInterval,
            maxAttackInterval: battle.maxAttackInterval !== undefined ? battle.maxAttackInterval : defaultCfg.maxAttackInterval,
            critChance: battle.critChance !== undefined ? battle.critChance : defaultCfg.critChance,
            interruptCooldown: battle.interruptCooldown !== undefined ? battle.interruptCooldown : defaultCfg.interruptCooldown,
            damageScaleMonster: battle.damageScaleMonster !== undefined ? battle.damageScaleMonster : defaultCfg.damageScaleMonster,
            damageScalePlayer: battle.damageScalePlayer !== undefined ? battle.damageScalePlayer : defaultCfg.damageScalePlayer,
            defenseCoefficient: defaultCfg.defenseCoefficient,
            defaultRespawnDelay: defaultCfg.defaultRespawnDelay,
            respawnHealFull: defaultCfg.respawnHealFull,
            respawnClearMonsters: defaultCfg.respawnClearMonsters,
            minDamage: engine.minDamage !== undefined ? engine.minDamage : 6,
        };
    }

    var _isRunning = false;
    var _mapId = '';
    var _playerPos = { x: 400, y: 300 };
    var _monsters = [];
    var _eventListeners = [];
    var _playerUnit = null;
    var _isRespawning = false;
    var _lastInterruptTime = 0;
    var _respawnTimerId = null;
    var _skillStatus = {
        isCasting: false,
        castProgress: 0,
        castTotal: 1,
        cooldownRemaining: 0,
        cooldownTotal: 0,
        skillAegis: '',
        fixedRatio: 0,
        gcdRemaining: 0,
        gcdTotal: 0,
    };

    function _resetSkillStatus() {
        _skillStatus.isCasting = false;
        _skillStatus.castProgress = 0;
        _skillStatus.castTotal = 1;
        _skillStatus.cooldownRemaining = 0;
        _skillStatus.cooldownTotal = 0;
        _skillStatus.skillAegis = '';
        _skillStatus.fixedRatio = 0;
        _skillStatus.gcdRemaining = 0;
        _skillStatus.gcdTotal = 0;
    }

    function _getPlayerUnit() {
        if (!_playerUnit) _playerUnit = {};
        var char = global.CharRepository ? global.CharRepository.getLiveRef() : null;
        if (!char) return null;

        var final = {};
        if (global.AttributeGateway && typeof global.AttributeGateway.getAll === 'function') {
            final = global.AttributeGateway.getAll('BattleController') || {};
        } else {
            final = char._finalStats || {};
        }

        var cfg = _getBattleConfig();
        var atk = final.finalATK || 5;
        var def = final.finalDEF || 0;
        var maxHp = final.finalMaxHP || 100;
        var maxSp = final.finalMaxSP || 50;
        var attackRange = final.attackRange || RO_CONSTANTS.DEFAULT_ATTACK_RANGE;
        var attackInterval = final.attackInterval || 0.5;
        attackInterval = Math.max(cfg.minAttackInterval, Math.min(cfg.maxAttackInterval, attackInterval));

        _playerUnit.id = 'player';
        _playerUnit.name = char.name || '冒险者';
        _playerUnit.level = char.level || 1;
        _playerUnit.hp = char.hp || 0;
        _playerUnit.maxHp = maxHp;
        _playerUnit.sp = char.sp || 0;
        _playerUnit.maxSp = maxSp;
        _playerUnit.atk = atk;
        _playerUnit.def = def;
        _playerUnit.attackRange = attackRange;
        _playerUnit.attackInterval = attackInterval;
        if (typeof _playerUnit._attackCooldown !== 'number') _playerUnit._attackCooldown = 0;
        return _playerUnit;
    }

    // ---- 刚性分离（怪物之间） ----
    function _separateMonsters() {
        var alive = _monsters.filter(function(m) { return m.alive !== false; });
        if (alive.length < 2) return;

        var collisionRadius = 20;
        var profile = global.ConfigProfileManager ? global.ConfigProfileManager.getCurrentProfile() : null;
        if (profile && profile.monster && profile.monster.formation && profile.monster.formation.collisionRadiusPx) {
            collisionRadius = profile.monster.formation.collisionRadiusPx;
        }

        var minDist = collisionRadius * 2;

        for (var i = 0; i < alive.length; i++) {
            for (var j = i + 1; j < alive.length; j++) {
                var a = alive[i];
                var b = alive[j];
                var dx = a.x - b.x;
                var dy = a.y - b.y;
                var dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < minDist && dist > 0.001) {
                    var overlap = minDist - dist;
                    var normX = dx / dist;
                    var normY = dy / dist;
                    a.x += normX * overlap / 2;
                    a.y += normY * overlap / 2;
                    b.x -= normX * overlap / 2;
                    b.y -= normY * overlap / 2;
                }
            }
        }
    }

    function _calcDamage(atk, def) {
        var cfg = _getBattleConfig();
        if (atk <= 0) return 1;
        var reduction = def / (def + cfg.defenseCoefficient);
        return Math.max(1, Math.floor(atk * (1 - reduction)));
    }

function _applyDamageToMonster(monster, damage, isSkill, skillName, hitResults) {
    if (!monster || !monster.alive) return;
    monster.hp = Math.max(0, monster.hp - damage);

    if (global.MonsterAI && typeof global.MonsterAI.markAggro === 'function') {
        global.MonsterAI.markAggro(monster, 5.0);
    }

    if (global.BattleEffectsManager) {
        var cfg = _getBattleConfig();

        // 如果有段结果，逐段判断：damage==0 -> miss，>0 -> addDamage
        if (hitResults && hitResults.length > 0) {
            if (global.BattleSpeedManager && global.BattleSpeedManager.shouldAggregateFloatText()) {
                // 聚合逻辑：合并所有段的正伤害，任何一段暴击即为暴击样式
                var totalDamage = 0;
                var anyCrit = false;
                var anyHit = false;
                for (var k = 0; k < hitResults.length; k++) {
                    var hr = hitResults[k] || {};
                    var d = hr.damage || 0;
                    if ((typeof d) === 'number' && d > 0) {
                        totalDamage += d;
                        anyHit = true;
                    }
                    if (hr.isCritical === true) anyCrit = true;
                }
                if (anyHit) {
                    global.BattleEffectsManager.addDamage(monster.x, monster.y, totalDamage + '×' + hitResults.length, anyCrit, cfg.damageScaleMonster);
                } else {
                    // 全部未命中：显示一次未命中
                    global.BattleEffectsManager.addMiss(monster.x, monster.y, 0);
                }
            } else {
                for (var i = 0; i < hitResults.length; i++) {
                    var hr = hitResults[i] || {};
                    var d = hr.damage || 0;
                    var isCrit = hr.isCritical === true;
                    var delay = i * 100;
                    if (d > 0) {
                        global.BattleEffectsManager.addDamage(monster.x, monster.y, d, isCrit, cfg.damageScaleMonster, delay);
                    } else {
                        // miss for this segment
                        global.BattleEffectsManager.addMiss(monster.x, monster.y, delay);
                    }
                }
            }
        } else {
            // 没有段结果的兼容路径：按数值决定是否显示 damage 或 miss
            if (damage > 0) {
                global.BattleEffectsManager.addDamage(monster.x, monster.y, damage, false, cfg.damageScaleMonster);
            } else {
                global.BattleEffectsManager.addMiss(monster.x, monster.y, 0);
            }
        }

        if (isSkill && skillName && skillName !== '普攻') {
            global.BattleEffectsManager.addSkillName({ x: monster.x, y: monster.y - 30 }, skillName);
        }
    }

    if (monster.hp <= 0) {
        monster.alive = false;
        monster.visible = false;
        global.SpawnManager.markDead(monster);
        var player = _getPlayerUnit();
        var lootResult = global.LootManager.processDeath(monster, player);
        if (global.BattleEffectsManager && lootResult) {
            global.BattleEffectsManager.addExperience(_playerPos, lootResult.exp, lootResult.jobExp);
            for (var j = 0; j < lootResult.loot.length; j++) {
                global.BattleEffectsManager.addLoot(_playerPos, lootResult.loot[j]);
            }
        }
    }
}

    function _handlePlayerDeath() {
        if (global.PartnerManager && typeof global.PartnerManager.despawn === 'function') {
            global.PartnerManager.despawn('player-down');
        }
        if (global.SkillScheduler) {
            if (typeof global.SkillScheduler.clearCombatState === 'function') {
                global.SkillScheduler.clearCombatState();
            }
            if (typeof global.SkillScheduler.reset === 'function') {
                global.SkillScheduler.reset();
            }
        }
        _resetSkillStatus();

        if (_isRespawning) return;
        if (!_isRunning) return;

        if (_respawnTimerId) {
            clearTimeout(_respawnTimerId);
            _respawnTimerId = null;
        }

        _isRespawning = true;
        _isRunning = false;

    // ============================================================
    // ★ 死亡惩罚（配置驱动）
    // ============================================================
    try {
        // 1. 读取死亡惩罚配置
        var penaltyConfig = null;
        if (global.ConfigProfileManager && typeof global.ConfigProfileManager.getCurrentProfile === 'function') {
            var profile = global.ConfigProfileManager.getCurrentProfile();
            if (profile && profile.deathPenalty) {
                penaltyConfig = profile.deathPenalty;
            }
        }
        // 若未读取到，使用默认值（与 ConfigProfiles 中一致）
        if (!penaltyConfig) {
            penaltyConfig = {
                enabled: true,
                baseExpPercent: 0.10,
                jobExpPercent: 0.10,
                zenyPercent: 0.10,
                minZeny: 0,
                maxBaseExpDeduction: 0,
                maxJobExpDeduction: 0,
            };
        }

        // 2. 检查总开关
        if (penaltyConfig.enabled !== false) {
            var char = global.CharRepository ? global.CharRepository.getLiveRef() : null;
            if (char && char.hp <= 0 && global.CharacterContext) {
                // --- BASE 经验 ---
                var baseExpDeduction = 0;
                if (penaltyConfig.baseExpPercent > 0) {
                    baseExpDeduction = Math.floor((char.exp || 0) * penaltyConfig.baseExpPercent);
                    if (penaltyConfig.maxBaseExpDeduction > 0) {
                        baseExpDeduction = Math.min(baseExpDeduction, penaltyConfig.maxBaseExpDeduction);
                    }
                }

                // --- JOB 经验 ---
                var jobExpDeduction = 0;
                if (penaltyConfig.jobExpPercent > 0) {
                    jobExpDeduction = Math.floor((char.jobExp || 0) * penaltyConfig.jobExpPercent);
                    if (penaltyConfig.maxJobExpDeduction > 0) {
                        jobExpDeduction = Math.min(jobExpDeduction, penaltyConfig.maxJobExpDeduction);
                    }
                }

                // --- Zeny ---
                var zenyDeduction = 0;
                if (penaltyConfig.zenyPercent > 0) {
                    var currentZeny = char.zeny || 0;
                    var rawZeny = Math.floor(currentZeny * penaltyConfig.zenyPercent);
                    var minZeny = penaltyConfig.minZeny || 0;
                    // 确保扣除后不低于 minZeny
                    zenyDeduction = Math.max(0, Math.min(rawZeny, currentZeny - minZeny));
                }

                // 执行扣除（仅当有扣除量时）
                if (baseExpDeduction > 0 || jobExpDeduction > 0) {
                    global.CharacterContext.deductCurrentExp(baseExpDeduction, jobExpDeduction, 'BattleController');
                }
                if (zenyDeduction > 0) {
                    global.CharacterContext.deductZeny(zenyDeduction, 'BattleController');
                }

                console.log('[BattleController] 死亡惩罚执行: BASE -' + baseExpDeduction + ', JOB -' + jobExpDeduction + ', Zeny -' + zenyDeduction);
            }
        }
    } catch (e) {
        console.error('[BattleController] 死亡惩罚异常:', e);
    }
    // ============================================================

    // ---- 后续复活流程（清除怪物 / 回血 / 定时器） ----
        var delay = 3.0;
        var clearMonsters = true;
        var healFull = true;

        if (global.MapDataGateway) {
            var group = global.MapDataGateway.getGroup(_mapId);
            var strategy = (group && group.spawnStrategy) || {};
            var respawnConfig = strategy.respawn || {};
            if (respawnConfig.enabled !== undefined && !respawnConfig.enabled) {
                _isRespawning = false;
                return;
            }
            if (respawnConfig.delay !== undefined) delay = respawnConfig.delay;
            if (respawnConfig.clearMonsters !== undefined) clearMonsters = respawnConfig.clearMonsters;
            if (respawnConfig.healFull !== undefined) healFull = respawnConfig.healFull;
        }

        if (clearMonsters && global.SpawnManager) {
            var monsters = global.SpawnManager.getMonsters();
            for (var i = 0; i < monsters.length; i++) {
                monsters[i].alive = false;
                monsters[i].visible = false;
            }
            global.SpawnManager.reset();
            var mapInfo = global.MapService ? global.MapService.getMapById(_mapId) : null;
            var width = mapInfo ? mapInfo.width : 1920;
            var height = mapInfo ? mapInfo.height : 1080;
            global.SpawnManager.init(_mapId, width, height);
        }

        if (healFull && global.CharController) {
            global.CharController.healFull();
        }

        _respawnTimerId = setTimeout(function() {
            _respawnTimerId = null;
            if (!global.BattleController) return;
            var char = global.CharRepository ? global.CharRepository.getLiveRef() : null;
            if (!char || char.hp <= 0) {
                _isRespawning = false;
                return;
            }
            _isRespawning = false;
            if (char.hp > 0) {
                global.BattleController.start(_mapId, _playerPos);
            }
        }, delay * 1000);
    }

    function _bindEvents() {
        _unbindEvents();
        var bus = global.EventBus;
        if (!bus) return;

var onPlayerAttack = function(data) {
    var monsters = _monsters;
    var target = data.target;
    if (!target || !target.alive) return;

    var splashArea = data.splashArea || 0;
    var isSplash = data.isSplash || false;
    var splashSplit = data.splashSplit || false;
    var damage = data.damage || 1;

    // ========== ★ 新增：应用溅射倍率 ★ ==========
    var profile = global.ConfigProfileManager ? global.ConfigProfileManager.getCurrentProfile() : null;
    var splashMult = (profile && profile.char && profile.char.battle && profile.char.battle.skillSplashAreaMultiplier) || 1.0;
    var effectiveSplashArea = Math.floor(splashArea * splashMult);

    // ---- 获取受影响的怪物列表 ----
    var affectedMonsters = [];
    if (isSplash && effectiveSplashArea > 0) {
        var cellSize = RO_CONSTANTS.PIXELS_PER_CELL; // 64
        var radiusPx = effectiveSplashArea * cellSize; // 用放大后的溅射半径
        var monsters = _monsters;
        for (var i = 0; i < monsters.length; i++) {
            var mon = monsters[i];
            if (!mon.alive) continue;
            var dx = mon.x - target.x;
            var dy = mon.y - target.y;
            var dist = Math.sqrt(dx * dx + dy * dy);
            if (dist <= radiusPx) {
                affectedMonsters.push(mon);
            }
        }
    } else {
        affectedMonsters.push(target);
    }

    // ---- 伤害分配 ----
    var totalDamage = damage;
    var splashPerTargetDone = false;
    if (splashSplit && affectedMonsters.length > 1) {
        // 分摊伤害：平均分配（总伤害不变）
        totalDamage = Math.floor(damage / affectedMonsters.length);
        // 注：剩余小数部分可忽略或添加到第一个目标，此处简化
    }

    // ---- ★ 溅射逐目标重算（多段框架收口） ----
    // 旧路径把"主目标算出的总伤"复制给所有溅射目标——各目标的防御/元素/种族修正失真。
    // 新路径：每个目标独立调用 rAthena.engine.calculateDamage（逐段结算 + 九孔 + 独立暴击），
    // hitResults 随目标传入 _applyDamageToMonster，实现逐段飘字。
    if (affectedMonsters.length > 1 && data.isSkill
        && global.rAthena && global.rAthena.engine
        && typeof data.effectiveAtk === 'number') {
        var caster = global.CharRepository && typeof global.CharRepository.getLiveRef === 'function'
            ? global.CharRepository.getLiveRef() : null;
        if (caster) {
            for (var t = 0; t < affectedMonsters.length; t++) {
                var monT = affectedMonsters[t];
                if (!monT.alive) continue;
                var engResult = global.rAthena.engine.calculateDamage(caster, monT, data.effectiveAtk, {
                    weaponType: data.weaponType || 'Fist',
                    attackElem: data.attackElem || 'Neutral',
                    elemLevel: data.elemLevel || 1,
                    skillDamage: data.skillRatio || 100,
                    hitCount: data.hitCount || 1,
                    hitType: data.hitType || 'Single',
                    isMagic: data.isMagic === true,
                    canCritical: data.canCritical === true,
                    criRate: data.criRate || 0,
                });
                _applyDamageToMonster(monT, engResult.damage || 0, true, data.skillName || '技能',
                    engResult.details ? engResult.details.hitResults : null);
            }
            splashPerTargetDone = true;
        }
    }

    if (!splashPerTargetDone) {
        // ---- 单目标 / 无引擎时的原路径 ----
        // ---- 对每个怪物应用伤害 ----
        for (var j = 0; j < affectedMonsters.length; j++) {
            var mon = affectedMonsters[j];
            _applyDamageToMonster(mon, totalDamage, data.isSkill || false, data.skillName || '普攻', data.hitResults);
        }
    }

    // ---- ★ 状态施加（技能携带的 status；statusTarget 区分自增益/对敌） ----
    if (data.status && typeof global.status_change_start === 'function') {
        var statusChance = (typeof data.statusChance === 'number') ? data.statusChance : 1;
        if (Math.random() < statusChance) {
            var statusId = global.SC_CONSTANTS ? global.SC_CONSTANTS[data.status] : null;
            if (statusId !== undefined) {
                var skillPatch = global.SKILL_PATCHES && data.skillAegis ? global.SKILL_PATCHES[data.skillAegis] : null;
                var durationMs = (skillPatch && skillPatch.statusDurationMs) || 0;
                if (skillPatch && skillPatch.statusTarget === 'self') {
                    // 自增益：施法者 = 玩家角色（经 CharacterContext 走权限闸口）
                    if (global.CharacterContext && typeof global.CharacterContext.applyStatus === 'function') {
                        global.CharacterContext.applyStatus(statusId, durationMs, data.skillLevel || 1, 'BattleController');
                    }
                } else {
                    // 对敌：直接在怪物单位上启动状态
                    for (var s = 0; s < affectedMonsters.length; s++) {
                        global.status_change_start(null, affectedMonsters[s], statusId, data.skillLevel || 1, 0, 0, 0, durationMs, 0);
                    }
                }
            }
        }
    }
};



        bus.on('battle:playerAttack', onPlayerAttack);
        _eventListeners.push({ event: 'battle:playerAttack', fn: onPlayerAttack });

        var onMonsterAttack = function(data) {
            var monster = data.monster;
            if (!monster) return;
            if (data.targetKind === 'merc' && global.PartnerManager && typeof global.PartnerManager.takeDamage === 'function') {
                var mercDef = global.PartnerManager.getMercDef ? global.PartnerManager.getMercDef() : 0;
                var mercDamage = _calcDamage(monster.atk || 1, mercDef);
                global.PartnerManager.takeDamage(mercDamage, monster);
                return;
            }
            var playerUnit = _getPlayerUnit();
            if (!playerUnit) return;

            // 优先使用 rAthena 引擎来判定命中/闪避/伤害，以保证一致性
            var char = global.CharRepository ? global.CharRepository.getLiveRef() : null;
            if (global.rAthena && global.rAthena.engine && char) {
                try {
                    var engResult = global.rAthena.engine.calculateDamage(monster, char, monster.atk || 1, {
                        weaponType: monster.weaponType || 'Fist',
                        attackElem: monster.attackElem || 'Neutral',
                        elemLevel: monster.elemLevel || 1,
                        hitCount: 1,
                        isMagic: monster.isMagic === true,
                        canCritical: false
                    });
                    var totalDamage = engResult && engResult.damage ? engResult.damage : 0;
                    var hitResults = engResult && engResult.details ? engResult.details.hitResults : null;

                    if (totalDamage > 0) {
                        if (global.CharController && typeof global.CharController.takeDamage === 'function') {
                            global.CharController.takeDamage(totalDamage);
                            var liveChar = global.CharRepository ? global.CharRepository.getLiveRef() : null;
                            playerUnit.hp = liveChar ? (liveChar.hp || 0) : 0;

                            // 根据 hitResults 渲染飘字（可能包含 miss 段）
                            if (global.BattleEffectsManager) {
                                var cfg = _getBattleConfig();
                                if (hitResults && hitResults.length > 0) {
                                    for (var i = 0; i < hitResults.length; i++) {
                                        var hr = hitResults[i] || {};
                                        var d = hr.damage || 0;
                                        var delay = i * 100;
                                        if (d > 0) {
                                            global.BattleEffectsManager.addDamage(_playerPos.x, _playerPos.y, d, hr.isCritical === true, cfg.damageScalePlayer, delay);
                                        } else {
                                            global.BattleEffectsManager.addMiss(_playerPos.x, _playerPos.y, delay);
                                        }
                                    }
                                } else {
                                    global.BattleEffectsManager.addDamage(_playerPos.x, _playerPos.y, totalDamage, false, 1.0);
                                }
                            }

                            if (global.EventBus) global.EventBus.emit('battle:playerDamaged', { damage: totalDamage });
                        }
                    } else {
                        // 未命中：不调用 takeDamage，发事件并显示未命中飘字（中文）
                        var payload = { targetId: 'player', sourceId: monster.id || null, x: _playerPos.x, y: _playerPos.y, timestamp: Date.now() };
                        if (global.EventBus) {
                            global.EventBus.emit('battle:miss', payload);
                            // 兼容旧订阅
                            if (typeof global.EventBus.emit === 'function') global.EventBus.emit('combat:dodge', payload);
                        }
                        if (global.BattleEffectsManager) {
                            global.BattleEffectsManager.addMiss(_playerPos.x, _playerPos.y, 0);
                        }
                    }
                    return;
                } catch (e) {
                    console.error('[BattleController] rAthena 引擎计算伤害异常，回退到旧路径', e);
                }
            }

            // 兼容旧路径（不建议长期依赖）
            var damage = _calcDamage(monster.atk || 1, playerUnit.def || 0);

            if (global.CharController && typeof global.CharController.takeDamage === 'function') {
                global.CharController.takeDamage(damage);
                var char = global.CharRepository ? global.CharRepository.getLiveRef() : null;
                playerUnit.hp = char ? (char.hp || 0) : 0;
                if (global.BattleEffectsManager) {
                    global.BattleEffectsManager.addDamage(_playerPos.x, _playerPos.y, damage, false, 1.0);
                }
                if (global.EventBus) global.EventBus.emit('battle:playerDamaged', { damage: damage });
            }
        };



        bus.on('battle:monsterAttack', onMonsterAttack);
        _eventListeners.push({ event: 'battle:monsterAttack', fn: onMonsterAttack });

        var onPlayerDead = function() { _handlePlayerDeath(); };
        bus.on('char:dead', onPlayerDead);
        _eventListeners.push({ event: 'char:dead', fn: onPlayerDead });
    }

    function _unbindEvents() {
        var bus = global.EventBus;
        if (!bus) return;
        for (var i = 0; i < _eventListeners.length; i++) {
            bus.off(_eventListeners[i].event, _eventListeners[i].fn);
        }
        _eventListeners = [];
    }


function _updateSkillStatus() {
    var scheduler = global.SkillScheduler;
    if (!scheduler) return;

    var casting = scheduler.getCastingInfo();

    // ---- 咏唱状态 ----
    if (casting && casting.total > 0) {
        _skillStatus.isCasting = true;
        _skillStatus.castProgress = Math.min(casting.progress, casting.total);
        _skillStatus.castTotal = casting.total;
        _skillStatus.fixedRatio = casting.fixedRatio || 0;
        _skillStatus.skillAegis = casting.skillAegis || '';
    } else {
        // ★ 咏唱结束：保存快照（用于冷却回退）
        if (_skillStatus.isCasting === true) {
            _skillStatus._snapshotVariableRatio = 1 - (_skillStatus.fixedRatio || 0);
            _skillStatus._snapshotFixedRatio = _skillStatus.fixedRatio || 0;
            _skillStatus._snapshotColors = {
                variable: '#FF8C00',
                fixed: '#FFD700'
            };
        }
        _skillStatus.isCasting = false;
        _skillStatus.castProgress = 0;
        _skillStatus.castTotal = 1;
        _skillStatus.fixedRatio = 0;
    }

    // ---- GCD ----
    var gcdRemaining = scheduler.getGCD();
    _skillStatus.gcdRemaining = gcdRemaining > 0 ? gcdRemaining : 0;

    var gcdTotal = 0;
    if (scheduler.getGCDTotal) {
        gcdTotal = scheduler.getGCDTotal();
    }
    if (gcdTotal <= 0 && global.ConfigProfileManager) {
        var profile = global.ConfigProfileManager.getCurrentProfile();
        if (profile && profile.char && profile.char.battle && typeof profile.char.battle.gcd === 'number') {
            gcdTotal = profile.char.battle.gcd;
        }
    }
    _skillStatus.gcdTotal = gcdTotal;
    if (gcdRemaining <= 0) _skillStatus.gcdTotal = 0;

    // ---- 独立冷却列表 ----
    var char = global.CharRepository ? global.CharRepository.getLiveRef() : null;
    var cooldownList = [];
    if (char && char.learnedSkills) {
        for (var skillAegis in char.learnedSkills) {
            if (!char.learnedSkills.hasOwnProperty(skillAegis)) continue;
            var level = char.learnedSkills[skillAegis] || 1;
            if (level <= 0) continue;
            var cd = scheduler.getCooldown(skillAegis);
            if (cd > 0.01) {
                var def = global.SkillGateway ? global.SkillGateway.getSkillAtLevel(skillAegis, level) : null;
                var totalCd = (def && def._cooldown) ? def._cooldown : 0;
                var gcdForCompare = _skillStatus.gcdTotal || 1.5;
                if (totalCd > gcdForCompare) {
                    cooldownList.push({
                        aegis: skillAegis,
                        remaining: cd,
                        total: totalCd,
                        level: level
                    });
                }
            }
        }
    }
    cooldownList.sort(function(a, b) { return b.remaining - a.remaining; });
    _skillStatus.cooldownList = cooldownList;

    if (cooldownList.length > 0) {
        var top = cooldownList[0];
        _skillStatus.cooldownRemaining = top.remaining;
        _skillStatus.cooldownTotal = top.total;
        _skillStatus.skillAegis = top.aegis;
    } else {
        _skillStatus.cooldownRemaining = 0;
        _skillStatus.cooldownTotal = 0;
    }
}

    // ---- 公开方法 ----
    function start(mapId, playerPos) {
        if (global.MapFlagData && global.MapFlagData.isTown(mapId)) {
            console.warn('[BattleController] 城镇安全区禁止战斗');
            return false;
        }

        if (_isRunning) stop();

        _isRespawning = false;
        _lastInterruptTime = 0;
        if (_respawnTimerId) {
            clearTimeout(_respawnTimerId);
            _respawnTimerId = null;
        }

        if (!mapId || typeof mapId !== 'string' || mapId.trim() === '') {
            mapId = 'prt_fild08';
        }

        if (typeof global.MapService === 'undefined' ||
            typeof global.SpawnManager === 'undefined' ||
            typeof global.LootManager === 'undefined' ||
            typeof global.MonsterService === 'undefined') {
            console.error('[BattleController] 依赖模块未加载');
            return false;
        }

        _mapId = mapId;
        if (playerPos) {
            _playerPos.x = playerPos.x || 400;
            _playerPos.y = playerPos.y || 300;
        }

        var mapInfo = global.MapService.getMapById(_mapId);
        if (!mapInfo) return false;
        var width = mapInfo.width || 1920;
        var height = mapInfo.height || 1080;

        var ok = global.SpawnManager.init(_mapId, width, height);
        if (!ok) return false;

        _monsters = global.SpawnManager.getAliveMonsters();
        _bindEvents();
        _isRunning = true;
        global.EventBus.emit('battle:started', { mapId: _mapId });
        return true;
    }

    function update(delta) {
        if (!_isRunning) return;
        var player = _getPlayerUnit();
        if (!player) return;

        _monsters = global.SpawnManager.getAliveMonsters();

        if (global.PlayerAI) {
            global.PlayerAI.update(delta, player, _monsters, _playerPos);
        }

        if (global.MonsterAI) {
            var allyTargets = (global.PartnerManager && typeof global.PartnerManager.getAllyTargets === 'function')
                ? global.PartnerManager.getAllyTargets() : null;
            global.MonsterAI.update(delta, _monsters, _playerPos, allyTargets);
        }

        if (global.PartnerManager && typeof global.PartnerManager.update === 'function') {
            global.PartnerManager.update(delta, _monsters, _playerPos);
        }

        global.SpawnManager.update(delta);

        // 刚性分离（怪物之间）
        _separateMonsters();

        _updateSkillStatus(); // 添加此行
    }

    function stop() {
        if (!_isRunning) return;
        _isRunning = false;
        _isRespawning = false;

        if (_respawnTimerId) {
            clearTimeout(_respawnTimerId);
            _respawnTimerId = null;
        }

        _unbindEvents();
        if (global.SpawnManager) global.SpawnManager.reset();
        _monsters = [];

        if (global.SkillScheduler && typeof global.SkillScheduler.clearCombatState === 'function') {
            global.SkillScheduler.clearCombatState();
        }
        _resetSkillStatus();

        global.EventBus.emit('battle:stopped');
    }

    function isRunning() { return _isRunning; }
    function getMonsters() { return _monsters; }
    function getPlayerPos() { return { x: _playerPos.x, y: _playerPos.y }; }
    function getPlayerWorldPos() { return { x: _playerPos.x, y: _playerPos.y }; }
    function setPlayerPos(x, y) { _playerPos.x = x; _playerPos.y = y; }
    function getMapId() { return _mapId; }
    function getSkillStatus() { return { ..._skillStatus }; }

    global.BattleController = {
        start: start,
        update: update,
        stop: stop,
        isRunning: isRunning,
        getMonsters: getMonsters,
        getPlayerPos: getPlayerPos,
        getPlayerWorldPos: getPlayerWorldPos,
        setPlayerPos: setPlayerPos,
        getMapId: getMapId,
        getSkillStatus: getSkillStatus,
    };

    console.log('[BattleController] ✅ 已加载（精简版）');
})(window);
