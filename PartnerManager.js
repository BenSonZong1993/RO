// ============================================================
//  FILE: js/battle/PartnerManager.js
//  队友佣兵（SO_PARTNER）：把组队对方的快照作为召唤物驱动的管理器
//  架构（docs/组队功能实施方案.md）：结算核心 100% 复用（rAthenaEngine.calculateDamage
//        + BattleController 伤害通道 battle:playerAttack[data.attacker] + _applyDamageToMonster
//        的死亡归属），本模块只做"按单位驱动"：索敌/移动/技能决策/咏唱计时/本地CD/SP。
//        后续怪物施法复用同一驱动模板（caster 参数化）。
//  权限：battle 域（经 EventBus 与 BattleController 事件交互；不直改角色数据）
//  依赖：SocialService（队伍/快照）、SkillGateway（技能数据）、rAthenaEngine、EventBus、
//        BattleController（存活/玩家坐标/战斗配置）
//  事件：发 partner:summoned / partner:despawned {reason}；收 battle:started/stopped、social:party-ended
// ============================================================
(function(global) {
    'use strict';

    // ---- 配置（真全局常数；服务器侧镜像常量见 docs/组队功能实施方案.md） ----
    var CONFIG = {
        expMultiplier: 0.75,     // 组队期间全局经验影子惩罚（base/job 同乘）
        moveSpeed: 90,           // 佣兵移速 px/s
        followDistance: 70,      // 无怪时贴近玩家的距离
        leashRange: 420,         // 距玩家拴绳（超出则放弃目标回归）
        spRegenPct: 0.02,        // 每秒回蓝（maxSP 百分比）
        // ★ 新增：召唤独立冷却（毫秒），不与技能策略组混用
        summonCooldownMs: 20000, // 20 秒
    };

    var _summoned = false;      // 佣兵当前在场
    var _summonWanted = false;  // 玩家意图（战斗结束/重开时自动恢复）
    var _merc = null;           // 佣兵 unit（形状对齐 BattleController._getPlayerUnit + 引擎扩展字段）
    var _snapshot = null;       // 召唤所用快照
    var _stance = null;         // 站位/朝向（ConfigProfiles.PartnerConfig 按职业+武器算出）
    // ★ 移除旧 _deadUntil，改用独立冷却
    var _summonCooldownUntil = 0; // 召唤技能冷却结束时间戳
    var _summoning = false;     // 防并发召唤
    var _ebListeners = [];

    // ---- 站位/朝向（策划配置 ConfigProfiles.PartnerConfig：先职业后武器覆盖） ----
    function _computeStance() {
        var pc = global.PartnerConfig || {};
        var s = _snapshot || {};
        var jobKey = s.jobKey || 'Novice';
        var rangedJobs = pc.rangedJobs || [];
        var rangedWeapons = pc.rangedWeapons || [];
        var isRanged = rangedJobs.indexOf(jobKey) !== -1;
        var weaponType = (s.finalStats && s.finalStats.weaponType) || 'None';
        if (rangedWeapons.indexOf(weaponType) !== -1) isRanged = true;   // 法杖/弓等明确转远程站位
        var grp = isRanged ? (pc.ranged || {}) : (pc.melee || {});
        _stance = {
            ranged: isRanged,
            offsetX: grp.offsetX || 0,
            offsetY: grp.offsetY || 0,
            partnerWeaponDir: (grp.partnerWeaponDir === -1) ? -1 : (grp.partnerWeaponDir === 1 ? 1 : 0),
            playerWeaponDir: (grp.playerWeaponDir === 1) ? 1 : (grp.playerWeaponDir === -1 ? -1 : 0),
        };
    }

    function _inParty() {
        return !!(global.SocialService && global.SocialService.inParty());
    }

    // ---- 对外：组队期间全局经验影子惩罚（LootManager 消费） ----
    function getExpMultiplier() {
        return _inParty() ? CONFIG.expMultiplier : 1.0;
    }

    function isSummoned() { return _summoned && !!_merc; }
    function isSummonWanted() { return _summonWanted; }
    function isActive() { return _inParty(); }

    // ★ 新增：获取冷却剩余毫秒（用于 UI 显示，可选）
    function getCooldownRemaining() {
        var remaining = _summonCooldownUntil - Date.now();
        return remaining > 0 ? remaining : 0;
    }

    // ============================================================
    //  召唤 / 召回（SO_PARTNER 的施放入口）
    // ============================================================
    function toggle() {
        if (_summoned) {
            despawn('manual');
            return Promise.resolve({ success: true, summoned: false });
        }
        return summon().then(function(ok) {
            return { success: ok, summoned: _summoned };
        });
    }

    function summon() {
        // ★ 新增冷却检查
        if (_summoned || _summoning) return Promise.resolve(false);
        if (!_inParty()) return Promise.resolve(false);
        if (Date.now() < _summonCooldownUntil) return Promise.resolve(false);
        if (!global.SocialService || typeof global.SocialService.getPartnerSnapshot !== 'function') {
            return Promise.resolve(false);
        }
        _summoning = true;
        return global.SocialService.getPartnerSnapshot().then(function(res) {
            _summoning = false;
            if (!res || !res.ok || !res.snapshot) return false;
            _snapshot = res.snapshot;
            _computeStance();
            _spawnMerc();
            return true;
        }).catch(function() {
            _summoning = false;
            return false;
        });
    }

    function _spawnMerc() {
        var s = _snapshot;
        if (!s) return;
        var pos = (global.BattleController && global.BattleController.getPlayerPos)
            ? global.BattleController.getPlayerPos() : { x: 400, y: 300 };
        var fs = s.finalStats || {};
        var finalATK = fs.finalATK || 10;
        var maxHp = fs.finalMaxHP || 100;
        _merc = {
            id: 'merc_partner',
            type: 'merc', faction: 'ally',
            name: s.name || '队友',
            level: s.level || 1,
            jobKey: s.jobKey || 'Novice',
            gender: (s.gender === 'female') ? 'female' : 'male',
            x: pos.x + 56,
            y: pos.y + 24,
            hp: Math.max(1, Math.min(s.hp || maxHp, maxHp)),
            maxHp: maxHp,
            sp: Math.max(0, Math.min(s.sp || 0, fs.finalMaxSP || 50)),
            maxSp: fs.finalMaxSP || 50,
            atk: finalATK,
            def: fs.finalDEF || 0,
            hit: fs.panelHIT || 100,
            flee: fs.panelFLEE || 100,
            attackRange: fs.attackRange || RO_CONSTANTS.DEFAULT_ATTACK_RANGE,
            attackInterval: Math.max(0.3, Math.min(2.0, fs.attackInterval || 0.8)),
            _finalStats: {
                statusATK: Math.floor(finalATK * 0.4),
                equipATK: Math.ceil(finalATK * 0.6),
                finalATK: finalATK,
                attackElement: fs.attackElement || 'Neutral',
                attackElementLevel: 1,
            },
            race: 'DemiHuman', element: fs.attackElement || 'Neutral', elementLevel: 1, size: 'Medium',
            learnedSkills: s.learnedSkills || {},
            autoSkill: s.autoSkill || { skills: [], strategy: 'priority', enabled: true },
            _attackCooldown: 1.0,
            _cast: null,
            _cooldowns: {},
        };
        _summoned = true;
        _summonWanted = true;
        // ★ 设置召唤技能冷却（独立于其他技能）
        _summonCooldownUntil = Date.now() + CONFIG.summonCooldownMs;
        if (global.EventBus) global.EventBus.emit('partner:summoned', { name: _merc.name, level: _merc.level });
    }

    function despawn(reason) {
        if (!_summoned && !_merc) return;
        _summoned = false;
        _merc = null;
        if (reason === 'manual' || reason === 'party-ended') _summonWanted = false;
        // ★ 死亡/战斗结束等保持 _summonWanted = true，便于自动复活
        if (global.EventBus) global.EventBus.emit('partner:despawned', { reason: reason || 'unknown' });
    }

    // ---- 服务器怪物攻击入口（BattleController 按 targetKind 分流至此） ----
    function getMercDef() { return (_merc && _merc.def) || 0; }

    function takeDamage(damage, monster) {
        if (!_summoned || !_merc) return;
        _merc.hp = Math.max(0, _merc.hp - damage);
        if (global.BattleEffectsManager) {
            var cfg = (global.BattleController && global.BattleController.getBattleConfig) || null;
            var scale = (cfg && cfg.damageScalePlayer) || 0.75;
            global.BattleEffectsManager.addDamage(_merc.x, _merc.y, damage, false, scale);
        }
        if (_merc.hp <= 0) {
            despawn('dead');
            // ★ 不再设置 _deadUntil，冷却由 _summonCooldownUntil 管理
            // ★ 死亡不会重置冷却，冷却计时继续走，冷却结束后自动复活（若条件满足）
        }
    }

    // ============================================================
    //  驱动循环（BattleController.update 每帧调用）
    // ============================================================
    function update(delta, monsters, playerPos) {
        // ★ 新增：自动复活检查（完全独立，不与技能策略组耦合）
        if (!_summoned && _summonWanted && _inParty() && Date.now() >= _summonCooldownUntil) {
            var char = global.CharRepository ? global.CharRepository.getLiveRef() : null;
            if (char && char.hp > 0 && global.BattleController && global.BattleController.isRunning()) {
                if (_snapshot) {
                    // 使用缓存的快照直接召唤，不发起异步请求，避免网络延迟
                    _spawnMerc();
                    // 触发事件便于 UI 更新
                    if (global.EventBus) global.EventBus.emit('partner:respawned', { auto: true });
                }
            }
        }

        if (!_summoned || !_merc) return;
        if (!global.BattleController || !global.BattleController.isRunning()) return;
        if (!_inParty()) { despawn('party-ended'); return; }
        var m = _merc;
        var now = Date.now();

        // 回蓝
        m.sp = Math.min(m.maxSp, m.sp + m.maxSp * CONFIG.spRegenPct * delta);

        // 咏唱中：不移动不普攻，咏唱结束结算
        if (m._cast) {
            if (now >= m._cast.until) {
                var c = m._cast;
                m._cast = null;
                _executeSkill(c.skillId, c.skillLevel, c.target);
            }
            return;
        }

        // 目标：最近活怪
        var target = null;
        var bestSq = Infinity;
        var list = monsters || [];
        for (var i = 0; i < list.length; i++) {
            var mon = list[i];
            if (!mon.alive || !mon.visible) continue;
            var dx = mon.x - m.x;
            var dy = mon.y - m.y;
            var d2 = dx * dx + dy * dy;
            if (d2 < bestSq) { bestSq = d2; target = mon; }
        }

        // 无怪/超拴绳：回归玩家站位锚点
        var anchorX = playerPos.x + (_stance ? _stance.offsetX : 0);
        var anchorY = playerPos.y + (_stance ? _stance.offsetY : 0);
        var pdx = anchorX - m.x;
        var pdy = anchorY - m.y;
        var pdSq = pdx * pdx + pdy * pdy;
        if (!target || bestSq > CONFIG.leashRange * CONFIG.leashRange) {
            if (pdSq > CONFIG.followDistance * CONFIG.followDistance) {
                var pd = Math.sqrt(pdSq);
                m.x += pdx / pd * CONFIG.moveSpeed * delta;
                m.y += pdy / pd * CONFIG.moveSpeed * delta;
            }
            return;
        }

        var dist = Math.sqrt(bestSq);
        if (dist > m.attackRange) {
            var spd = CONFIG.moveSpeed * delta;
            if (dist > spd) {
                m.x += (target.x - m.x) / dist * spd;
                m.y += (target.y - m.y) / dist * spd;
            } else {
                m.x = target.x;
                m.y = target.y;
            }
            return;
        }

        // 攻击节奏
        m._attackCooldown -= delta;
        if (m._attackCooldown > 0) return;

        var skill = _pickSkill();
        if (skill) {
            _startCast(skill.id, skill.level, target);
            return;
        }
        _basicAttack(target);
        m._attackCooldown = m.attackInterval;
    }

    // ---- 技能决策（复用对方 autoSkill 配置；priority 顺序取第一个可施放的） ----
    function _pickSkill() {
        var m = _merc;
        var cfg = m.autoSkill;
        if (!cfg || !cfg.enabled || !Array.isArray(cfg.skills) || cfg.skills.length === 0) return null;
        var now = Date.now();
        for (var i = 0; i < cfg.skills.length; i++) {
            var skillId = cfg.skills[i];
            var level = (m.learnedSkills && m.learnedSkills[skillId]) || 0;
            if (level <= 0) continue;
            if (m._cooldowns[skillId] && m._cooldowns[skillId] > now) continue;
            var merged = global.SkillGateway ? global.SkillGateway.getMergedSkillData(skillId, level) : null;
            if (!merged) continue;
            var spCost = merged.spCost || 0;
            if (m.sp < spCost) continue;
            if (_skillDamageRatio(merged) <= 0 && !(merged.statusName || merged.status)) continue;
            return { id: skillId, level: level };
        }
        return null;
    }

    function _skillDamageRatio(merged) {
        var v = (merged.skillDamage !== undefined) ? merged.skillDamage
            : (merged.Damage !== undefined) ? merged.Damage : 0;
        return Number(v) || 0;
    }

    function _mergedOf(skillId, level) {
        return global.SkillGateway ? global.SkillGateway.getMergedSkillData(skillId, level) : null;
    }

    function _skillSeconds(merged, msField, sField, dft) {
        var v = Number(merged[msField] !== undefined ? merged[msField] : merged[sField]) || 0;
        if (v > 10) v = v / 1000;
        if (v < 0) v = 0;
        return Math.min(v, CONFIG.maxCastSeconds) || dft || 0;
    }

    function _startCast(skillId, level, target) {
        var merged = _mergedOf(skillId, level);
        if (!merged) { _basicAttack(target); return; }
        var m = _merc;
        var castSec = _skillSeconds(merged, 'castTime', 'CastTime', 0);
        if (castSec > 0) {
            m._cast = { until: Date.now() + castSec * 1000, skillId: skillId, skillLevel: level, target: target };
            if (global.BattleEffectsManager) {
                global.BattleEffectsManager.addSkillName({ x: m.x, y: m.y - 40 }, (merged.DisplayName || skillId) + '…');
            }
            return;
        }
        _executeSkill(skillId, level, target);
    }

    function _executeSkill(skillId, level, target) {
        var m = _merc;
        if (!target || !target.alive) { m._attackCooldown = 0.3; return; }
        var merged = _mergedOf(skillId, level);
        if (!merged) { _basicAttack(target); return; }
        var spCost = merged.spCost || 0;
        if (m.sp < spCost) { m._attackCooldown = 0.3; return; }
        m.sp -= spCost;
        var cdSec = _skillSeconds(merged, 'cooldown', 'Cooldown', 0);
        if (cdSec > 0) m._cooldowns[skillId] = Date.now() + cdSec * 1000;
        _dealDamage(target, {
            skillName: merged.DisplayName || skillId,
            isSkill: true,
            effectiveAtk: m.atk,
            skillDamage: _skillDamageRatio(merged),
            hitCount: Math.abs(merged.hitCount || 1) || 1,
            attackElem: merged.attackElement || m._finalStats.attackElement || 'Neutral',
            elemLevel: 1,
            weaponType: 'Fist',
        });
        m._attackCooldown = Math.max(m.attackInterval, 0.6);
    }

    function _basicAttack(target) {
        _dealDamage(target, {
            skillName: '普攻',
            isSkill: false,
            effectiveAtk: _merc.atk,
            skillDamage: 0,
            hitCount: 1,
            attackElem: _merc._finalStats.attackElement || 'Neutral',
            elemLevel: 1,
            weaponType: 'Fist',
        });
    }

    // ---- 结算走共用核心：rAthenaEngine 计算 → battle:playerAttack（attacker=佣兵）→
    //      BattleController._applyDamageToMonster 死亡归属自动为战斗主人（邀请方） ----
    function _dealDamage(target, p) {
        if (!target || !target.alive) return;
        if (!global.rAthena || !global.rAthena.engine || typeof global.rAthena.engine.calculateDamage !== 'function') return;
        var result = global.rAthena.engine.calculateDamage(_merc, target, p.effectiveAtk, {
            weaponType: p.weaponType,
            attackElem: p.attackElem,
            elemLevel: p.elemLevel,
            skillDamage: p.skillDamage,
            hitCount: p.hitCount,
            hitType: 'Single',
        });
        if (!global.EventBus) return;
        global.EventBus.emit('battle:playerAttack', {
            attacker: _merc,
            target: target,
            damage: result.damage,
            hitResults: result.details && result.details.hitResults,
            isSkill: p.isSkill,
            skillName: p.skillName,
            isSplash: false,
            splashArea: 0,
        });
    }

    // ---- 渲染数据（init.js gameLoop 组装 state.partner） ----
    function getRenderState() {
        if (!_summoned || !_merc) return null;
        return {
            x: _merc.x, y: _merc.y,
            hp: _merc.hp, maxHp: _merc.maxHp, sp: _merc.sp, maxSp: _merc.maxSp,
            name: _merc.name, level: _merc.level,
            gender: _merc.gender,
            weaponDir: _stance ? _stance.partnerWeaponDir : 0,
        };
    }

    function getPlayerWeaponDir() {
        return (_summoned && _stance) ? _stance.playerWeaponDir : 0;
    }

    function getAllyTargets() {
        if (!_summoned || !_merc) return null;
        return [{ x: _merc.x, y: _merc.y, kind: 'merc' }];
    }

    // ============================================================
    //  事件接线
    // ============================================================
    function _bind() {
        if (!global.EventBus) return;
        var onBattleStopped = function() { despawn('battle-end'); };
        global.EventBus.on('battle:stopped', onBattleStopped);
        _ebListeners.push({ event: 'battle:stopped', fn: onBattleStopped });

        var onPlayerDead = function() { despawn('player-down'); };
        global.EventBus.on('char:dead', onPlayerDead);
        _ebListeners.push({ event: 'char:dead', fn: onPlayerDead });

        var onBattleStarted = function() {
            // ★ 战斗开始时，如果 _summonWanted 为 true 且冷却已过，则自动召唤（由 update 驱动，此处无需重复）
            // 但为了立即触发，可以设置一个标记，update 会在下一帧处理
            // 无需额外操作，update 会检查条件
        };
        global.EventBus.on('battle:started', onBattleStarted);
        _ebListeners.push({ event: 'battle:started', fn: onBattleStarted });

        var onPartyEnded = function() {
            if (_summoned) despawn('party-ended');
            _summonWanted = false;
        };
        global.EventBus.on('social:party-ended', onPartyEnded);
        _ebListeners.push({ event: 'social:party-ended', fn: onPartyEnded });
    }

    function dispose() {
        for (var i = 0; i < _ebListeners.length; i++) {
            if (global.EventBus && global.EventBus.off) global.EventBus.off(_ebListeners[i].event, _ebListeners[i].fn);
        }
        _ebListeners = [];
        _summoned = false;
        _merc = null;
        _summonWanted = false;
    }

    if (global.EventBus) _bind();

    // ★ 对外暴露新接口（可选）
    global.PartnerManager = {
        toggle: toggle,
        summon: summon,
        despawn: despawn,
        isSummoned: isSummoned,
        isSummonWanted: isSummonWanted,
        isActive: isActive,
        getExpMultiplier: getExpMultiplier,
        getMercDef: getMercDef,
        takeDamage: takeDamage,
        update: update,
        getRenderState: getRenderState,
        getAllyTargets: getAllyTargets,
        getPlayerWeaponDir: getPlayerWeaponDir,
        getCooldownRemaining: getCooldownRemaining, // ★ 新增
        dispose: dispose,
    };

    console.log('[PartnerManager] ✅ 已加载（队友佣兵：快照召唤 + 独立冷却 + 自动复活）');
})(window);