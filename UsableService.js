// ============================================================
//  FILE: UsableService.js
//  LAYER: services（消耗品子系统——药水/可使用物品）
//  权限：inventory:use / char:addHp / char:addSp（经 AccessControl）
//  依赖：InventoryRepository、ItemDataGateway、ScriptParser、CharacterContext、EventBus
//  契约：
//    canUse(char, templateId)     → { allowed, reason? }
//    doUse(stackKey, caller)      → { success, message }
//  规则：I1 —— 所有物品脚本效果必须经 ScriptParser.executeScript，禁止硬编码解析
// ============================================================
(function(global) {
    'use strict';

    var _bus = null;

    function init(deps) {
        _bus = (deps && deps.eventBus) || global.EventBus;
        console.log('[UsableService] ✅ 已加载（消耗品子系统）');
        return true;
    }

    // function canUse(char, templateId) {
    //     var def = global.ItemDataGateway ? global.ItemDataGateway.getById(templateId) : null;
    //     if (!def) return { allowed: false, reason: '未知物品' };
    //     var minLv = def.RequiredLevel || 0;
    //     if (char.level < minLv) return { allowed: false, reason: '需要等级 ' + minLv };
    //     return { allowed: true };
    // }

function canUse(char, templateId) {
    var def = global.ItemDataGateway ? global.ItemDataGateway.getById(templateId) : null;
    if (!def) return { allowed: false, reason: '未知物品' };
    
    // ---- 等级检查 ----
    var minLv = def.EquipLevelMin || def.RequiredLevel || def.UseLevel || def.MinLevel || 0;
    if (char.level < minLv) return { allowed: false, reason: '需要等级 ' + minLv };
    
    // ---- 职业检查 ----
    if (def.Jobs && typeof def.Jobs === 'object') {
        var jobKeys = Object.keys(def.Jobs).filter(function(k) { return def.Jobs[k] && k !== 'All'; });
        if (jobKeys.length > 0) {
            var charJob = char.jobKey || '';
            var allowed = jobKeys.some(function(job) { return job === charJob; });
            if (!allowed) return { allowed: false, reason: '职业不符' };
        }
    }
    
    return { allowed: true };
}


    function doUse(stackKey, caller) {
        var repo = global.InventoryRepository;
        var bus = _bus || global.EventBus;
        if (!repo) return { success: false, message: '背包仓储未加载' };

        if (global.AccessControl && !global.AccessControl.check('inventory:use', caller || 'UsableService')) {
            return { success: false, message: '权限不足' };
        }

        var stack = repo.getStack(stackKey);
        if (!stack) return { success: false, message: '物品不存在' };

        var def = global.ItemDataGateway ? global.ItemDataGateway.getById(stack.templateId) : null;
        if (!def) return { success: false, message: '未知物品' };

        var char = global.CharRepository ? global.CharRepository.getLiveRef() : null;
        if (!char) return { success: false, message: '角色数据未加载' };

        var reqCheck = canUse(char, stack.templateId);
        if (!reqCheck.allowed) return { success: false, message: reqCheck.reason };

        // ---- 执行脚本（统一引擎：ScriptParser） ----
        var effectResult = { success: true, message: '使用成功' };
        var script = def.Script || '';
        if (script && global.ScriptParser && typeof global.ScriptParser.executeScript === 'function') {
            var result = global.ScriptParser.executeScript(char, script);
            if (!result.success) {
                return { success: false, message: result.message || '脚本执行失败' };
            }
            effectResult = result;
        } else {
            console.warn('[UsableService] ScriptParser 不可用或脚本为空，效果未生效');
        }

        // ---- 减少堆叠数量 ----
        var removeOk = repo.removeItem(stackKey, 1);
        if (!removeOk) return { success: false, message: '保存失败' };

        // ---- 事件 ----
        if (bus) {
            bus.emit('inventory:changed');
            bus.emit('inventory:used', { stackKey: stackKey, templateId: stack.templateId, effect: effectResult });
        }

        return { success: true, message: effectResult.message || '使用成功' };
    }

    var UsableService = {
        init: init,
        canUse: canUse,
        doUse: doUse,
    };

    global.UsableService = UsableService;
})(window);
