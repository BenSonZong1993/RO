// js/ui/UIRecycle.js
// ============================================================
//  回收商人面板（v4.1：背包物品出售 → Zeny）
//  权限：data:inventory + char:addZeny（经 AccessControl；实际走 MaterialService.sell）
//  依赖：InventoryService、ItemDataGateway（getSellPrice）、MaterialService、EventBus、UIManager
//  入口：主页面"回收商人"便捷按钮 / 普隆德拉-回收商人 NPC
// ============================================================
(function(global) {
    'use strict';

    var isOpen = false;
    var _listeners = [];
    var _domListeners = [];
    var _initialized = false;

    function _getEl(id) { return document.getElementById(id); }

    function _listSellableStacks() {
        var rows = global.InventoryService ? global.InventoryService.getAllStacks(false) : [];
        var out = [];
        for (var i = 0; i < rows.length; i++) {
            var row = rows[i];
            if (row.count <= 0) continue;
            var price = global.ItemDataGateway ? global.ItemDataGateway.getSellPrice(row.templateId) : 0;
            if (price <= 0) continue;
            out.push({
                key: row.key,
                templateId: row.templateId,
                name: global.ItemDataGateway ? global.ItemDataGateway.getDisplayName(row.templateId) : ('#' + row.templateId),
                type: global.ItemDataGateway ? global.ItemDataGateway.getType(row.templateId) : '其他',
                count: row.count,
                price: price,
            });
        }
        out.sort(function(a, b) { return a.templateId - b.templateId; });
        return out;
    }

    function _sell(key, count) {
        var rows = _listSellableStacks();
        var row = null;
        for (var i = 0; i < rows.length; i++) {
            if (rows[i].key === key) { row = rows[i]; break; }
        }
        if (!row) return;
        var n = Math.min(count === 'all' ? row.count : count, row.count);
        if (n <= 0) return;
        var result = global.MaterialService ? global.MaterialService.sell(key, n, row.price, 'UIRecycle') : null;
        var msgEl = _getEl('recycle-msg');
        if (msgEl) {
            var ok = result && result.success;
            msgEl.textContent = ok
                ? '✅ 已出售 ' + row.name + ' ×' + n + '，获得 ' + result.zeny + ' Zeny'
                : '❌ ' + ((result && result.message) || '出售失败');
            msgEl.style.color = ok ? '#2e7d32' : '#c00';
        }
        render();
    }

    function render() {
        var body = _getEl('recycle-body');
        var summary = _getEl('recycle-summary');
        if (!body) return;

        var rows = _listSellableStacks();
        if (summary) {
            var totalValue = rows.reduce(function(sum, r) { return sum + r.price * r.count; }, 0);
            summary.textContent = '可出售 ' + rows.length + ' 种 | 全部卖出可得 ' + totalValue + ' Zeny';
        }

        if (rows.length === 0) {
            body.innerHTML = '<div style="padding:40px; text-align:center; color:#999;">背包中没有可出售的物品。</div>';
            return;
        }

        var html = '<table style="width:100%; border-collapse:collapse; font-size:0.9rem;">';
        html += '<thead><tr style="background:#f5f5f5; border-bottom:2px solid #ddd;">' +
            '<th style="text-align:left; padding:6px 8px;">名称</th>' +
            '<th style="text-align:left; padding:6px 8px; width:12%;">类型</th>' +
            '<th style="text-align:center; padding:6px 8px; width:10%;">单价</th>' +
            '<th style="text-align:center; padding:6px 8px; width:10%;">持有</th>' +
            '<th style="text-align:center; padding:6px 8px; width:30%;">操作</th>' +
            '</tr></thead><tbody>';
        for (var i = 0; i < rows.length; i++) {
            var r = rows[i];
            html += '<tr style="border-bottom:1px solid #eee;">';
            html += '<td style="padding:6px 8px;">' + r.name + '</td>';
            html += '<td style="padding:6px 8px; color:#666;">' + r.type + '</td>';
            html += '<td style="padding:6px 8px; text-align:center; color:#a07000;">' + r.price + 'Z</td>';
            html += '<td style="padding:6px 8px; text-align:center;">' + r.count + '</td>';
            html += '<td style="padding:6px 8px; text-align:center;">' +
                '<button class="recycle-sell-btn" data-key="' + r.key + '" data-count="1" style="background:#4a90d9; border:none; color:#fff; padding:3px 12px; border-radius:4px; cursor:pointer; margin:0 2px;">卖1</button>' +
                '<button class="recycle-sell-btn" data-key="' + r.key + '" data-count="10" style="background:#4a90d9; border:none; color:#fff; padding:3px 12px; border-radius:4px; cursor:pointer; margin:0 2px;">卖10</button>' +
                '<button class="recycle-sell-btn" data-key="' + r.key + '" data-count="all" style="background:#e67e22; border:none; color:#fff; padding:3px 12px; border-radius:4px; cursor:pointer; margin:0 2px;">全部</button>' +
                '</td></tr>';
        }
        html += '</tbody></table>';
        body.innerHTML = html;
    }

    // ============================================================
    //  打开 / 关闭（使用 UIPanel）
    // ============================================================
    function open() {
        if (isOpen) {
            render();
            return;
        }

        UIPanel.show({
            preset: 'large',
            title: { icon: '💰', text: '回收商人' },
            content: `
                <div id="recycle-summary" style="font-size:0.9rem; color:#666; margin-bottom:8px;"></div>
                <div id="recycle-body" style="flex:1; overflow-y:auto; border:1px solid #eee; border-radius:8px; padding:4px; min-height:200px;"></div>
                <div style="border-top:1px solid #eee; padding-top:8px; margin-top:8px; display:flex; justify-content:space-between; align-items:center;">
                    <span id="recycle-msg" style="font-size:0.85rem; color:#666;">点击按钮出售，Zeny 即时入账。</span>
                    <button id="recycle-close-btn" style="background:#f0f0f0; border:1px solid #ccc; border-radius:4px; padding:4px 16px; cursor:pointer;">关闭</button>
                </div>
            `,
            onClose: function() {
                isOpen = false;
            }
        });

        isOpen = true;
        _bindPanelEvents();
        render();
    }

    function close() {
        UIPanel.close();
        if (isOpen) isOpen = false;
    }

    // ---------- 面板内部事件绑定 ----------
    function _bindPanelEvents() {
        var container = document.querySelector('.ro-panel-container');
        if (!container) return;

        if (container._panelHandler) {
            container.removeEventListener('click', container._panelHandler);
            delete container._panelHandler;
        }

        var handler = function(e) {
            var target = e.target;

            // 关闭按钮
            if (target.id === 'recycle-close-btn') {
                close();
                return;
            }

            // 出售按钮
            var btn = target.closest('.recycle-sell-btn');
            if (btn) {
                var key = btn.dataset.key;
                var count = btn.dataset.count === 'all' ? 'all' : parseInt(btn.dataset.count, 10);
                _sell(key, count);
                return;
            }
        };

        container.addEventListener('click', handler);
        container._panelHandler = handler;
    }

    // ============================================================
    //  初始化与销毁
    // ============================================================
    function init() {
        if (_initialized) return;
        _initialized = true;
        console.log('[UIRecycle] ✅ 已初始化（回收商人面板，UIPanel 版）');

        // 绑定全局快捷按钮（如果有）
        var btn = document.getElementById('btn-recycle');
        if (btn) {
            var handler = function() { open(); };
            btn.addEventListener('click', handler);
            _domListeners.push({ el: btn, event: 'click', fn: handler });
        }

        if (global.UIManager && typeof global.UIManager.register === 'function') {
            global.UIManager.register(global.UIRecycle);
        }
    }

    function dispose() {
        // 移除面板事件
        var container = document.querySelector('.ro-panel-container');
        if (container && container._panelHandler) {
            container.removeEventListener('click', container._panelHandler);
            delete container._panelHandler;
        }
        for (var j = 0; j < _domListeners.length; j++) {
            _domListeners[j].el.removeEventListener(_domListeners[j].event, _domListeners[j].fn);
        }
        _domListeners = [];
        close();
        _initialized = false;
        console.log('[UIRecycle] 已清理');
    }

    // ============================================================
    //  暴露全局
    // ============================================================
    global.UIRecycle = {
        name: 'UIRecycle',
        init: init,
        dispose: dispose,
        open: open,
        close: close,
        render: render,
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})(window);