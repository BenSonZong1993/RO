// ============================================================
//  FILE: CardService.js
//  LAYER: services（卡片子系统——卡片插入/移除）
//  权限：inventory:insertCard / inventory:removeCard（经 AccessControl）
//  依赖：InventoryRepository、ItemDataGateway、EventBus
//  契约：
//    canInsert(equipSlot, cardTemplateId) → { allowed, reason? }
//    doInsert(equipSlot, cardStackKey, caller) → { success, message }
//    doRemove(equipSlot, cardIndex, caller)   → { success, message }
// ============================================================
(function(global) {
    'use strict';

    var _bus = null;

    function init(deps) {
        _bus = (deps && deps.eventBus) || global.EventBus;
        console.log('[CardService] ✅ 已加载（卡片子系统）');
        return true;
    }

    // ---- 插入条件检查（原 ItemService._checkCardInsertRequirements） ----
    function canInsert(equipSlot, cardTemplateId) {
        var repo = global.InventoryRepository;
        if (!repo) return { allowed: false, reason: '背包仓储未加载' };

        var target = repo.getEquippedEntry(equipSlot);
        if (!target) return { allowed: false, reason: '目标装备槽为空' };

        var equipDef = global.ItemDataGateway ? global.ItemDataGateway.getById(target.templateId) : null;
        if (!equipDef) return { allowed: false, reason: '目标装备定义丢失' };

        var slots = equipDef.Slots || 0;
        var currentCards = target.cards || [];
        if (currentCards.length >= slots) return { allowed: false, reason: '卡槽已满' };

        var cardDef = global.ItemDataGateway ? global.ItemDataGateway.getById(cardTemplateId) : null;
        if (!cardDef) return { allowed: false, reason: '卡片定义丢失' };
        if (cardDef.Type !== 'Card' && !(cardDef.SubType && cardDef.SubType.indexOf('Card') !== -1)) {
            return { allowed: false, reason: '该物品不是卡片' };
        }
        return { allowed: true };
    }

    function doInsert(equipSlot, cardStackKey, caller) {
        var repo = global.InventoryRepository;
        var bus = _bus || global.EventBus;
        if (!repo) return { success: false, message: '背包仓储未加载' };

        if (global.AccessControl && !global.AccessControl.check('inventory:insertCard', caller || 'CardService')) {
            return { success: false, message: '权限不足' };
        }

        var cardStack = repo.getStack(cardStackKey);
        if (!cardStack) return { success: false, message: '卡片不存在' };
        var cardTemplateId = cardStack.templateId;

        if (!repo.getEquippedEntry(equipSlot)) return { success: false, message: '目标装备槽为空' };

        var reqCheck = canInsert(equipSlot, cardTemplateId);
        if (!reqCheck.allowed) return { success: false, message: reqCheck.reason };

        // 从背包移除卡片 → 追加到装备卡槽
        var removeOk = repo.removeItem(cardStackKey, 1);
        if (!removeOk) return { success: false, message: '从背包移除卡片失败' };

        var updated = repo.updateEquipped(equipSlot, function(entry) {
            if (!entry.cards) entry.cards = [];
            entry.cards.push(cardTemplateId);
        });
        if (!updated) {
            repo.addItemRaw(cardTemplateId, 0, 1, []);
            return { success: false, message: '保存数据失败' };
        }

if (bus) {
    bus.emit('inventory:changed');
    bus.emit('equip:changed', { slot: equipSlot, item: repo.getEquippedEntry(equipSlot) });
    // 新增：触发属性重算
    bus.emit('attribute:invalidate', { source: 'CardService', payload: { slot: equipSlot } });
}

        return { success: true, message: '卡片已插入' };
    }

    function doRemove(equipSlot, cardIndex, caller) {
        var repo = global.InventoryRepository;
        var bus = _bus || global.EventBus;
        if (!repo) return { success: false, message: '背包仓储未加载' };

        if (global.AccessControl && !global.AccessControl.check('inventory:removeCard', caller || 'CardService')) {
            return { success: false, message: '权限不足' };
        }

        var target = repo.getEquippedEntry(equipSlot);
        if (!target) return { success: false, message: '目标装备槽为空' };
        if (!target.cards || target.cards.length <= cardIndex) {
            return { success: false, message: '卡片索引无效' };
        }

        var cardTemplateId = target.cards[cardIndex];

        var updated = repo.updateEquipped(equipSlot, function(entry) {
            entry.cards.splice(cardIndex, 1);
        });
        if (!updated) return { success: false, message: '保存数据失败' };

        var addResult = repo.addItemRaw(cardTemplateId, 0, 1, []);
        if (!addResult.success) {
            // 回滚
            repo.updateEquipped(equipSlot, function(entry) {
                entry.cards.splice(cardIndex, 0, cardTemplateId);
            });
            return { success: false, message: '放回背包失败' };
        }

        if (bus) {
            bus.emit('inventory:changed');
            bus.emit('equip:changed', { slot: equipSlot, item: repo.getEquippedEntry(equipSlot) });
                // 新增：触发属性重算
    bus.emit('attribute:invalidate', { source: 'CardService', payload: { slot: equipSlot } });
        }
        return { success: true, message: '卡片已移除' };
    }

    var CardService = {
        init: init,
        canInsert: canInsert,
        doInsert: doInsert,
        doRemove: doRemove,
    };

    global.CardService = CardService;
})(window);
