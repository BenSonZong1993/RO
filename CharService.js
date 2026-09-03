// ============================================================
//  FILE: CharService.js
//  LAYER: services（角色核心服务——经验/加点计算与落地，配表驱动）
//  权限：char:addExp / char:allocateStat（经 AccessControl，调用方传模块名）
//  依赖：CharRepository、AttributeGateway、ArithmeticCore、JobGateway、
//        ConfigProfileManager、CharData、EventBus
//  契约：
//    纯计算：getExpToLevel / getJobExpToLevel / getMaxLevel / getMaxJobLevel /
//            calculateRegen / healFull / takeDamage / getRegenConfig / setRegenConfig
//    落地：  addExp(exp, jobExp, caller) → { levelUp, jobLevelUp }
//            allocateStat(statKey, amount, caller) → boolean
//  规则：ARCH-1 —— 不直接操作私有 char 缓存，一律经 CharRepository；
//        数值公式 100% 配表/公式驱动，无硬编码；
//        GATE-1 —— 职业数据通过 JobGateway 获取（不再直接读取 JobData）
// ============================================================
(function(global) {
    'use strict';

    // ============================================================
    //  工具函数：安全获取恢复配置（带降级默认值）
    // ============================================================
    function _getRegenConfig() {
        var defaultFormula = {
            vitCoef: 0.2, mhpCoef: 0.005,
            intCoef: 0.1667, mspCoef: 0.01,
            bonusInt: 120, bonusAdd: 4, bonusPer: 0.5
        };
        var defaultCfg = {
            mode: 'smooth',
            hpInterval: 6,
            spInterval: 8,
            combatPenalty: 0.5,
            formula: defaultFormula
        };

        if (!global.ConfigProfileManager) return defaultCfg;
        var profile = global.ConfigProfileManager.getCurrentProfile();
        if (!profile || !profile.char || !profile.char.regen) return defaultCfg;
        var cfg = profile.char.regen;
        if (!cfg.formula) cfg.formula = defaultFormula;
        for (var key in defaultFormula) {
            if (cfg.formula[key] === undefined) cfg.formula[key] = defaultFormula[key];
        }
        return cfg;
    }

    // ============================================================
    //  经验表（JobGateway 配表驱动；降级公式防 NaN；真全局因子 GlobalExpConfig）
    //  升级所需经验 = 表值 × baseRate / jobRate（rate=2 → 每级需 200% 经验）
    // ============================================================
    function _getExpTable(jobKey) {
        if (!jobKey) return null;
        if (global.JobGateway && typeof global.JobGateway.getExpTable === 'function') {
            return global.JobGateway.getExpTable(jobKey);
        }
        console.warn('[CharService] JobGateway 未加载或 getExpTable 不可用，使用降级公式');
        return null;
    }

    function _applyExpRate(value, rate) {
        var r = (typeof rate === 'number' && rate > 0) ? rate : 1;
        return Math.max(1, Math.round(value * r));
    }

    function _baseExpRate() {
        return (global.GlobalExpConfig && typeof global.GlobalExpConfig.baseRate === 'number')
            ? global.GlobalExpConfig.baseRate : 1;
    }

    function _jobExpRate() {
        return (global.GlobalExpConfig && typeof global.GlobalExpConfig.jobRate === 'number')
            ? global.GlobalExpConfig.jobRate : 1;
    }

    function getExpToLevel(level, jobKey) {
        if (typeof level !== 'number' || isNaN(level) || level < 1) level = 1;
        var expTable = _getExpTable(jobKey);
        var value;
        if (expTable && Array.isArray(expTable.BaseExp) && expTable.BaseExp.length > 0) {
            var expArray = expTable.BaseExp;
            value = null;
            for (var j = 0; j < expArray.length; j++) {
                if (expArray[j].Level === level) { value = expArray[j].Exp; break; }
            }
            if (value === null) value = expArray[expArray.length - 1].Exp;
            if (typeof value !== 'number' || isNaN(value) || value <= 0) {
                value = Math.floor(10 * level * level + 20 * level);
            }
        } else {
            value = Math.floor(10 * level * level + 20 * level);
        }
        return _applyExpRate(value, _baseExpRate());
    }

    function getJobExpToLevel(jobLevel, jobKey) {
        if (typeof jobLevel !== 'number' || isNaN(jobLevel) || jobLevel < 1) jobLevel = 1;
        var expTable = _getExpTable(jobKey);
        var value;
        if (expTable && Array.isArray(expTable.JobExp) && expTable.JobExp.length > 0) {
            var expArray = expTable.JobExp;
            value = null;
            for (var j = 0; j < expArray.length; j++) {
                if (expArray[j].Level === jobLevel) { value = expArray[j].Exp; break; }
            }
            if (value === null) value = expArray[expArray.length - 1].Exp;
            if (typeof value !== 'number' || isNaN(value) || value <= 0) {
                value = Math.floor(8 * jobLevel * jobLevel + 15 * jobLevel);
            }
        } else {
            value = Math.floor(8 * jobLevel * jobLevel + 15 * jobLevel);
        }
        return _applyExpRate(value, _jobExpRate());
    }

    function getMaxLevel(jobKey) {
        var expTable = _getExpTable(jobKey);
        return (expTable && typeof expTable.MaxBaseLevel === 'number') ? expTable.MaxBaseLevel : 99;
    }

    function getMaxJobLevel(jobKey) {
        var expTable = _getExpTable(jobKey);
        return (expTable && typeof expTable.MaxJobLevel === 'number') ? expTable.MaxJobLevel : 50;
    }

    // ============================================================
    //  经验落地（受控写入：CharRepository + AttributeGateway + EventBus）
    // ============================================================
    function addExp(exp, jobExp, caller) {
        var repo = global.CharRepository;
        var bus = global.EventBus;
        if (!repo || !repo.getLiveRef) return { levelUp: false, jobLevelUp: false };

        if (global.AccessControl && !global.AccessControl.check('char:addExp', caller || 'CharService')) {
            console.error('[CharService] 拒绝：', caller, '无权执行 char:addExp');
            return { levelUp: false, jobLevelUp: false };
        }

        var result = { levelUp: false, jobLevelUp: false };
        var changed = repo.update(function(char) {
            char.exp = (typeof char.exp === 'number' && !isNaN(char.exp)) ? char.exp : 0;
            char.jobExp = (typeof char.jobExp === 'number' && !isNaN(char.jobExp)) ? char.jobExp : 0;
            char.exp += exp;
            char.jobExp += jobExp;

            while (char.level < getMaxLevel(char.jobKey)) {
                var need = getExpToLevel(char.level, char.jobKey);
                if (typeof need !== 'number' || isNaN(need) || need <= 0) need = 10;
                if (char.exp >= need) {
                    char.exp -= need;
                    char.level += 1;
                    result.levelUp = true;
                    var gained = global.ArithmeticCore ? global.ArithmeticCore.getStatPointsGain(char.level) : 1;
                    char.statPoints = (char.statPoints || 0) + gained;
                } else break;
            }

            while (char.jobLevel < getMaxJobLevel(char.jobKey)) {
                var needJ = getJobExpToLevel(char.jobLevel, char.jobKey);
                if (typeof needJ !== 'number' || isNaN(needJ) || needJ <= 0) needJ = 10;
                if (char.jobExp >= needJ) {
                    char.jobExp -= needJ;
                    char.jobLevel += 1;
                    result.jobLevelUp = true;
                    char.skillPoints = (char.skillPoints || 0) + 1;
                } else break;
            }
        }, 'CharService');

        if (!changed) return { levelUp: false, jobLevelUp: false };

        // 升级触发重算 + 事件
        if (result.levelUp || result.jobLevelUp) {
            if (global.AttributeGateway) global.AttributeGateway.invalidate('level', result, 'CharService');

            // 升级奖励：强制同步重算拿到新上限后回满 HP/SP
            if (result.levelUp) {
                if (global.AttributeMediator && typeof global.AttributeMediator.forceRecalc === 'function') {
                    global.AttributeMediator.forceRecalc();
                }
                var maxHp = global.AttributeGateway ? global.AttributeGateway.get('finalMaxHP', 'CharService') : null;
                var maxSp = global.AttributeGateway ? global.AttributeGateway.get('finalMaxSP', 'CharService') : null;
                if ((typeof maxHp === 'number' && maxHp > 0) || (typeof maxSp === 'number' && maxSp > 0)) {
                    repo.update(function(char) {
                        if (typeof maxHp === 'number' && maxHp > 0) char.hp = maxHp;
                        if (typeof maxSp === 'number' && maxSp > 0) char.sp = maxSp;
                    }, 'CharService');
                }
            }

            var live = repo.getLiveRef();
            if (result.levelUp && bus) bus.emit('char:levelUp', { char: live });
            if (result.jobLevelUp && bus) bus.emit('char:jobLevelUp', { char: live });
            if (bus) bus.emit('char:changed', { char: live });
        }
        return result;
    }

    // ============================================================
    //  属性加点落地（受控写入）
    // ============================================================
    function allocateStat(statKey, amount, caller) {
        var repo = global.CharRepository;
        if (!repo || !repo.getLiveRef) return false;

        if (global.AccessControl && !global.AccessControl.check('char:allocateStat', caller || 'CharService')) {
            console.error('[CharService] 拒绝：', caller, '无权执行 char:allocateStat');
            return false;
        }

        if (!global.CharData || !global.CharData.STAT_KEYS) {
            console.error('[CharService] CharData.STAT_KEYS 不可用');
            return false;
        }
        var stat = statKey.toLowerCase();
        if (!global.CharData.STAT_KEYS.includes(stat)) {
            console.warn('[CharService] 无效属性:', stat);
            return false;
        }

        var live = repo.getLiveRef();
        var current = live.stats[stat] || 1;
        var cost = global.ArithmeticCore ? global.ArithmeticCore.getStatPointCost(current) : 1;
        var totalCost = cost * (amount || 1);
        if ((live.statPoints || 0) < totalCost) return false;

        var changed = repo.update(function(char) {
            char.statPoints -= totalCost;
            char.stats[stat] = (char.stats[stat] || 1) + (amount || 1);
        }, 'CharService');
        if (!changed) return false;

        if (global.AttributeGateway) global.AttributeGateway.invalidate('stat', { stat: statKey, amount: amount }, 'CharService');
        var bus = global.EventBus;
        if (bus) {
            bus.emit('char:statAllocated', { stat: statKey, amount: amount });
            bus.emit('char:changed', { char: repo.getLiveRef() });
        }
        return true;
    }

    // ============================================================
    //  满血满蓝 / 受击（纯计算，供 Controller/Context 调用）
    // ============================================================
    function healFull(char) {
        if (!char) return;
        var maxHp = 100;
        var maxSp = 50;
        if (global.AttributeGateway && typeof global.AttributeGateway.get === 'function') {
            var hp = global.AttributeGateway.get('finalMaxHP', 'CharService');
            var sp = global.AttributeGateway.get('finalMaxSP', 'CharService');
            if (typeof hp === 'number') maxHp = hp;
            if (typeof sp === 'number') maxSp = sp;
        }
        char.hp = maxHp;
        char.sp = maxSp;
    }

    function takeDamage(char, damage) {
        if (!char) return;
        char.hp = Math.max(0, (char.hp || 0) - damage);
    }

    // ============================================================
    //  自然恢复计算（完全配表驱动）
    // ============================================================
    function calculateRegen(char, isCombat, skillBonus) {
        if (!char) return { hp: 0, sp: 0 };

        var regenCfg = _getRegenConfig();
        var f = regenCfg.formula;

        var maxHp = 100;
        var maxSp = 50;
        if (global.AttributeGateway && typeof global.AttributeGateway.get === 'function') {
            maxHp = global.AttributeGateway.get('finalMaxHP', 'CharService') || 100;
            maxSp = global.AttributeGateway.get('finalMaxSP', 'CharService') || 50;
        }

        var vit = (char.stats && char.stats.vit) || 1;
        var int_ = (char.stats && char.stats.int) || 1;

        var hpBase = Math.floor(maxHp * f.mhpCoef + vit * f.vitCoef);
        hpBase = Math.max(0, hpBase);

        var spBase = 1 + Math.floor(int_ * f.intCoef) + Math.floor(maxSp * f.mspCoef);
        if (int_ >= f.bonusInt) {
            spBase += f.bonusAdd + Math.floor((int_ - f.bonusInt) * f.bonusPer);
        }
        spBase = Math.max(0, spBase);

        var combatHpPenalty = isCombat ? regenCfg.combatPenalty : 1.0;
        var combatSpPenalty = isCombat ? regenCfg.combatPenalty : 1.0;

        var bonus = skillBonus || { hpFixed: 0, spFixed: 0, hpPercent: 0, spPercent: 0 };
        var hpFromPercent = maxHp * (bonus.hpPercent || 0);
        var spFromPercent = maxSp * (bonus.spPercent || 0);

        var hpTotal = (hpBase + hpFromPercent + (bonus.hpFixed || 0)) * combatHpPenalty;
        var spTotal = (spBase + spFromPercent + (bonus.spFixed || 0)) * combatSpPenalty;

        if (regenCfg.mode === 'pulse') {
            hpTotal = hpTotal * regenCfg.hpInterval;
            spTotal = spTotal * regenCfg.spInterval;
        }

        return { hp: Math.max(0, hpTotal), sp: Math.max(0, spTotal) };
    }

    // ============================================================
    //  配表工具接口（供 UI 调试）
    // ============================================================
    function getRegenConfig() { return _getRegenConfig(); }

    function setRegenConfig(newConfig) {
        if (!global.ConfigProfileManager) return false;
        var profile = global.ConfigProfileManager.getCurrentProfile();
        if (!profile || !profile.char) return false;
        if (!profile.char.regen) profile.char.regen = {};
        for (var key in newConfig) {
            if (newConfig.hasOwnProperty(key)) {
                if (key === 'formula' && typeof newConfig.formula === 'object') {
                    if (!profile.char.regen.formula) profile.char.regen.formula = {};
                    for (var fKey in newConfig.formula) {
                        profile.char.regen.formula[fKey] = newConfig.formula[fKey];
                    }
                } else {
                    profile.char.regen[key] = newConfig[key];
                }
            }
        }
        console.log('[CharService] 恢复配置已热更新（仅内存）:', profile.char.regen);
        return true;
    }

    function init() {
        var cfg = _getRegenConfig();
        console.log('[CharService] ✅ 已加载（v5.0：经验表经 JobGateway，恢复模式:', cfg.mode, '）');
        return true;
    }

    global.CharService = {
        getExpToLevel: getExpToLevel,
        getJobExpToLevel: getJobExpToLevel,
        getMaxLevel: getMaxLevel,
        getMaxJobLevel: getMaxJobLevel,
        addExp: addExp,
        allocateStat: allocateStat,
        healFull: healFull,
        takeDamage: takeDamage,
        calculateRegen: calculateRegen,
        getRegenConfig: getRegenConfig,
        setRegenConfig: setRegenConfig,
        init: init,
    };

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();

})(window);