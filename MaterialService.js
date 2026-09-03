// ============================================================
//  FILE: MaterialService.js
//  LAYER: services（材料子系统——材料清点、合成扣料、出售）
//  权限：data:inventory / char:addZeny（经 AccessControl）
//  依赖：InventoryRepository、ItemDataGateway、CharacterContext、EventBus
//  契约：
//    getTotalCount(templateId)             → number
//    hasMaterials(requirements)            → boolean（[{templateId, count}]）
//    deductForCraft(requirements, caller)  → boolean（合成扣料，全部满足才扣）
//    sell(stackKey, count, unitPrice, caller) → { success, zeny }
// ============================================================
(function(global) {
    'use strict';

    var _bus = null;

    function init(deps) {
        _bus = (deps && deps.eventBus) || global.EventBus;
        console.log('[MaterialService] ✅ 已加载（材料子系统）');
        return true;
    }

    function _requirePermission(caller) {
        if (!global.AccessControl) return true;
        if (global.AccessControl.check('data:inventory', caller || 'MaterialService')) return true;
        console.error('[MaterialService] 拒绝：', caller, '无权操作材料');
        return false;
    }

    function getTotalCount(templateId) {
        var repo = global.InventoryRepository;
        if (!repo) return 0;
        var rows = repo.getAllStacks(true);
        var total = 0;
        for (var i = 0; i < rows.length; i++) {
            if (rows[i].templateId === templateId) total += rows[i].count;
        }
        return total;
    }

    function hasMaterials(requirements) {
        if (!Array.isArray(requirements)) return false;
        for (var i = 0; i < requirements.length; i++) {
            var req = requirements[i];
            if (getTotalCount(req.templateId) < (req.count || 1)) return false;
        }
        return true;
    }

    function deductForCraft(requirements, caller) {
        var repo = global.InventoryRepository;
        if (!repo || !_requirePermission(caller)) return false;
        if (!Array.isArray(requirements) || !hasMaterials(requirements)) return false;

        for (var i = 0; i < requirements.length; i++) {
            var req = requirements[i];
            var remaining = req.count || 1;
            var rows = repo.getAllStacks(true);
            for (var j = 0; j < rows.length && remaining > 0; j++) {
                var row = rows[j];
                if (row.templateId !== req.templateId) continue;
                var take = Math.min(remaining, row.count);
                if (repo.removeItem(row.key, take)) remaining -= take;
            }
            if (remaining > 0) {
                console.error('[MaterialService] 扣料异常：材料不足', req);
                return false;
            }
        }

        if (_bus) _bus.emit('inventory:changed');
        return true;
    }

    // ---- 出售（移除物品 + 加 Zeny） ----
    function sell(stackKey, count, unitPrice, caller) {
        var repo = global.InventoryRepository;
        if (!repo || !_requirePermission(caller)) return { success: false, zeny: 0 };

        var stack = repo.getStack(stackKey);
        if (!stack) return { success: false, zeny: 0, message: '物品不存在' };
        var sellCount = Math.min(count || 1, stack.count);
        if (sellCount <= 0) return { success: false, zeny: 0, message: '数量无效' };

        var removeOk = repo.removeItem(stackKey, sellCount);
        if (!removeOk) return { success: false, zeny: 0, message: '移除物品失败' };

        var zeny = sellCount * (unitPrice || 0);
        if (zeny > 0 && global.CharacterContext) {
            global.CharacterContext.addZeny(zeny, caller || 'MaterialService');
        }

        if (_bus) _bus.emit('inventory:changed');
        return { success: true, zeny: zeny };
    }

    var MaterialService = {
        init: init,
        getTotalCount: getTotalCount,
        hasMaterials: hasMaterials,
        deductForCraft: deductForCraft,
        sell: sell,
    };

    global.MaterialService = MaterialService;
})(window);
