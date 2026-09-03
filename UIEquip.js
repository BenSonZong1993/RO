// js/ui/UIEquip.js
(function(global) {
    'use strict';

var SLOT_MAP = {
    weapon: 'equip-weapon',
    shield: 'equip-shield',
    armor: 'equip-armor',
    garment: 'equip-garment',
    shoes: 'equip-shoes',
    headtop: 'equip-headTop',   // 原 headTop
    headmid: 'equip-headMid',   // 原 headMid
    headbottom: 'equip-headBottom', // 原 headBottom
    accessory1: 'equip-accessory1',
    accessory2: 'equip-accessory2',
    mount: 'equip-mount'
};

    var _listeners = [];
    var _initialized = false;
    var _domListeners = [];
    var _debouncedUpdate = null;

    function _getItemName(templateId) {
        if (global.InventoryService && typeof global.InventoryService.getItemDisplayName === 'function') {
            return global.InventoryService.getItemDisplayName(templateId);
        }
        if (global.ItemNameMap) {
            for (var name in global.ItemNameMap) {
                if (global.ItemNameMap[name] === templateId) return name;
            }
        }
        return '#' + templateId;
    }

    function _updateEquipDisplay() {
        if (!global.InventoryService) return;
        var equipped = global.InventoryService.getEquippedInfo ? global.InventoryService.getEquippedInfo() : {};
        for (var slot in SLOT_MAP) {
            var el = document.getElementById(SLOT_MAP[slot]);
            if (!el) continue;
            var info = equipped[slot];
            if (info) {
                var name = _getItemName(info.templateId);
                var refine = info.refine > 0 ? '+' + info.refine + ' ' : '';
                el.textContent = refine + name;
                el.dataset.slot = slot;
                el.dataset.templateId = info.templateId;
                el.dataset.refine = info.refine;
                el.dataset.cards = JSON.stringify(info.cards || []);
            } else {
                el.textContent = '无';
                el.dataset.slot = slot;
                el.dataset.templateId = '';
                el.dataset.refine = 0;
                el.dataset.cards = '[]';
            }
        }
    }

    function _bindEvents() {
        // 卡片按钮
        var cardBtns = document.querySelectorAll('[id^="btn-equip-"][id$="-card"]');
        cardBtns.forEach(function(btn) {
            var handler = function(e) {
                e.stopPropagation();
                var slot = this.id.replace('btn-equip-', '').replace('-card', '');
                if (global.UICardManager && typeof global.UICardManager.open === 'function') {
                    global.UICardManager.open(slot);
                } else {
                    alert('卡片管理器未加载');
                }
            };
            btn.addEventListener('click', handler);
            _domListeners.push({ el: btn, event: 'click', fn: handler });
        });

        // 装备名称点击详情
        var equipSlots = document.querySelectorAll('[id^="equip-"]');
        equipSlots.forEach(function(el) {
            if (!el.id.startsWith('equip-')) return;
var handler = function(e) {
    if (e.target.closest('button')) return;
    var slot = this.id.replace('equip-', '').toLowerCase(); // 添加 .toLowerCase()
    if (global.UIInventory && typeof global.UIInventory.showItemDetail === 'function') {
        global.UIInventory.showItemDetail(null, slot);
    } else {
        alert('UIInventory 未加载');
    }
};
            el.addEventListener('click', handler);
            _domListeners.push({ el: el, event: 'click', fn: handler });
        });

        var bus = global.EventBus;
        if (!bus) return;

        // 创建防抖版更新 (300ms)
        _debouncedUpdate = global.UIManager.debounce(_updateEquipDisplay.bind(this), 300);

        function onInventoryChanged() { _debouncedUpdate(); }
        function onCharChanged() { _debouncedUpdate(); }
        function onEquipChanged() { _debouncedUpdate(); }

        bus.on('inventory:changed', onInventoryChanged);
        _listeners.push({ event: 'inventory:changed', fn: onInventoryChanged });

        bus.on('char:changed', onCharChanged);
        _listeners.push({ event: 'char:changed', fn: onCharChanged });

        bus.on('equip:changed', onEquipChanged);
        _listeners.push({ event: 'equip:changed', fn: onEquipChanged });
    }

    function init() {
        if (_initialized) return;
        _updateEquipDisplay();
        _bindEvents();
        _initialized = true;
        console.log('[UIEquip] ✅ 已初始化（防抖300ms）');

        if (global.UIManager && typeof global.UIManager.register === 'function') {
            global.UIManager.register(global.UIEquip);
        }
        return true;
    }

    function dispose() {
        if (_debouncedUpdate && typeof _debouncedUpdate.cancel === 'function') {
            _debouncedUpdate.cancel();
        }
        var bus = global.EventBus;
        if (bus) {
            for (var i = 0; i < _listeners.length; i++) {
                bus.off(_listeners[i].event, _listeners[i].fn);
            }
            _listeners = [];
        }
        for (var j = 0; j < _domListeners.length; j++) {
            var item = _domListeners[j];
            item.el.removeEventListener(item.event, item.fn);
        }
        _domListeners = [];
        _initialized = false;
        console.log('[UIEquip] 事件监听已清理');
    }

    global.UIEquip = {
        name: 'UIEquip',
        init: init,
        dispose: dispose,
        update: _updateEquipDisplay
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})(window);