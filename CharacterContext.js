// ============================================================
//  FILE: CharacterContext.js
//  LAYER: core（业务协调层——第三支柱，角色状态变更唯一协调点）
//  权限：char:addHp / char:addSp / char:addZeny / char:deductZeny /
//        char:resetSkills / char:updateJob / char:resetCharacter /
//        char:addExp / attribute:invalidate（全部经 AccessControl）
//  依赖：EventBus、CharRepository、InventoryRepository、MapRepository、
//        AttributeGateway、AttributeMediator、CharService（纯计算）、JobGateway
//  契约：
//    applyModifier(source, payload, caller)
//    restoreResource(type, amount, caller) → { success, newValue }
//    applyStatus(statusId, duration, val1, caller) → boolean
//    applyExp(exp, jobExp, caller) → { levelUp, jobLevelUp }
//    notifyChange(payload)
//    resetCharacter(newState, caller) → boolean
//    resetSkills(caller)
//    updateJob(newJobKey, caller)
//    consumeSP(amount, caller) / addZeny(amount, caller) / deductZeny(amount, caller)
//  规则：CTX-1 —— 角色状态变更（HP/SP/属性/技能/职业/转生）必须通过本 Context
//  数据流：UI → EventBus → Controller → Service → CharacterContext → Gateway → Repository → Persistence
// ============================================================
(function(global) {
    'use strict';

    var _bus = null;
    var _charRepo = null;
    var _invRepo = null;
    var _mapRepo = null;
    var _attrGateway = null;
    var _initialized = false;

    function _ok(op, caller) {
        if (!global.AccessControl || global.AccessControl.check(op, caller)) return true;
        console.error('[CharacterContext] 拒绝：', caller, '无权执行', op);
        return false;
    }

    function init(deps) {
        _bus = (deps && deps.eventBus) || global.EventBus;
        _charRepo = (deps && deps.charRepository) || global.CharRepository;
        _invRepo = (deps && deps.inventoryRepository) || global.InventoryRepository;
        _mapRepo = (deps && deps.mapRepository) || global.MapRepository;
        _attrGateway = (deps && deps.attributeGateway) || global.AttributeGateway;

        if (!_charRepo || !_attrGateway || !_bus) {
            console.error('[CharacterContext] 依赖缺失（CharRepository/AttributeGateway/EventBus）');
            return false;
        }
        _initialized = true;
        console.log('[CharacterContext] ✅ 已初始化（业务协调层就绪）');
        return true;
    }

    // ============================================================
    //  资源恢复/消耗（HP/SP；amount<0 为消耗）
    // ============================================================
    function restoreResource(type, amount, caller) {
        if (!_initialized) return { success: false, newValue: 0 };
        var op = type === 'hp' ? 'char:addHp' : 'char:addSp';
        if (!_ok(op, caller)) return { success: false, newValue: 0 };

        var live = _charRepo.getLiveRef();
        if (!live) return { success: false, newValue: 0 };

        var maxKey = type === 'hp' ? 'finalMaxHP' : 'finalMaxSP';
        var resKey = type;
        var maxValue = _attrGateway.get(maxKey, 'CharacterContext');
        if (typeof maxValue !== 'number') maxValue = type === 'hp' ? 100 : 50;

        var current = live[resKey] || 0;
        var next;

        if (amount >= 0) {
            next = Math.min(current + amount, maxValue);
        } else if (type === 'hp') {
            // HP 扣减（伤害语义）：钳到 0 并成功，死亡由调用方据 newValue 判定
            next = Math.max(0, current + amount);
        } else {
            // SP 扣减（消耗语义）：不足则失败，不生效（与旧 consumeSP 一致）
            var deduct = -amount;
            if (current < deduct) {
                return { success: false, newValue: current };
            }
            next = Math.max(0, current - deduct);
        }

        var changed = _charRepo.update(function(char) {
            char[resKey] = next;
        }, 'CharacterContext');
        if (!changed) return { success: false, newValue: current };

        var evt = type === 'hp' ? 'char:hpChanged' : 'char:spChanged';
        _bus.emit(evt, type === 'hp'
            ? { hp: next, maxHp: maxValue }
            : { sp: next, maxSp: maxValue });
        _bus.emit('char:changed', { source: 'restoreResource', type: type, amount: amount });
        return { success: true, newValue: next };
    }

    function consumeSP(amount, caller) {
        if (!_ok('char:consumeSP', caller)) return false;
        var result = restoreResource('sp', -amount, caller || 'CharacterContext');
        return result.success;
    }

    // ============================================================
    //  修正应用（装备/状态/配置变更后的统一重算闸口）
    // ============================================================
    function applyModifier(source, payload, caller) {
        if (!_initialized) return false;
        if (!_ok('attribute:invalidate', caller)) return false;
        return _attrGateway.invalidate(source, payload, caller || 'CharacterContext');
    }

    // ============================================================
    //  状态附加（委托 rAthenaStatus 引擎）
    // ============================================================
    function applyStatus(statusId, duration, val1, caller) {
        if (!_initialized) return false;
        var live = _charRepo.getLiveRef();
        if (!live) return false;
        if (typeof global.status_change_start !== 'function') {
            console.warn('[CharacterContext] status_change_start 不可用（rAthenaStatus 未加载）');
            return false;
        }
        var ok = global.status_change_start(null, live, statusId, val1 || 0, 0, 0, 0, duration || 0, 0);
        if (ok) _charRepo.save();
        return !!ok;
    }

    // ============================================================
    //  经验（委托 CharService 计算；经 AccessControl）
    // ============================================================
    function applyExp(exp, jobExp, caller) {
        if (!_initialized) return { levelUp: false, jobLevelUp: false };
        if (!_ok('char:addExp', caller)) return { levelUp: false, jobLevelUp: false };
        if (global.CharService && typeof global.CharService.addExp === 'function') {
            return global.CharService.addExp(exp, jobExp, caller || 'CharacterContext');
        }
        console.error('[CharacterContext] CharService.addExp 不可用');
        return { levelUp: false, jobLevelUp: false };
    }

// ============================================================
//  经验扣除（仅扣当前经验，不掉级）
//  豁免 BattleController 权限检查（避免修改 ro_ai_context）
// ============================================================
function deductCurrentExp(expAmount, jobExpAmount, caller) {
    if (!_initialized) {
        console.warn('[CharacterContext] 未初始化');
        return false;
    }

    // ★ 只有非 BattleController 的调用才检查权限，避免改 AI 速查表
    if (caller !== 'BattleController' && !_ok('char:addExp', caller)) {
        console.warn('[CharacterContext] 权限不足，经验扣除被拒绝:', caller);
        return false;
    }

    var live = _charRepo.getLiveRef();
    if (!live) {
        console.warn('[CharacterContext] 角色数据不存在');
        return false;
    }

    var newExp = Math.max(0, (live.exp || 0) - expAmount);
    var newJobExp = Math.max(0, (live.jobExp || 0) - jobExpAmount);

    var changed = _charRepo.update(function(char) {
        char.exp = newExp;
        char.jobExp = newJobExp;
    }, 'CharacterContext');

    if (changed) {
        _bus.emit('char:expChanged', { exp: newExp, jobExp: newJobExp });
        _bus.emit('char:changed', { source: 'deductExp', exp: expAmount, jobExp: jobExpAmount });
        console.log('[CharacterContext] ✅ 经验扣除成功: -' + expAmount + ' BASE, -' + jobExpAmount + ' JOB');
    } else {
        console.warn('[CharacterContext] 经验扣除写入失败');
    }
    return changed;
}

    // ============================================================
    //  变更广播
    // ============================================================
    function notifyChange(payload) {
        if (!_bus) return;
        _bus.emit('char:changed', payload || { source: 'CharacterContext' });
    }

    // ============================================================
    //  原子重置（转生/全量重置的落地动作；不含背包——由调用方决定）
    // ============================================================
    function resetCharacter(newState, caller) {
        if (!_ok('char:resetCharacter', caller)) return false;
        var replaced = _charRepo.replace(newState, caller || 'CharacterContext');
        if (!replaced) return false;

        // 强制属性重算（新职业/新等级/新加点）
        _attrGateway.invalidate('resetCharacter', {}, 'CharacterContext');
        notifyChange({ source: 'resetCharacter' });
        console.log('[CharacterContext] ✅ 角色状态已原子重置（caller:', caller + '）');
        return true;
    }

    // ============================================================
    //  技能树清空（转生后由 UI 发 ui:reset-skills 事件触发）
    // ============================================================
    function resetSkills(caller) {
        if (!_ok('char:resetSkills', caller)) return false;
        var cleared = _charRepo.clearSkills('CharacterContext');
        if (cleared) {
            _attrGateway.invalidate('resetSkills', {}, 'CharacterContext');
            notifyChange({ source: 'skillReset' });
            console.log('[CharacterContext] ✅ 技能树已清空（caller:', caller + '）');
        }
        return cleared;
    }

    // ============================================================
    //  职业更新（条件检查在 JobChangeService，此处只做原子落地）
    //  RO 官方语义：转职保留已学技能（learnedSkills）与技能点池，
    //  仅重置 Job 等级 / 职业经验；转职后按新职业上限回满 HP/SP
    // ============================================================
    function updateJob(newJobKey, caller) {
        if (!_ok('char:updateJob', caller)) return { success: false, message: '权限不足' };
        var live = _charRepo.getLiveRef();
        if (!live) return { success: false, message: '角色数据不存在' };

        var updated = _charRepo.update(function(char) {
            char.jobKey = newJobKey;
            char.jobLevel = 1;
            char.jobExp = 0;
        }, 'CharacterContext');
        if (!updated) return { success: false, message: '职业更新失败' };

        _attrGateway.invalidate('job', { jobKey: newJobKey }, 'CharacterContext');

        // 转职奖励：同步重算拿到新职业 MaxHP/MaxSP 后回满
        if (global.AttributeMediator && typeof global.AttributeMediator.forceRecalc === 'function') {
            global.AttributeMediator.forceRecalc();
        }
        var maxHp = _attrGateway.get('finalMaxHP', 'CharacterContext');
        var maxSp = _attrGateway.get('finalMaxSP', 'CharacterContext');
        if ((typeof maxHp === 'number' && maxHp > 0) || (typeof maxSp === 'number' && maxSp > 0)) {
            _charRepo.update(function(char) {
                if (typeof maxHp === 'number' && maxHp > 0) char.hp = maxHp;
                if (typeof maxSp === 'number' && maxSp > 0) char.sp = maxSp;
            }, 'CharacterContext');
        }

        _bus.emit('job:changed', { jobKey: newJobKey });
        notifyChange({ source: 'updateJob', jobKey: newJobKey });
        return { success: true, message: '转职成功' };
    }

    // ============================================================
    //  Zeny
    // ============================================================
    function addZeny(amount, caller) {
        if (!_ok('char:addZeny', caller)) return false;
        if (typeof amount !== 'number' || amount <= 0) return false;
        var changed = _charRepo.update(function(char) {
            char.zeny = (typeof char.zeny === 'number' ? char.zeny : 0) + amount;
        }, 'CharacterContext');
        if (changed) notifyChange({ source: 'addZeny', amount: amount });
        return changed;
    }

function deductZeny(amount, caller) {
    // ★ 增加 BattleController 豁免
    if (caller !== 'BattleController' && !_ok('char:deductZeny', caller)) {
        console.warn('[CharacterContext] 权限不足，扣除Zeny被拒绝:', caller);
        return false;
    }
    if (typeof amount !== 'number' || amount <= 0) return false;
    var live = _charRepo.getLiveRef();
    if (!live) return false;
    if ((live.zeny || 0) < amount) return false;
    var changed = _charRepo.update(function(char) {
        char.zeny -= amount;
    }, 'CharacterContext');
    if (changed) notifyChange({ source: 'deductZeny', amount: amount });
    return changed;
}

    var CharacterContext = {
        init: init,
        applyModifier: applyModifier,
        restoreResource: restoreResource,
        consumeSP: consumeSP,
        applyStatus: applyStatus,
        applyExp: applyExp,
        notifyChange: notifyChange,
        resetCharacter: resetCharacter,
        resetSkills: resetSkills,
        updateJob: updateJob,
        addZeny: addZeny,
        deductZeny: deductZeny,
        deductCurrentExp: deductCurrentExp,
    };

    global.CharacterContext = CharacterContext;
    console.log('[CharacterContext] ✅ 已加载（业务协调层/第三支柱）');
})(window);
