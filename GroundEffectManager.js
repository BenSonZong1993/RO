// ============================================================
//  FILE: GroundEffectManager.js
//  LAYER: battle（轻量管理器：地面持续效果——火墙/光耀之堂/暴风雪类残留）
//  权限：char:addHp（治疗 tick 经 CharacterContext 过闸）
//  依赖：EventBus、BattleController（怪物列表）、rAthena.engine（伤害复用）、
//        CharacterContext（治疗）、BattleEffectsManager（视觉反馈）、AttributeNormalizer
//  职责：只管理 位置/持续时间/伤害与治疗间隔/tick 触发；
//        伤害计算复用 rAthena 引擎，结算复用 battle:playerAttack 事件
//        （击杀/掉落/状态由 BattleController 既有链路处理），不改战斗循环核心
//  配置来源：SKILL_PATCHES[skill].ground（由 SkillExecutor 施放时调用 spawn）
//  生命周期：battle:stopped 自动清空
// ============================================================
(function(global) {
    'use strict';

    var _effects = [];       // 活跃地面效果列表
    var _nextId = 1;

    function _snapshotCaster() {
        return global.CharRepository ? global.CharRepository.getLiveRef() : null;
    }

    // ============================================================
    //  施放一个地面效果
    //  options: {
    //    skillAegis, x, y,
    //    radiusCells, durationMs, tickMs,
    //    damageRatioPerTick, element,      // 伤害 tick（可选）
    //    healPercentPerTick                // 治疗 tick（可选）
    //  }
    // ============================================================
    function spawn(options) {
        if (!options || !(options.damageRatioPerTick > 0 || options.healPercentPerTick > 0)) {
            return null;
        }
        var cellPx = global.AttributeNormalizer ? global.AttributeNormalizer.cellToPixel(1) : RO_CONSTANTS.PIXELS_PER_CELL;
        var effect = {
            id: _nextId++,
            skillAegis: options.skillAegis || 'ground',
            x: options.x || 0,
            y: options.y || 0,
            radiusPx: Math.max(cellPx, (options.radiusCells || 1) * cellPx),
            durationMs: options.durationMs || 10000,
            tickMs: options.tickMs || 1000,
            damageRatioPerTick: options.damageRatioPerTick || 0,
            healPercentPerTick: options.healPercentPerTick || 0,
            element: options.element || 'Neutral',
            elapsed: 0,
            tickAccum: 0,
            casterName: (function() {
                var c = _snapshotCaster();
                return c ? (c.name || '冒险者') : '冒险者';
            })(),
        };
        _effects.push(effect);

        // 视觉反馈：施放瞬间在地面位置显示技能名
        if (global.BattleEffectsManager && typeof global.BattleEffectsManager.addSkillName === 'function') {
            global.BattleEffectsManager.addSkillName({ x: effect.x, y: effect.y - 20 }, effect.skillAegis);
        }
        return effect.id;
    }

    // ---- 单次 tick：范围伤害 + 范围治疗 ----
    function _tick(effect) {
        var monsters = (global.BattleController && typeof global.BattleController.getMonsters === 'function')
            ? global.BattleController.getMonsters() : [];

        // ---- 伤害 tick：范围内存活怪物，伤害经 rAthena 引擎逐只计算，
        //      结算复用 battle:playerAttack（非溅射路径：击杀/掉落/状态闭环复用） ----
        if (effect.damageRatioPerTick > 0 && global.rAthena && global.rAthena.engine) {
            var caster = _snapshotCaster();
            if (caster) {
                for (var i = 0; i < monsters.length; i++) {
                    var mon = monsters[i];
                    if (!mon.alive || !mon.visible) continue;
                    var dx = mon.x - effect.x;
                    var dy = mon.y - effect.y;
                    if (Math.sqrt(dx * dx + dy * dy) > effect.radiusPx) continue;

                    var result = global.rAthena.engine.calculateDamage(caster, mon, 1, {
                        weaponType: 'Fist',
                        attackElem: effect.element,
                        elemLevel: 1,
                        skillDamage: effect.damageRatioPerTick,
                        hitCount: 1,
                        hitType: 'Single',
                    });
                    global.EventBus.emit('battle:playerAttack', {
                        target: mon,
                        damage: result.damage,
                        isSkill: true,
                        skillName: effect.skillAegis,
                        status: null,
                        statusChance: 0,
                    });
                }
            }
        }

        // ---- 治疗 tick：玩家在范围内则恢复（简化：地面效果归属施放者，始终治疗施放者） ----
        if (effect.healPercentPerTick > 0 && global.CharacterContext) {
            var stats = global.AttributeGateway ? global.AttributeGateway.getAll('GroundEffectManager') : null;
            var maxHP = stats ? (stats.finalMaxHP || 100) : 100;
            var heal = Math.floor(maxHP * effect.healPercentPerTick);
            if (heal > 0) {
                global.CharacterContext.restoreResource('hp', heal, 'GroundEffectManager');
            }
        }
    }

    // ---- 主循环驱动（由 init.js 游戏循环调用） ----
    function update(deltaMs) {
        if (_effects.length === 0) return;
        var delta = deltaMs || 0;
        for (var i = _effects.length - 1; i >= 0; i--) {
            var effect = _effects[i];
            effect.elapsed += delta;
            effect.tickAccum += delta;
            if (effect.tickAccum >= effect.tickMs) {
                effect.tickAccum -= effect.tickMs;
                try { _tick(effect); } catch (e) {
                    console.error('[GroundEffectManager] tick 异常:', e);
                }
            }
            if (effect.elapsed >= effect.durationMs) {
                _effects.splice(i, 1);
            }
        }
    }

    function clear() { _effects = []; }
    function getActiveCount() { return _effects.length; }
    function getActive() {
        return _effects.map(function(e) {
            return { id: e.id, skillAegis: e.skillAegis, x: e.x, y: e.y, elapsed: e.elapsed, durationMs: e.durationMs };
        });
    }

    // ---- 战斗停止自动清空（生命周期自管理） ----
    function _init() {
        if (global.EventBus) {
            global.EventBus.on('battle:stopped', clear);
        }
    }

    var GroundEffectManager = {
        spawn: spawn,
        update: update,
        clear: clear,
        getActiveCount: getActiveCount,
        getActive: getActive,
    };

    _init();
    global.GroundEffectManager = GroundEffectManager;
    console.log('[GroundEffectManager] ✅ 已加载（地面持续效果管理器）');
})(window);
