// ============================================================
//  FILE: CharController.js
//  LAYER: controllers（角色控制器——轻量路由；业务在 Service/Context）
//  权限：char:* 系列（经 AccessControl；具体校验在 Service/Context 入口）
//  依赖：CharRepository、CharacterContext、CharService、AttributeGateway、AttributeMediator、
//        InventoryService、EventBus、CanvasRenderer（healFull 强制渲染）
//  契约（v4.0 精简版；蓝图 3.2）：
//    保留：load, save, getChar, updateFinalStats, addExp, allocateStat, consumeSP,
//          takeDamage, healFull, updateRegen, setInvincible, getZeny, addZeny,
//          deductZeny, addHp, addSp, updateAutoConsumeRules, updateAutoSkillConfig
//    移除：performRebirth（→RebirthService）、changeJob（→JobChangeService）、
//          resetChar（→CharacterContext.resetCharacter）、learnSkill（→SkillService）
//  规则：数据流 Controller → Service/Context → Gateway → Repository；UI 经 EventBus
// ============================================================
(function(global) {
    'use strict';

    var _invincibleUntil = 0;

    function _repo() { return global.CharRepository; }

    function _safeCall(obj, method) {
        var args = Array.prototype.slice.call(arguments, 2);
        if (obj && typeof obj[method] === 'function') {
            return obj[method].apply(obj, args);
        }
        return null;
    }

    // ============================================================
    //  生命周期
    // ============================================================
    function load() {
        var repo = _repo();
        if (!repo) {
            console.error('[CharController] CharRepository 未加载');
            return;
        }
        repo.load();
        setTimeout(function() {
            if (global.AttributeMediator && typeof global.AttributeMediator.forceRecalc === 'function') {
                global.AttributeMediator.forceRecalc();
            }
        }, 50);
        console.log('[CharController] 角色数据已加载');
    }

    function save() {
        return _repo() ? _repo().save() : false;
    }

    function getChar() {
        return _repo() ? _repo().getLiveRef() : null;
    }

    // ============================================================
    //  属性快照更新（网关独占 _finalStats；此处只做钳制与事件）
    // ============================================================
    function updateFinalStats(finalStats) {
        var live = getChar();
        if (!live) return false;
        if (global.AttributeGateway) {
            global.AttributeGateway._updateCache(finalStats, live);
        }
        var maxHp = _getFinalMaxHP();
        var maxSp = _getFinalMaxSP();
        if (live.hp > maxHp || live.sp > maxSp) {
            _repo().update(function(char) {
                if (char.hp > maxHp) char.hp = maxHp;
                if (char.sp > maxSp) char.sp = maxSp;
            }, 'CharController');
        }
        _safeCall(global.EventBus, 'emit', 'char:statsRecalculated', { finalStats: finalStats, version: Date.now() });
        _safeCall(global.EventBus, 'emit', 'char:changed', { char: getChar() });
        _safeCall(global.EventBus, 'emit', 'char:hpChanged', { hp: live.hp, maxHp: maxHp });
        _safeCall(global.EventBus, 'emit', 'char:spChanged', { sp: live.sp, maxSp: maxSp });
        return true;
    }

    // ============================================================
    //  最终上限读取（唯一来源 AttributeGateway）
    // ============================================================
    function _getFinalMaxHP() {
        if (global.AttributeGateway) {
            var v = global.AttributeGateway.get('finalMaxHP', 'CharController');
            if (typeof v === 'number') return v;
        }
        if (global.AttributeMediator) {
            var v2 = global.AttributeMediator.getDerivedValue('finalMaxHP');
            if (typeof v2 === 'number') return v2;
        }
        return 100;
    }

    function _getFinalMaxSP() {
        if (global.AttributeGateway) {
            var v = global.AttributeGateway.get('finalMaxSP', 'CharController');
            if (typeof v === 'number') return v;
        }
        if (global.AttributeMediator) {
            var v2 = global.AttributeMediator.getDerivedValue('finalMaxSP');
            if (typeof v2 === 'number') return v2;
        }
        return 50;
    }

    // ============================================================
    //  业务委托（蓝图：addExp/allocateStat 委托 CharService）
    // ============================================================
    function addExp(exp, jobExp) {
        if (!global.CharService || typeof global.CharService.addExp !== 'function') {
            console.error('[CharController] CharService.addExp 不可用');
            return { levelUp: false, jobLevelUp: false };
        }
        return global.CharService.addExp(exp, jobExp, 'CharController');
    }

    function allocateStat(statKey, amount) {
        if (!global.CharService || typeof global.CharService.allocateStat !== 'function') {
            console.error('[CharController] CharService.allocateStat 不可用');
            return false;
        }
        return global.CharService.allocateStat(statKey, amount, 'CharController');
    }

    function consumeSP(amount) {
        if (!global.CharacterContext) return false;
        return global.CharacterContext.consumeSP(amount, 'CharController');
    }

    function takeDamage(damage) {
        var live = getChar();
        if (!live) return;
        if (Date.now() < _invincibleUntil) {
            console.log('[takeDamage] 无敌保护，伤害忽略:', damage);
            return;
        }
        if (!global.CharacterContext) {
            console.error('[CharController] CharacterContext 不可用');
            return;
        }
        var result = global.CharacterContext.restoreResource('hp', -damage, 'CharController');
        var hp = result.newValue;
        if (hp <= 0) {
            _safeCall(global.EventBus, 'emit', 'char:dead', { char: getChar() });
        }
    }

    function healFull() {
        var live = getChar();
        if (!live) return;

        if (global.AttributeMediator && typeof global.AttributeMediator.forceRecalc === 'function') {
            global.AttributeMediator.forceRecalc();
        } else if (global.AttributeMediator) {
            global.AttributeMediator.requestRecalc('heal', {});
        }

        setTimeout(function() {
            var maxHp = _getFinalMaxHP();
            var maxSp = _getFinalMaxSP();

            if (_repo()) {
                _repo().update(function(char) {
                    char.hp = maxHp;
                    char.sp = maxSp;
                }, 'CharController');
            }
            _invincibleUntil = Date.now() + 1000; // 复活无敌保护（规则 A3）

            var bus = global.EventBus;
            if (bus) {
                bus.emit('char:changed', { char: getChar() });
                bus.emit('char:hpChanged', { hp: maxHp, maxHp: maxHp });
                bus.emit('char:spChanged', { sp: maxSp, maxSp: maxSp });
            }

            if (global.CanvasRenderer && typeof global.CanvasRenderer.updateAndRender === 'function') {
                try {
                    var playerPos = global.BattleController ? global.BattleController.getPlayerPos() : { x: 400, y: 300 };
                    var monsters = global.BattleController ? global.BattleController.getMonsters() : [];
                    var effects = global.BattleEffectsManager ? global.BattleEffectsManager.getWorldData() : { damage: [], exp: [], loot: [], skillNames: [], interruptTexts: [] };
                    var skillStatus = global.BattleController ? global.BattleController.getSkillStatus() : null;
                    global.CanvasRenderer.updateAndRender({
                        player: { name: live.name, level: live.level, hp: maxHp, maxHp: maxHp, sp: maxSp, maxSp: maxSp },
                        monsters: monsters,
                        damageNumbers: effects.damage || [],
                        experienceNumbers: effects.exp || [],
                        lootNotifications: effects.loot || [],
                        playerPos: playerPos,
                        skillStatus: skillStatus,
                        skillNames: effects.skillNames || [],
                        interruptTexts: effects.interruptTexts || [],
                    });
                } catch (e) {
                    console.warn('[healFull] 强制渲染失败:', e);
                }
            }
        }, 0);
    }

    // ============================================================
    //  自然恢复（高频路径：直接改活引用，不触发持久化——与旧行为一致）
    // ============================================================
    function updateRegen(delta, isCombat) {
        var live = getChar();
        if (!live || live.hp <= 0) return;
        if (typeof delta !== 'number' || isNaN(delta) || delta <= 0) return;
        if (!global.CharService || typeof global.CharService.calculateRegen !== 'function') return;

        var regen = global.CharService.calculateRegen(live, isCombat);
        var maxHp = _getFinalMaxHP();
        var maxSp = _getFinalMaxSP();

        if (regen.hp > 0) {
            live.hp = Math.min(live.hp + regen.hp * delta, maxHp);
        }
        if (regen.sp > 0) {
            live.sp = Math.min(live.sp + regen.sp * delta, maxSp);
        }
        var bus = global.EventBus;
        if (bus) {
            bus.emit('char:hpChanged', { hp: live.hp, maxHp: maxHp });
            bus.emit('char:spChanged', { sp: live.sp, maxSp: maxSp });
        }
    }

    function setInvincible(duration) {
        if (typeof duration === 'number' && duration > 0) {
            _invincibleUntil = Date.now() + duration;
        } else {
            _invincibleUntil = 0;
        }
    }

    // ============================================================
    //  Zeny（经 CharacterContext）
    // ============================================================
    function getZeny() {
        var live = getChar();
        if (!live) return 0;
        if (typeof live.zeny !== 'number') live.zeny = 0;
        return live.zeny;
    }

    function addZeny(amount) {
        return global.CharacterContext ? global.CharacterContext.addZeny(amount, 'CharController') : false;
    }

    function deductZeny(amount) {
        return global.CharacterContext ? global.CharacterContext.deductZeny(amount, 'CharController') : false;
    }

    // ============================================================
    //  HP/SP 直接增补（经 CharacterContext.restoreResource）
    // ============================================================
    function addHp(amount) {
        if (!global.CharacterContext) return false;
        return global.CharacterContext.restoreResource('hp', amount, 'CharController').success;
    }

    function addSp(amount) {
        if (!global.CharacterContext) return false;
        return global.CharacterContext.restoreResource('sp', amount, 'CharController').success;
    }

    // ============================================================
    //  自动消耗 / 自动技能 合法写入入口
    // ============================================================
    function updateAutoConsumeRules(rulesArray) {
        var repo = _repo();
        if (!repo) return false;
        var safeRules = JSON.parse(JSON.stringify(rulesArray || []));
        var ok = repo.update(function(char) {
            if (!char._autoConsume) char._autoConsume = { version: 1, rules: [] };
            char._autoConsume.rules = safeRules;
        }, 'CharController');
        if (ok) {
            _safeCall(global.EventBus, 'emit', 'char:changed', { source: 'updateAutoConsumeRules' });
        }
        return ok;
    }

    function updateAutoSkillConfig(skills, strategy, enabled) {
        var repo = _repo();
        if (!repo) return false;
        var config = {
            skills: Array.isArray(skills) ? skills.slice() : [],
            strategy: strategy || 'priority',
            enabled: enabled !== undefined ? enabled : true,
        };
        var seen = {};
        var unique = [];
        for (var i = 0; i < config.skills.length; i++) {
            var name = config.skills[i];
            if (!seen[name]) {
                seen[name] = true;
                unique.push(name);
            }
        }
        config.skills = unique;
        var ok = repo.update(function(char) {
            char._autoSkillConfig = config;
        }, 'CharController');
        if (ok) {
            _safeCall(global.EventBus, 'emit', 'char:changed', { source: 'updateAutoSkillConfig' });
        }
        return ok;
    }

    // ---------- 暴露全局 ----------
    var CharController = {
        load: load,
        save: save,
        getChar: getChar,
        updateFinalStats: updateFinalStats,
        addExp: addExp,
        allocateStat: allocateStat,
        consumeSP: consumeSP,
        takeDamage: takeDamage,
        healFull: healFull,
        updateRegen: updateRegen,
        setInvincible: setInvincible,
        getZeny: getZeny,
        addZeny: addZeny,
        deductZeny: deductZeny,
        addHp: addHp,
        addSp: addSp,
        updateAutoSkillConfig: updateAutoSkillConfig,
        updateAutoConsumeRules: updateAutoConsumeRules,
    };

    global.CharController = CharController;

    // 兼容：框架内部活引用访问点（AttributeMediator/_getChar 兼容、旧调试代码）
    Object.defineProperty(global.CharController, '_charData', {
        get: function() { return _repo() ? _repo().getLiveRef() : null; },
        configurable: false,
        enumerable: true,
    });

    console.log('[CharController] ✅ 已加载（v4.0 精简版：业务在 Service/Context）');
})(window);
