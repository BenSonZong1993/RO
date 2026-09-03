// js/ui/UICardManager.js
// 重构版：使用 UIPanel 统一容器，所有弹窗改为非阻塞 Notification
(function(global) {
    'use strict';

    var currentSlot = null;
    var _listeners = [];
    var _domListeners = [];
    var _initialized = false;
    var isOpen = false;

    // ---- 确保全局 Notification 服务存在 ----
    if (typeof global.Notification === 'undefined') {
        if (typeof global.UIPanel !== 'undefined') {
            global.Notification = {
alert: function(message, title) {
    return new Promise(function(resolve) {
        UIPanel.show({
            preset: 'dialog',
            title: { icon: 'ℹ️', text: title || '提示' },
            content: `
                <p style="margin: 8px 0 16px; word-break:break-word;">${message}</p>
                <div style="display:flex; justify-content:flex-end;">
                    <button id="ro-alert-ok-btn" style="background:#3b82f6; border:none; color:#fff; padding:6px 20px; border-radius:6px; cursor:pointer; font-size:0.95rem;">确定</button>
                </div>
            `,
            onClose: function() { resolve(); }
        });
        // 立即尝试绑定，若失败则延迟重试
        var bind = function() {
            var btn = document.getElementById('ro-alert-ok-btn');
            if (btn) {
                btn.addEventListener('click', function() {
                    UIPanel.close();
                    resolve();
                });
                return true;
            }
            return false;
        };
        if (!bind()) {
            setTimeout(function() { bind(); }, 50);
        }
    });
},



                confirm: function(message, title) {
                    return global.UIPanel.confirm({ message: message, title: title });
                },



              prompt: function(message, defaultValue, title) {
    return new Promise(function(resolve) {
        UIPanel.show({
            preset: 'dialog',
            title: { icon: '✏️', text: title || '输入' },
            content: `
                <p style="margin: 8px 0 12px;">${message}</p>
                <input id="ro-prompt-input" type="text" value="${defaultValue || ''}" style="width:100%; padding:8px 12px; border:1px solid #ccc; border-radius:6px; font-size:1rem; box-sizing:border-box;" />
                <div style="display:flex; gap:12px; margin-top:16px; justify-content:flex-end;">
                    <button id="ro-prompt-cancel-btn" style="background:#eee; border:none; padding:6px 16px; border-radius:6px; cursor:pointer;">取消</button>
                    <button id="ro-prompt-ok-btn" style="background:#3b82f6; border:none; color:#fff; padding:6px 16px; border-radius:6px; cursor:pointer;">确定</button>
                </div>
            `,
            onClose: function() { resolve(null); }
        });
        var bind = function() {
            var input = document.getElementById('ro-prompt-input');
            var okBtn = document.getElementById('ro-prompt-ok-btn');
            var cancelBtn = document.getElementById('ro-prompt-cancel-btn');
            if (input && okBtn && cancelBtn) {
                input.focus();
                input.select();
                input.addEventListener('keydown', function(e) {
                    if (e.key === 'Enter') { okBtn.click(); }
                    if (e.key === 'Escape') { cancelBtn.click(); }
                });
                okBtn.addEventListener('click', function() {
                    UIPanel.close();
                    resolve(input.value);
                });
                cancelBtn.addEventListener('click', function() {
                    UIPanel.close();
                    resolve(null);
                });
                return true;
            }
            return false;
        };
        if (!bind()) {
            setTimeout(function() { bind(); }, 50);
        }
    });
},


                
                toast: function(message, type) {
                    global.UIPanel.toast(message, type);
                }
            };
            console.log('[UICardManager] 已自动创建全局 Notification（基于 UIPanel）');
        } else {
            console.error('[UICardManager] 无法初始化: UIPanel 未加载，Notification 使用内置 div 模态框兜底（非阻塞）');
            // 兜底：不依赖 UIPanel 的内置异步 div 模态框（非阻塞，不使用原生 alert/confirm/prompt）
            var fallbackModal = function(message, options) {
                options = options || {};
                return new Promise(function(resolve) {
                    var overlay = document.createElement('div');
                    overlay.style.cssText = 'position:fixed; inset:0; background:rgba(0,0,0,0.4); z-index:10000; display:flex; align-items:center; justify-content:center;';
                    overlay.innerHTML = `
                        <div style="background:#fff; border-radius:10px; padding:20px 24px; min-width:280px; max-width:80%; box-shadow:0 8px 30px rgba(0,0,0,0.25); font-family:system-ui, sans-serif;">
                            <p style="margin:0 0 16px; word-break:break-word;">${message}</p>
                            ${options.showInput ? `<input id="ro-fb-input" type="text" value="${options.defaultValue || ''}" style="width:100%; padding:8px 12px; border:1px solid #ccc; border-radius:6px; font-size:1rem; box-sizing:border-box;" />` : ''}
                            <div style="display:flex; gap:12px; margin-top:16px; justify-content:flex-end;">
                                <button data-act="cancel" style="background:#eee; border:none; padding:6px 16px; border-radius:6px; cursor:pointer;">取消</button>
                                <button data-act="ok" style="background:#3b82f6; border:none; color:#fff; padding:6px 16px; border-radius:6px; cursor:pointer;">${options.okText || '确定'}</button>
                            </div>
                        </div>
                    `;
                    document.body.appendChild(overlay);
                    var done = false;
                    function finish(ok) {
                        if (done) return;
                        done = true;
                        overlay.remove();
                        resolve({ ok: ok, value: ok && options.showInput ? overlay.querySelector('#ro-fb-input').value : null });
                    }
                    overlay.addEventListener('click', function(e) {
                        if (e.target.dataset && e.target.dataset.act === 'ok') finish(true);
                        else if (e.target.dataset && e.target.dataset.act === 'cancel') finish(false);
                        else if (e.target === overlay) finish(false);
                    });
                    var input = overlay.querySelector('#ro-fb-input');
                    if (input) { input.focus(); input.select(); }
                });
            };
            global.Notification = {
                alert: function(message) { return fallbackModal(message).then(function() {}); },
                confirm: function(message) { return fallbackModal(message).then(function(r) { return r.ok; }); },
                prompt: function(message, defaultValue) { return fallbackModal(message, { showInput: true, defaultValue: defaultValue }).then(function(r) { return r.value; }); },
                toast: function() {}
            };
        }
    }

    // ---- 工具函数（原内部函数，保持不变） ----
    function getCardSlotsForSlot(slot) {
        if (!global.InventoryService) return [];
        var equipped = global.InventoryService.getEquippedInfo ? global.InventoryService.getEquippedInfo() : {};
        var info = equipped[slot];
        if (!info) return [];
        var def = global.ItemDataGateway ? global.ItemDataGateway.getById(info.templateId) : null;
        if (!def || !def.Slots) return [];
        var slots = [];
        for (var i = 0; i < def.Slots; i++) {
            var cardId = (info.cards && info.cards[i]) ? info.cards[i] : null;
            slots.push({
                index: i,
                filled: !!cardId,
                cardId: cardId,
                cardName: cardId ? (global.ItemDataGateway ? global.ItemDataGateway.getDisplayName(cardId) : '#' + cardId) : null,
            });
        }
        return slots;
    }

    function getAvailableCards() {
        if (!global.InventoryService) return [];
        var stacks = global.InventoryService.getAllStacks ? global.InventoryService.getAllStacks(false) : [];
        var cards = [];
        for (var i = 0; i < stacks.length; i++) {
            var stack = stacks[i];
            var def = global.ItemDataGateway ? global.ItemDataGateway.getById(stack.templateId) : null;
            if (def && def.Type === 'Card') {
                cards.push({
                    key: stack.key,
                    templateId: stack.templateId,
                    name: global.ItemDataGateway ? global.ItemDataGateway.getDisplayName(stack.templateId) : '#' + stack.templateId,
                    count: stack.count,
                });
            }
        }
        return cards;
    }

    function getCardDescription(cardDef) {
        if (!cardDef || !cardDef.Script) return '';
        var script = cardDef.Script;
        var matches = script.match(/bonus\s+(b\w+)\s*,\s*(\d+)/g);
        if (!matches) return '';
        var map = {
            'bStr': '力量', 'bAgi': '敏捷', 'bVit': '体质', 'bInt': '智力',
            'bDex': '灵巧', 'bLuk': '幸运',
            'bAtk': '攻击', 'bMatk': '魔攻', 'bDef': '防御', 'bMdef': '魔防',
            'bMaxHP': '最大HP', 'bMaxSP': '最大SP', 'bAspd': '攻速',
        };
        var parts = [];
        for (var i = 0; i < matches.length; i++) {
            var m = matches[i];
            var match = m.match(/bonus\s+(b\w+)\s*,\s*(\d+)/);
            if (!match) continue;
            var key = match[1];
            var val = parseInt(match[2], 10);
            var name = map[key] || key.replace('b', '');
            parts.push(name + '+' + val);
        }
        return parts.join('、');
    }

    // ---- 渲染函数 ----
    function renderCardSlots() {
        var container = document.getElementById('card-slots-area');
        if (!container) return;
        var slots = getCardSlotsForSlot(currentSlot);
        if (slots.length === 0) {
            container.innerHTML = '<div style="color:#999;padding:12px 0;">该装备无卡片槽</div>';
            return;
        }
        var html = '';
        for (var i = 0; i < slots.length; i++) {
            var slot = slots[i];
            if (slot.filled) {
                html += '<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 8px;background:#f0f4f8;border-radius:6px;margin-bottom:4px;">';
                html += '<span>🃏 ' + slot.cardName + '</span>';
                html += '<button class="card-remove-btn" data-slot="' + currentSlot + '" data-index="' + slot.index + '" style="background:#d32f2f;border:none;color:#fff;padding:2px 12px;border-radius:4px;cursor:pointer;">拔下</button>';
                html += '</div>';
            } else {
                html += '<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 8px;background:#fafafa;border-radius:6px;margin-bottom:4px;color:#999;border:1px dashed #ddd;">';
                html += '<span>空槽 ' + (slot.index + 1) + '</span>';
                html += '<span style="font-size:0.8rem;">可插入卡片</span>';
                html += '</div>';
            }
        }
        container.innerHTML = html;
    }

    function renderAvailableCards() {
        var container = document.getElementById('available-cards-area');
        if (!container) return;
        var cards = getAvailableCards();
        if (cards.length === 0) {
            container.innerHTML = '<div style="color:#999;padding:12px 0;">背包中没有卡片</div>';
            return;
        }
        var html = '';
        for (var i = 0; i < cards.length; i++) {
            var card = cards[i];
            var def = global.ItemDataGateway ? global.ItemDataGateway.getById(card.templateId) : null;
            var desc = def ? getCardDescription(def) : '';
            html += '<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 8px;background:#fff;border-radius:6px;margin-bottom:4px;border:1px solid #e0e0e0;">';
            html += '<div><span>🃏 ' + card.name + '</span>';
            if (desc) html += '<span style="font-size:0.8rem;color:#666;margin-left:8px;">' + desc + '</span>';
            html += '<span style="font-size:0.8rem;color:#999;margin-left:8px;">×' + card.count + '</span></div>';
            html += '<button class="card-insert-btn" data-key="' + card.key  + '" style="background:#4caf50;border:none;color:#fff;padding:2px 12px;border-radius:4px;cursor:pointer;">插入</button>';
            html += '</div>';
        }
        container.innerHTML = html;
    }

    // ---- 打开/关闭（async） ----
    async function openCardManager(equipSlot) {
        if (typeof UIPanel === 'undefined') {
            console.error('[UICardManager] UIPanel 未加载，无法打开');
            await Notification.alert('系统UI组件缺失，请刷新页面重试');
            return;
        }
        if (!equipSlot) {
            await Notification.alert('未指定装备槽');
            return;
        }

        var equipped = global.InventoryService.getEquippedInfo ? global.InventoryService.getEquippedInfo() : {};
        var item = equipped[equipSlot];
        if (!item) {
            await Notification.alert('该槽位没有装备');
            return;
        }
        var def = global.ItemDataGateway ? global.ItemDataGateway.getById(item.templateId) : null;
        if (!def || !def.Slots) {
            await Notification.alert('该装备没有卡片槽');
            return;
        }

        currentSlot = equipSlot;

        if (isOpen) {
            // 如果已打开，仅刷新内容
            renderCardSlots();
            renderAvailableCards();
            return;
        }

        UIPanel.show({
            preset: 'large',
            title: { icon: '🃏', text: '卡片管理' },
            content: `
                <div style="margin-bottom:12px;">
                    <div style="font-weight:500;font-size:0.9rem;color:#555;margin-bottom:6px;">已镶嵌</div>
                    <div id="card-slots-area" style="display:flex;flex-direction:column;gap:4px;min-height:60px;padding:4px 0;"></div>
                </div>
                <hr style="border:0;border-top:1px solid #e0e0e0;margin:8px 0 12px 0;" />
                <div style="flex:1;display:flex;flex-direction:column;min-height:120px;">
                    <div style="font-weight:500;font-size:0.9rem;color:#555;margin-bottom:6px;">可用卡片</div>
                    <div id="available-cards-area" style="flex:1;overflow-y:auto;display:flex;flex-direction:column;gap:4px;background:#fafafa;border-radius:6px;padding:8px;max-height:240px;"></div>
                </div>
            `,
            onClose: function() {
                isOpen = false;
                currentSlot = null;
            }
        });

        isOpen = true;
        renderCardSlots();
        renderAvailableCards();
        _bindPanelEvents();
    }

    function closeModal() {
        UIPanel.close();
        if (isOpen) isOpen = false;
        currentSlot = null;
    }

    // ---- 事件绑定（async） ----
    function _bindPanelEvents() {
        var container = document.querySelector('.ro-panel-container');
        if (!container) return;

        if (container._cardHandler) {
            container.removeEventListener('click', container._cardHandler);
            delete container._cardHandler;
        }

        var handler = async function(e) {
            var target = e.target;

            // 插入卡片
            var insertBtn = target.closest('.card-insert-btn');
            if (insertBtn) {
                var key = insertBtn.dataset.key;
                if (!key) return;
                var slots = getCardSlotsForSlot(currentSlot);
                var emptyIndex = slots.findIndex(function(s) { return !s.filled; });
                if (emptyIndex === -1) {
                    await Notification.alert('当前装备卡槽已满');
                    return;
                }
                var result = global.InventoryService.insertCard(currentSlot, key);
                if (result.success) {
                    renderCardSlots();
                    renderAvailableCards();
                    if (global.UIInventory && typeof global.UIInventory.renderInventory === 'function') {
                        global.UIInventory.renderInventory();
                        global.UIInventory.updateBadge();
                    }
                    if (global.UIEquip && typeof global.UIEquip.update === 'function') {
                        global.UIEquip.update();
                    }
                } else {
                    await Notification.alert('插入失败: ' + result.message);
                }
                return;
            }

            // 拔下卡片
            var removeBtn = target.closest('.card-remove-btn');
            if (removeBtn) {
                var slot = removeBtn.dataset.slot;
                var index = parseInt(removeBtn.dataset.index, 10);
                var result = global.InventoryService.removeCard(slot, index);
                if (result.success) {
                    renderCardSlots();
                    renderAvailableCards();
                    if (global.UIInventory && typeof global.UIInventory.renderInventory === 'function') {
                        global.UIInventory.renderInventory();
                        global.UIInventory.updateBadge();
                    }
                    if (global.UIEquip && typeof global.UIEquip.update === 'function') {
                        global.UIEquip.update();
                    }
                } else {
                    await Notification.alert('拔下失败: ' + result.message);
                }
                return;
            }
        };

        container.addEventListener('click', handler);
        container._cardHandler = handler;
    }

    // ---- 生命周期 ----
    function init() {
        if (_initialized) return;
        _initialized = true;
        console.log('[UICardManager] ✅ 已加载（UIPanel 版，非阻塞弹窗）');

        if (global.UIManager && typeof global.UIManager.register === 'function') {
            global.UIManager.register(global.UICardManager);
        }
    }

    function dispose() {
        var container = document.querySelector('.ro-panel-container');
        if (container && container._cardHandler) {
            container.removeEventListener('click', container._cardHandler);
            delete container._cardHandler;
        }
        for (var i = 0; i < _domListeners.length; i++) {
            var item = _domListeners[i];
            item.el.removeEventListener(item.event, item.fn);
        }
        _domListeners = [];
        for (var j = 0; j < _listeners.length; j++) {
            if (global.EventBus) global.EventBus.off(_listeners[j].event, _listeners[j].fn);
        }
        _listeners = [];
        closeModal();
        _initialized = false;
        console.log('[UICardManager] 已清理');
    }

    // ---- 暴露全局 ----
    global.UICardManager = {
        name: 'UICardManager',
        init: init,
        dispose: dispose,
        open: openCardManager,
        close: closeModal,
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})(window);