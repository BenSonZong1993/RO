// ============================================================
//  📁 js/battle/MonsterAI.js
//  怪物 AI 行为控制（配表驱动 + 碰撞预检测）
//  说明：所有移动由 MonsterFormationController 计算，移动前检测碰撞
// ============================================================
(function(global) {
    'use strict';

    // ============================================================
    //  📋 怪物 AI 配置项表（策划可在此修改数值）
    //  说明：以下字段为默认值，若 ConfigProfileManager 提供覆盖值则优先使用覆盖值
    // ============================================================
    var MONSTER_AI_CONFIG_TABLE = {
        attackRange: 1,                 // 攻击范围（单元格数，实际像素 = 该值 × PIXELS_PER_CELL）此处配置疑似未生效
        attackInterval: 1.5,            // 攻击间隔（秒）
        minAttackInterval: 0.3,         // 最小攻击间隔（秒），防止攻击过于频繁
        playerCollisionRadius: 24,      // 玩家碰撞半径（像素）
        monsterCollisionRadius: 24,     // 怪物碰撞半径（像素）
    };

    // ---- 读取怪物基础配置（攻击范围、攻击间隔等） ----
    function _getMonsterAIConfig() {
        var PIXELS_PER_CELL = (global.SKILL_CONFIG && global.SKILL_CONFIG.PIXELS_PER_CELL) || RO_CONSTANTS.DEFAULT_ATTACK_RANGE;

        // 使用配置表默认值（后续可被 ConfigProfileManager 覆盖）
        var defaultCfg = {
            attackRange: MONSTER_AI_CONFIG_TABLE.attackRange,
            attackInterval: MONSTER_AI_CONFIG_TABLE.attackInterval,
            minAttackInterval: MONSTER_AI_CONFIG_TABLE.minAttackInterval,
        };

        if (!global.ConfigProfileManager) {
            var result = {};
            for (var key in defaultCfg) result[key] = defaultCfg[key];
            result.attackRange *= PIXELS_PER_CELL;
            return result;
        }

        var profile = global.ConfigProfileManager.getCurrentProfile();
        if (!profile || !profile.monster || !profile.monster.ai) {
            var result = {};
            for (var key in defaultCfg) result[key] = defaultCfg[key];
            result.attackRange *= PIXELS_PER_CELL;
            return result;
        }

        var ai = profile.monster.ai;
        var result = {};
        for (var key in defaultCfg) {
            result[key] = ai[key] !== undefined ? ai[key] : defaultCfg[key];
        }

        if (profile.char && profile.char.battle && profile.char.battle.minAttackInterval !== undefined) {
            result.minAttackInterval = profile.char.battle.minAttackInterval;
        }

        if (result.attackRange < 10) result.attackRange *= PIXELS_PER_CELL;
        return result;
    }

    function distSq(ax, ay, bx, by) {
        var dx = bx - ax;
        var dy = by - ay;
        return dx * dx + dy * dy;
    }

    // ---- 碰撞预检测（移动前） ----
    function _willCollide(x, y, self, monsters, playerPos) {
        // 使用配置表默认值，后续可被 ConfigProfileManager 覆盖
        var pRadius = MONSTER_AI_CONFIG_TABLE.playerCollisionRadius;
        var mRadius = MONSTER_AI_CONFIG_TABLE.monsterCollisionRadius;

        if (global.ConfigProfileManager) {
            var prof = global.ConfigProfileManager.getCurrentProfile();
            if (prof) {
                if (prof.char && prof.char.collision && typeof prof.char.collision.radiusPx === 'number') {
                    pRadius = prof.char.collision.radiusPx;
                }
                if (prof.monster && prof.monster.formation && typeof prof.monster.formation.collisionRadiusPx === 'number') {
                    mRadius = prof.monster.formation.collisionRadiusPx;
                }
            }
        }

        // 检测玩家
        if (playerPos) {
            var dx = x - playerPos.x;
            var dy = y - playerPos.y;
            if (dx * dx + dy * dy < (pRadius + mRadius) * (pRadius + mRadius)) {
                return true;
            }
        }

        // 检测其他怪物
        if (monsters && monsters.length > 0) {
            for (var i = 0; i < monsters.length; i++) {
                var other = monsters[i];
                if (other === self || !other.alive) continue;
                var dx = x - other.x;
                var dy = y - other.y;
                if (dx * dx + dy * dy < (mRadius + mRadius) * (mRadius + mRadius)) {
                    return true;
                }
            }
        }
        return false;
    }

    // ---- 主更新 ----
    function update(delta, monsters, playerPos, allyTargets) {
        if (!monsters || monsters.length === 0) return;
        if (!playerPos) return;

        var cfg = _getMonsterAIConfig();
        var allies = Array.isArray(allyTargets) ? allyTargets : [];

        for (var i = 0; i < monsters.length; i++) {
            var mon = monsters[i];
            if (!mon.alive || !mon.visible) continue;

            // 硬控跳过
            if (mon.sc && typeof mon.sc.hasSCE === 'function') {
                if (mon.sc.hasSCE(SC_CONSTANTS.Stun) ||
                    mon.sc.hasSCE(SC_CONSTANTS.Freeze) ||
                    mon.sc.hasSCE(SC_CONSTANTS.Stone) ||
                    mon.sc.hasSCE(SC_CONSTANTS.Sleep) ||
                    mon.sc.hasSCE(SC_CONSTANTS.Deepsleep)) {
                    continue;
                }
            }

            if (mon._attackCooldown === undefined) mon._attackCooldown = 0;
            mon._attackCooldown -= delta;
            var minInterval = cfg.minAttackInterval || 0.3;
            var monsterInterval = mon.attackInterval || cfg.attackInterval;

            // 目标选择（玩家或佣兵）
            var targetPos = playerPos;
            var targetKind = 'player';
            var distToTargetSq = distSq(mon.x, mon.y, playerPos.x, playerPos.y);
            for (var a = 0; a < allies.length; a++) {
                var ally = allies[a];
                if (!ally || ally.x === undefined) continue;
                var dAllySq = distSq(mon.x, mon.y, ally.x, ally.y);
                if (dAllySq < distToTargetSq) {
                    distToTargetSq = dAllySq;
                    targetPos = ally;
                    targetKind = ally.kind || 'merc';
                }
            }

            var effectiveAttackRange = (mon.attackRange || cfg.attackRange);

            // 攻击判定
            if (distToTargetSq <= effectiveAttackRange * effectiveAttackRange) {
                if (mon._attackCooldown <= 0) {
                    global.EventBus.emit('battle:monsterAttack', {
                        monster: mon,
                        damage: 0,
                        targetKind: targetKind
                    });
                    mon._attackCooldown = Math.max(minInterval, monsterInterval);
                }
            } else {
                // 移动：由调度层计算位移
                var formationConfig = mon._formationConfig || null;
                var sameWave = [];
                if (formationConfig && mon._formationId !== undefined) {
                    if (global.SpawnManager && typeof global.SpawnManager.getMonstersByFormationId === 'function') {
                        sameWave = global.SpawnManager.getMonstersByFormationId(mon._formationId);
                    }
                }

                var move = global.MonsterFormationController.calculateMovement(
                    mon,
                    playerPos.x, playerPos.y,
                    sameWave,
                    formationConfig,
                    delta
                );

                // 移动前碰撞检测：若新位置与玩家或其他怪物重叠，则原地不动
                // 直接应用移动增量（碰撞由分离力和玩家侧处理）
                mon.x += move.dx;
                mon.y += move.dy;
                mon.state = 'chase';
            }
        }
    }

    // ---- 受击强制追击 ----
    function markAggro(monster, duration) {
        if (!monster) return;
        monster._aggroTimer = duration || 5.0;
        if (!monster.alive || !monster.visible) {
            monster._aggroTimer = 0;
        }
    }

    global.MonsterAI = {
        update: update,
        markAggro: markAggro,
        getMonsterAIConfig: _getMonsterAIConfig,
    };

    console.log('[MonsterAI] ✅ 已加载');
})(window);