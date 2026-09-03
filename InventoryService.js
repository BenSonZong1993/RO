// ============================================================
//  FILE: InventoryService.js
//  LAYER: services（背包/装备门面——对外接口与 v0.3 完全一致）
//  权限：data:inventory（透传子服务权限）
//  依赖：InventoryRepository、EquipService、CardService、UsableService、
//        MaterialService、ItemDataGateway、AccessControl
//  契约（对外接口保持不变）：
//    addItem / removeItem / getAllStacks / getDistinctCount / getTotalCount /
//    getEquippedInfo / getItemDisplayName / getItemType / reset /
//    equip / unequip / useItem / insertCard / removeCard / getEquipBonuses /
//    _getItemDef（内部兼容，委托 ItemDataGateway）
//  规则：门面模式——内部委托 Repository + 子服务；外部调用方零感知
// ============================================================
(function(global) {
    'use strict';

    function init() {
        if (global.AccessControl) {
            global.AccessControl.register('inventory:equip', ['InventoryService', 'EquipService', 'GMConsole']);
            global.AccessControl.register('inventory:unequip', ['InventoryService', 'EquipService', 'GMConsole']);
            global.AccessControl.register('inventory:use', ['InventoryService', 'UsableService', 'GMConsole', 'AutoConsumeManager']);
            global.AccessControl.register('inventory:insertCard', ['InventoryService', 'CardService', 'GMConsole']);
            global.AccessControl.register('inventory:removeCard', ['InventoryService', 'CardService', 'GMConsole']);
        }
        console.log('[InventoryService] ✅ 门面就绪（Repository + Equip/Card/Usable/Material 子服务）');
        return true;
    }

    // ============================================================
    //  数据读取（Repository 深拷贝 + 显示名富化）
    // ============================================================
    function getAllStacks(includeEquipped) {
        var rows = global.InventoryRepository ? global.InventoryRepository.getAllStacks(includeEquipped) : [];
        for (var i = 0; i < rows.length; i++) {
            rows[i].name = global.ItemDataGateway ? global.ItemDataGateway.getDisplayName(rows[i].templateId) : ('#' + rows[i].templateId);
        }
        return rows;
    }

    function getEquippedInfo() {
        var equipped = global.InventoryRepository ? global.InventoryRepository.getEquipped() : {};
        var result = {};
        for (var slot in equipped) {
            if (!equipped.hasOwnProperty(slot)) continue;
            var item = equipped[slot];
            result[slot] = {
                templateId: item.templateId,
                refine: item.refine || 0,
                cards: item.cards || [],
                stackKey: item.stackKey,
            };
        }
        return result;
    }

    // ============================================================
    //  对外门面（接口与旧版一致）
    // ============================================================
    var InventoryService = {
        init: init,

        // ---- 数据读取 ----
        getAllStacks: function(includeEquipped) { return getAllStacks(includeEquipped); },
        getDistinctCount: function() { return getAllStacks(false).length; },
        getTotalCount: function() {
            var rows = getAllStacks(false);
            var total = 0;
            for (var i = 0; i < rows.length; i++) total += rows[i].count;
            return total;
        },
        getEquippedInfo: getEquippedInfo,
        getItemDisplayName: function(templateId) {
            return global.ItemDataGateway ? global.ItemDataGateway.getDisplayName(templateId) : ('#' + templateId);
        },
        getItemType: function(templateId) {
            return global.ItemDataGateway ? global.ItemDataGateway.getType(templateId) : '其他';
        },
        getStack: function(stackKey) {
            return global.InventoryRepository ? global.InventoryRepository.getStack(stackKey) : null;
        },

        // ---- 数据写入（委托 Repository；业务校验在调用侧/UI 确认后） ----
        addItem: function(templateId, refine, count, cards) {
            var repo = global.InventoryRepository;
            if (!repo) return { success: false, error: '背包仓储未加载' };
            if (global.AccessControl && !global.AccessControl.check('data:inventory', 'InventoryService')) {
                return { success: false, error: '权限不足' };
            }
            var def = global.ItemDataGateway ? global.ItemDataGateway.getById(templateId) : null;
            if (!def) return { success: false, error: '未知物品' };
            var result = repo.addItemRaw(templateId, refine, count, cards);
            if (result.success && global.EventBus) global.EventBus.emit('inventory:changed');
            return result;
        },
        removeItem: function(stackKey, count) {
            var repo = global.InventoryRepository;
            if (!repo) return false;
            if (global.AccessControl && !global.AccessControl.check('data:inventory', 'InventoryService')) return false;
            var ok = repo.removeItem(stackKey, count);
            if (ok && global.EventBus) global.EventBus.emit('inventory:changed');
            return ok;
        },
        reset: function() {
            var repo = global.InventoryRepository;
            if (!repo) return false;
            var ok = repo.reset('InventoryService');
            if (ok && global.EventBus) global.EventBus.emit('inventory:changed');
            return ok;
        },

        // ---- 装备（委托 EquipService） ----
        // 【修改】equip 现在接受第一个参数为 slots（数组或逗号分隔字符串）
        equip: function(slots, templateId, refine, cards) {
            // 兼容旧调用：如果第一个参数是字符串，转为数组
            if (typeof slots === 'string') {
                slots = slots.split(',').filter(function(s) { return s.trim() !== ''; });
            }
            if (!Array.isArray(slots) || slots.length === 0) {
                return { success: false, message: '无效装备槽位' };
            }
            return global.EquipService ? global.EquipService.doEquip(slots, templateId, refine, cards, 'InventoryService')
                : { success: false, message: 'EquipService 未加载' };
        },
        unequip: function(slot) {
            return global.EquipService ? global.EquipService.doUnequip(slot, 'InventoryService')
                : { success: false, message: 'EquipService 未加载' };
        },
        getEquipBonuses: function() {
            return global.EquipService ? global.EquipService.getEquipBonuses() : {};
        },

        // ---- 消耗品（委托 UsableService） ----
        useItem: function(stackKey) {
            return global.UsableService ? global.UsableService.doUse(stackKey, 'InventoryService')
                : { success: false, message: 'UsableService 未加载' };
        },

        // ---- 卡片（委托 CardService） ----
        insertCard: function(equipSlot, cardStackKey) {
            return global.CardService ? global.CardService.doInsert(equipSlot, cardStackKey, 'InventoryService')
                : { success: false, message: 'CardService 未加载' };
        },
        removeCard: function(equipSlot, cardIndex) {
            return global.CardService ? global.CardService.doRemove(equipSlot, cardIndex, 'InventoryService')
                : { success: false, message: 'CardService 未加载' };
        },

        // ---- 内部兼容（SkillScheduler 武器信息查询） ----
        _getItemDef: function(templateId) {
            return global.ItemDataGateway ? global.ItemDataGateway.getById(templateId) : null;
        },
    };

    global.InventoryService = InventoryService;

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})(window);